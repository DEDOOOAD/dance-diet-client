import { DanceClass } from '@/data/dances';
import { getCurrentUserUuid, loadCurrentUserUuid } from '@/services/current-user';
import { getGeneralServerHttpBaseUrl, resolveGeneralServerLiveSessionWsUrl } from '@/services/server-config/base';
import {
  getGeneralServerLiveSessionEndEndpoint,
  getGeneralServerLiveSessionStartEndpoint,
} from '@/services/server-config/general-server';
import { encodeLiveFrameToJpeg } from '@/services/live-frame-jpeg-processor';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useRunOnJS, useSharedValue } from 'react-native-worklets-core';
import {
  Camera,
  type CameraDevice,
  runAsync,
  runAtTargetFps,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';

export type DanceVisionPracticeModalProps = {
  dance: DanceClass | null;
  visible: boolean;
  onClose: () => void;
};

export type PracticePhase = 'ready' | 'countdown' | 'playing' | 'paused';
export type StreamState = 'idle' | 'permission' | 'connecting' | 'streaming' | 'error';

export type LiveMetrics = {
  totalFrames: number;
  elapsedSeconds: number;
  calories: number;
  movementScore: number;
};

export type TransportStats = {
  sentFrames: number;
  droppedFrames: number;
  lastPayloadBytes: number;
  averagePayloadBytes: number;
};

type SessionStartResponse = {
  session_id: string;
  ws_url?: string;
};

const REQUEST_TIMEOUT_MS = 8000;
const SESSION_READY_TIMEOUT_MS = 8000;
const TARGET_FRAME_FPS = 16;
const UI_UPDATE_INTERVAL_MS = 500;
const SNAPSHOT_JPEG_QUALITY = 32;
const TARGET_VIDEO_RESOLUTION = { width: 320, height: 240 } as const;
const DEFAULT_LIVE_USER_WEIGHT_KG = 60;
const textEncoder = new TextEncoder();
const base64Alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function getHttpBaseUrl() {
  return getGeneralServerHttpBaseUrl();
}

function getLiveUserWeightKg() {
  const configuredWeight = Number(process.env.EXPO_PUBLIC_USER_WEIGHT_KG?.trim());
  if (Number.isFinite(configuredWeight) && configuredWeight > 0) {
    return configuredWeight;
  }

  return DEFAULT_LIVE_USER_WEIGHT_KG;
}

function resetMetricsState(): LiveMetrics {
  return {
    totalFrames: 0,
    elapsedSeconds: 0,
    calories: 0,
    movementScore: 0,
  };
}

function resetTransportState(): TransportStats {
  return {
    sentFrames: 0,
    droppedFrames: 0,
    lastPayloadBytes: 0,
    averagePayloadBytes: 0,
  };
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const requestUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : String(input);
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      const timeoutError = new Error(`Timed out after ${timeoutMs}ms: ${requestUrl}`);
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeWsUrl(wsUrl: string | undefined, sessionId: string) {
  return resolveGeneralServerLiveSessionWsUrl(wsUrl, sessionId);
}

function getAveragePayloadBytes(previousAverage: number, previousCount: number, nextValue: number) {
  if (previousCount <= 0) {
    return nextValue;
  }

  return (previousAverage * previousCount + nextValue) / (previousCount + 1);
}

function getBestDevice(frontDevice: CameraDevice | undefined, backDevice: CameraDevice | undefined) {
  return frontDevice ?? backDevice;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function decodeBase64ToBytes(base64: string, byteLengthHint: number) {
  const sanitizedBase64 = base64.replace(/[^A-Za-z0-9+/=]/g, '');
  const paddingLength =
    sanitizedBase64.endsWith('==') ? 2 : sanitizedBase64.endsWith('=') ? 1 : 0;
  const outputLength =
    byteLengthHint > 0
      ? byteLengthHint
      : Math.max(0, Math.floor((sanitizedBase64.length * 3) / 4) - paddingLength);
  const output = new Uint8Array(outputLength);

  let outputOffset = 0;

  for (let index = 0; index < sanitizedBase64.length; index += 4) {
    const chunk0 = base64Alphabet.indexOf(sanitizedBase64[index] ?? 'A');
    const chunk1 = base64Alphabet.indexOf(sanitizedBase64[index + 1] ?? 'A');
    const char2 = sanitizedBase64[index + 2] ?? '=';
    const char3 = sanitizedBase64[index + 3] ?? '=';
    const chunk2 = char2 === '=' ? 0 : base64Alphabet.indexOf(char2);
    const chunk3 = char3 === '=' ? 0 : base64Alphabet.indexOf(char3);

    const combined = (chunk0 << 18) | (chunk1 << 12) | (chunk2 << 6) | chunk3;

    if (outputOffset < output.length) {
      output[outputOffset] = (combined >> 16) & 0xff;
      outputOffset += 1;
    }

    if (char2 !== '=' && outputOffset < output.length) {
      output[outputOffset] = (combined >> 8) & 0xff;
      outputOffset += 1;
    }

    if (char3 !== '=' && outputOffset < output.length) {
      output[outputOffset] = combined & 0xff;
      outputOffset += 1;
    }
  }

  return outputOffset === output.length ? output : output.slice(0, outputOffset);
}

export function useDanceVisionPracticeModalController({
  dance,
  visible,
  onClose,
}: DanceVisionPracticeModalProps) {
  const [phase, setPhase] = useState<PracticePhase>('ready');
  const [countdown, setCountdown] = useState(3);
  const [cameraReady, setCameraReady] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [metrics, setMetrics] = useState<LiveMetrics>(resetMetricsState);
  const [transportStats, setTransportStats] = useState<TransportStats>(resetTransportState);
  const { hasPermission: hasCameraPermission, requestPermission } = useCameraPermission();

  const frontDevice = useCameraDevice('front');
  const backDevice = useCameraDevice('back');
  const device = getBestDevice(frontDevice, backDevice);
  const format = useCameraFormat(device, [
    { videoResolution: TARGET_VIDEO_RESOLUTION },
    { fps: TARGET_FRAME_FPS },
  ]);
  const [currentUserUuid, setCurrentUserUuid] = useState(() => getCurrentUserUuid());
  const liveUserWeightKg = useMemo(() => getLiveUserWeightKg(), []);

  const cameraRef = useRef<Camera | null>(null);
  const currentUserUuidRef = useRef(currentUserUuid);
  const websocketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const frameIndexRef = useRef(0);
  const sessionReadyRef = useRef(false);
  const awaitingFrameResultRef = useRef(false);
  const shouldTreatSocketCloseAsErrorRef = useRef(false);
  const bufferedMetricsRef = useRef<LiveMetrics>(resetMetricsState());
  const bufferedTransportStatsRef = useRef<TransportStats>(resetTransportState());
  const uiFlushPendingRef = useRef(false);
  const visibleRef = useRef(visible);
  const phaseRef = useRef(phase);
  const streamStateRef = useRef(streamState);
  const cameraReadyRef = useRef(cameraReady);
  const hasCameraPermissionRef = useRef(hasCameraPermission);
  const frameUploadGate = useSharedValue(false);
  const referenceVideoUrl = dance?.youtubeUrl ?? null;

  useEffect(() => {
    currentUserUuidRef.current = currentUserUuid;
  }, [currentUserUuid]);

  useEffect(() => {
    void loadCurrentUserUuid()
      .then((loadedUserUuid) => {
        setCurrentUserUuid(loadedUserUuid);
      })
      .catch(() => {
        // Keep the cached fallback when persisted login state cannot be loaded.
      });
  }, []);

  const logDebug = useCallback((message: string, extra?: Record<string, unknown>) => {
    void message;
    void extra;
  }, []);

  const clearCaptureLoop = useCallback(() => {
    frameUploadGate.value = false;
  }, [frameUploadGate]);

  const syncFrameUploadGate = useCallback(() => {
    frameUploadGate.value =
      visibleRef.current &&
      phaseRef.current === 'playing' &&
      streamStateRef.current === 'streaming' &&
      hasCameraPermissionRef.current &&
      cameraReadyRef.current &&
      sessionReadyRef.current &&
      websocketRef.current?.readyState === WebSocket.OPEN &&
      !awaitingFrameResultRef.current;
  }, [frameUploadGate]);

  useEffect(() => {
    visibleRef.current = visible;
    syncFrameUploadGate();
  }, [syncFrameUploadGate, visible]);

  useEffect(() => {
    phaseRef.current = phase;
    syncFrameUploadGate();
  }, [phase, syncFrameUploadGate]);

  useEffect(() => {
    streamStateRef.current = streamState;
    syncFrameUploadGate();
  }, [streamState, syncFrameUploadGate]);

  useEffect(() => {
    cameraReadyRef.current = cameraReady;
    syncFrameUploadGate();
  }, [cameraReady, syncFrameUploadGate]);

  useEffect(() => {
    hasCameraPermissionRef.current = hasCameraPermission;
    syncFrameUploadGate();
  }, [hasCameraPermission, syncFrameUploadGate]);

  const releaseFrameBackpressure = useCallback(() => {
    awaitingFrameResultRef.current = false;
    syncFrameUploadGate();
  }, [syncFrameUploadGate]);

  const flushBufferedUiState = useCallback(() => {
    if (!uiFlushPendingRef.current) {
      return;
    }

    uiFlushPendingRef.current = false;
    setMetrics(bufferedMetricsRef.current);
    setTransportStats(bufferedTransportStatsRef.current);
  }, []);

  const updateBufferedMetrics = useCallback((nextMetrics: LiveMetrics, flushImmediately = false) => {
    bufferedMetricsRef.current = nextMetrics;

    if (flushImmediately) {
      uiFlushPendingRef.current = false;
      setMetrics(nextMetrics);
      return;
    }

    uiFlushPendingRef.current = true;
  }, []);

  const updateBufferedTransportStats = useCallback(
    (updater: (previousStats: TransportStats) => TransportStats, flushImmediately = false) => {
      const nextTransportStats = updater(bufferedTransportStatsRef.current);
      bufferedTransportStatsRef.current = nextTransportStats;

      if (flushImmediately) {
        uiFlushPendingRef.current = false;
        setTransportStats(nextTransportStats);
        return;
      }

      uiFlushPendingRef.current = true;
    },
    []
  );

  useEffect(() => {
    const timer = setInterval(() => {
      flushBufferedUiState();
    }, UI_UPDATE_INTERVAL_MS);

    return () => {
      clearInterval(timer);
    };
  }, [flushBufferedUiState]);

  const resetWorkoutState = useCallback(() => {
    const nextMetrics = resetMetricsState();
    const nextTransportStats = resetTransportState();

    clearCaptureLoop();
    setPhase('ready');
    setCountdown(3);
    setStreamState('idle');
    bufferedMetricsRef.current = nextMetrics;
    bufferedTransportStatsRef.current = nextTransportStats;
    uiFlushPendingRef.current = false;
    setMetrics(nextMetrics);
    setTransportStats(nextTransportStats);
    frameIndexRef.current = 0;
    sessionReadyRef.current = false;
    awaitingFrameResultRef.current = false;
    shouldTreatSocketCloseAsErrorRef.current = false;
    frameUploadGate.value = false;
  }, [clearCaptureLoop]);

  const stopLiveSession = useCallback(async () => {
    logDebug('Stopping VisionCamera live session', {
      sessionId: sessionIdRef.current,
      hasSocket: Boolean(websocketRef.current),
    });

    clearCaptureLoop();
    sessionReadyRef.current = false;
    awaitingFrameResultRef.current = false;
    shouldTreatSocketCloseAsErrorRef.current = false;

    const activeSocket = websocketRef.current;
    if (activeSocket) {
      websocketRef.current = null;
      activeSocket.close();
    }

    if (sessionIdRef.current) {
      const activeSessionId = sessionIdRef.current;
      sessionIdRef.current = null;

      try {
        await fetchWithTimeout(getGeneralServerLiveSessionEndEndpoint(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_id: activeSessionId }),
        });
        logDebug('VisionCamera live session end request sent', { sessionId: activeSessionId });
      } catch {
        logDebug('VisionCamera live session end request failed', { sessionId: activeSessionId });
      }
    }
  }, [clearCaptureLoop, logDebug]);

  useEffect(() => {
    syncFrameUploadGate();
  }, [syncFrameUploadGate]);

  useEffect(() => {
    if (!visible) {
      setCameraReady(false);
      resetWorkoutState();
      void stopLiveSession();
    }
  }, [resetWorkoutState, stopLiveSession, visible]);

  useEffect(() => {
    if (phase !== 'countdown') {
      return;
    }

    if (countdown === 0) {
      setPhase('playing');
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((previousCountdown) => previousCountdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, phase]);

  const handleServerPayload = useCallback(
    (payload: Record<string, unknown>) => {
      const payloadType = typeof payload.type === 'string' ? payload.type : 'unknown';

      logDebug('VisionCamera server message received', {
        type: payloadType,
        sessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
        keys: Object.keys(payload),
      });

      if (payloadType === 'session_ready') {
        sessionReadyRef.current = true;
        streamStateRef.current = 'streaming';
        setStreamState('streaming');
        syncFrameUploadGate();
        return payloadType;
      }

      if (payloadType === 'frame_result' || payloadType === 'frame_ack') {
        releaseFrameBackpressure();

        const totalFrames = Number(payload.total_frames ?? 0);
        const elapsedSeconds = Number(payload.elapsed_seconds ?? 0);
        const calories = Number(
          payload.total_calories ?? payload.calories ?? payload.calories_burned ?? 0
        );
        const movementScore = Number(payload.movement_score ?? 0);

        updateBufferedMetrics({
          totalFrames,
          elapsedSeconds,
          calories,
          movementScore,
        });
        setStreamState('streaming');
        return payloadType;
      }

      if (payloadType === 'error') {
        releaseFrameBackpressure();
        logDebug('Live session server error received', {
          message: typeof payload.message === 'string' ? payload.message : 'unknown_error',
          sessionId: typeof payload.session_id === 'string' ? payload.session_id : null,
        });
        streamStateRef.current = 'error';
        setStreamState('error');
      }

      return payloadType;
    },
    [logDebug, releaseFrameBackpressure, syncFrameUploadGate, updateBufferedMetrics]
  );

  const createLiveSession = useCallback(
    async (targetDance: DanceClass, sessionUuid: string) => {
      setStreamState('connecting');
      logDebug('Creating VisionCamera live session', {
        danceId: targetDance.id,
        serverBaseUrl: getHttpBaseUrl(),
        uuid: sessionUuid,
      });

      try {
        const sessionStartUrl = getGeneralServerLiveSessionStartEndpoint();
        logDebug('VisionCamera live session start request sending', {
          url: sessionStartUrl,
          timeoutMs: REQUEST_TIMEOUT_MS,
        });

        const response = await fetchWithTimeout(sessionStartUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uuid: sessionUuid,
            genre: '',
            dance_type: '',
            class_id: targetDance.id,
            content_id: targetDance.id,
          }),
        });

        logDebug('VisionCamera live session start response received', {
          ok: response.ok,
          status: response.status,
        });

        if (!response.ok) {
          throw new Error('session_start_failed');
        }

        const payload = (await response.json()) as SessionStartResponse;
        const sessionId = String(payload.session_id);
        const socketUrl = normalizeWsUrl(payload.ws_url, sessionId);

        await new Promise<void>((resolve, reject) => {
          const socket = new WebSocket(socketUrl);
          let isSessionReady = false;
          let didSocketOpen = false;
          let didSettle = false;

          const settleSuccess = () => {
            if (didSettle) {
              return;
            }

            didSettle = true;
            clearTimeout(timeout);
            resolve();
          };

          const settleFailure = (error: Error) => {
            if (didSettle) {
              return;
            }

            didSettle = true;
            clearTimeout(timeout);
            sessionReadyRef.current = false;
            releaseFrameBackpressure();

            if (websocketRef.current === socket) {
              websocketRef.current = null;
              sessionIdRef.current = null;
            }

            reject(error);
          };

          const timeout = setTimeout(() => {
            logDebug('VisionCamera session_ready timed out', {
              sessionId,
              socketUrl,
              timeoutMs: SESSION_READY_TIMEOUT_MS,
            });
            socket.close();
            settleFailure(new Error('session_ready_timeout'));
          }, SESSION_READY_TIMEOUT_MS);

          socket.onmessage = (event) => {
            try {
              const payload = JSON.parse(String(event.data));
              if (!isObjectRecord(payload)) {
                throw new Error('invalid_server_payload');
              }

              const payloadType = handleServerPayload(payload);
              if (payloadType === 'session_ready') {
                isSessionReady = true;
                settleSuccess();
              }
            } catch {
              logDebug('Failed to parse server message');
              setStreamState('error');
              settleFailure(new Error('socket_message_parse_error'));
            }
          };

          socket.onopen = () => {
            didSocketOpen = true;
            websocketRef.current = socket;
            sessionIdRef.current = sessionId;
            sessionReadyRef.current = false;
            releaseFrameBackpressure();
            shouldTreatSocketCloseAsErrorRef.current = true;
            setStreamState('connecting');
            socket.onerror = (event) => {
              logDebug('VisionCamera WebSocket runtime error', {
                sessionId,
                readyState: socket.readyState,
                eventType: event.type,
              });
              if (!isSessionReady) {
                settleFailure(new Error('socket_error'));
              }
              if (websocketRef.current === socket) {
                setStreamState('error');
              }
            };
            socket.onclose = (event) => {
              const wasActiveSocket = websocketRef.current === socket;
              logDebug('VisionCamera WebSocket closed', {
                sessionId,
                wasActiveSocket,
                code: event.code,
                reason: event.reason || null,
                wasClean: event.wasClean,
              });

              if (!wasActiveSocket) {
                if (!isSessionReady) {
                  settleFailure(new Error('socket_closed_before_session_ready'));
                }
                return;
              }

              websocketRef.current = null;
              sessionIdRef.current = null;
              sessionReadyRef.current = false;
              releaseFrameBackpressure();
              clearCaptureLoop();

              if (!isSessionReady) {
                settleFailure(new Error('socket_closed_before_session_ready'));
                return;
              }

              if (shouldTreatSocketCloseAsErrorRef.current) {
                shouldTreatSocketCloseAsErrorRef.current = false;
                setStreamState('error');
              }
            };
          };

          socket.onerror = (event) => {
            logDebug('VisionCamera WebSocket open failed', {
              sessionId,
              socketUrl,
              readyState: socket.readyState,
              eventType: event.type,
            });
            if (!didSocketOpen) {
              settleFailure(new Error('socket_error'));
            }
          };
        });

        updateBufferedMetrics(resetMetricsState(), true);
        updateBufferedTransportStats(() => resetTransportState(), true);
        frameIndexRef.current = 0;
        logDebug('VisionCamera live session ready for binary JPEG frame uploads', { sessionId });
        return true;
      } catch (error) {
        logDebug('Failed to create VisionCamera live session', {
          errorName: error instanceof Error ? error.name : typeof error,
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack ?? null : null,
        });
        setStreamState('error');
        return false;
      }
    },
    [clearCaptureLoop, handleServerPayload, logDebug, releaseFrameBackpressure, updateBufferedMetrics, updateBufferedTransportStats]
  );

  const handleEncodedFrame = useRunOnJS(
    (base64: string, byteLength: number) => {
      const socket = websocketRef.current;
      const sessionId = sessionIdRef.current;
      const liveSessionUuid = currentUserUuidRef.current;
      const frameIndex = frameIndexRef.current;

      if (
        !base64 ||
        byteLength <= 0 ||
        !socket ||
        !sessionId ||
        !liveSessionUuid ||
        !sessionReadyRef.current ||
        socket.readyState !== WebSocket.OPEN ||
        awaitingFrameResultRef.current
      ) {
        syncFrameUploadGate();
        return;
      }

      try {
        const imageBytes = decodeBase64ToBytes(base64, byteLength);
        const metadata = {
          type: 'frame_binary' as const,
          UUID: liveSessionUuid,
          session_id: sessionId,
          frame_index: frameIndex,
          total_frame: frameIndex + 1,
          user_weight: liveUserWeightKg,
        };
        const metadataJson = JSON.stringify(metadata);
        const payloadBytes = textEncoder.encode(metadataJson).byteLength + imageBytes.byteLength;

        socket.send(metadataJson);
        socket.send(imageBytes);
        awaitingFrameResultRef.current = true;
        frameIndexRef.current += 1;

        updateBufferedTransportStats((previousStats) => ({
          sentFrames: previousStats.sentFrames + 1,
          droppedFrames: previousStats.droppedFrames,
          lastPayloadBytes: payloadBytes,
          averagePayloadBytes: getAveragePayloadBytes(
            previousStats.averagePayloadBytes,
            previousStats.sentFrames,
            payloadBytes
          ),
        }));
      } catch (error) {
        updateBufferedTransportStats((previousStats) => ({
          ...previousStats,
          droppedFrames: previousStats.droppedFrames + 1,
        }));

        logDebug('VisionCamera frame send failed after native JPEG encode', {
          error: error instanceof Error ? error.message : String(error),
          frameIndex,
        });
        clearCaptureLoop();
        setStreamState('error');
      }
    },
    [clearCaptureLoop, liveUserWeightKg, logDebug, syncFrameUploadGate, updateBufferedTransportStats]
  );

  const handleFrameProcessorError = useRunOnJS(
    (message: string) => {
      logDebug('VisionCamera frame processor encode failed', { message });
      updateBufferedTransportStats((previousStats) => ({
        ...previousStats,
        droppedFrames: previousStats.droppedFrames + 1,
      }));
      clearCaptureLoop();
      setStreamState('error');
    },
    [clearCaptureLoop, logDebug, updateBufferedTransportStats]
  );

  const shouldProcessFrames =
    visible &&
    phase === 'playing' &&
    streamState === 'streaming' &&
    hasCameraPermission &&
    cameraReady;

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'worklet';

      if (!shouldProcessFrames || !frameUploadGate.value) {
        return;
      }

      runAtTargetFps(TARGET_FRAME_FPS, () => {
        'worklet';

        if (!frameUploadGate.value) {
          return;
        }

        frameUploadGate.value = false;

        runAsync(frame, () => {
          'worklet';

          try {
            const encodedFrame = encodeLiveFrameToJpeg(frame, SNAPSHOT_JPEG_QUALITY);
            if (encodedFrame == null || encodedFrame.byteLength <= 0) {
              frameUploadGate.value = true;
              return;
            }

            handleEncodedFrame(encodedFrame.base64, encodedFrame.byteLength);
          } catch (error) {
            handleFrameProcessorError(String(error));
          }
        });
      });
    },
    [frameUploadGate, handleEncodedFrame, handleFrameProcessorError, shouldProcessFrames]
  );

  const startWorkout = useCallback(async () => {
    if (!dance) {
      return;
    }

    logDebug('Start VisionCamera workout pressed', {
      danceId: dance.id,
      platform: Platform.OS,
      cameraPermission: hasCameraPermission,
      deviceName: device?.name ?? null,
    });

    await stopLiveSession();

    if (!hasCameraPermission) {
      const granted = await requestPermission();
      logDebug('Vision camera permission requested', { granted });

      if (!granted) {
        setStreamState('permission');
        return;
      }
    }

    if (!device) {
      logDebug('No VisionCamera device available');
      setStreamState('error');
      return;
    }

    const sessionUuid = await loadCurrentUserUuid().catch(() => getCurrentUserUuid());
    setCurrentUserUuid(sessionUuid);

    const connected = await createLiveSession(dance, sessionUuid);
    if (!connected) {
      return;
    }

    setCountdown(3);
    setPhase('countdown');
  }, [createLiveSession, dance, device, hasCameraPermission, logDebug, requestPermission, stopLiveSession]);

  const handleReset = useCallback(() => {
    logDebug('VisionCamera workout reset');
    resetWorkoutState();
    void stopLiveSession();
  }, [logDebug, resetWorkoutState, stopLiveSession]);

  const handleClose = useCallback(() => {
    logDebug('VisionCamera workout modal closed');
    resetWorkoutState();
    void stopLiveSession();
    onClose();
  }, [logDebug, onClose, resetWorkoutState, stopLiveSession]);

  const handleStartWorkout = useCallback(() => {
    void startWorkout();
  }, [startWorkout]);

  const handlePauseWorkout = useCallback(() => {
    setPhase('paused');
  }, []);

  const handleResumeWorkout = useCallback(() => {
    setPhase('playing');
  }, []);

  const handleCameraInitialized = useCallback(() => {
    setCameraReady(true);
    logDebug('Vision camera initialized', {
      deviceName: device?.name ?? null,
      videoWidth: format?.videoWidth ?? TARGET_VIDEO_RESOLUTION.width,
      videoHeight: format?.videoHeight ?? TARGET_VIDEO_RESOLUTION.height,
      targetFrameFps: TARGET_FRAME_FPS,
    });
  }, [device?.name, format?.videoHeight, format?.videoWidth, logDebug]);

  const handleCameraError = useCallback(
    (message: string) => {
      logDebug('Vision camera error', { message });
      setStreamState('error');
    },
    [logDebug]
  );

  const phaseText = useMemo(() => {
    switch (phase) {
      case 'ready':
        return '카메라 스냅샷을 JPEG로 캡처한 뒤 바이너리 WebSocket 패킷으로 서버에 전송합니다.';
      case 'countdown':
        return `${countdown}초 후 시작됩니다. 카운트다운이 끝나면 촬영과 전송이 시작됩니다.`;
      case 'playing':
        return '실시간 분석이 진행 중입니다. VisionCamera 스냅샷을 바이너리 JPEG 프레임으로 서버에 보내고 있습니다.';
      case 'paused':
        return '운동이 일시정지되었습니다. 재개할 때까지 JPEG 프레임 전송도 멈춥니다.';
    }
  }, [countdown, phase]);

  const streamNotice = useMemo(() => {
    if (!device) {
      return 'Waiting for a compatible camera device from VisionCamera.';
    }

    switch (streamState) {
      case 'permission':
        return 'VisionCamera 스트림을 시작하려면 카메라 권한이 필요합니다.';
      case 'connecting':
        return '실시간 세션 서버에 연결 중입니다.';
      case 'streaming':
        return `VisionCamera JPEG 스냅샷을 초당 최대 ${TARGET_FRAME_FPS}프레임으로 전송 중입니다.`;
      case 'error':
        return 'VisionCamera 스트림이 중단되었습니다. 초기화 후 다시 시도해주세요.';
      default:
        return hasCameraPermission
          ? '카메라 권한이 준비되었습니다. 시작을 누르면 VisionCamera 세션을 열고 JPEG 프레임 전송을 시작합니다.'
          : '시작할 때 카메라 권한을 요청합니다.';
    }
  }, [device, hasCameraPermission, streamState]);

  const formattedElapsed = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(metrics.elapsedSeconds));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [metrics.elapsedSeconds]);

  const deviceLabel = useMemo(() => {
    if (!device) {
      return '사용 가능한 카메라 장치를 불러오는 중입니다.';
    }

    return `${device.name} (${device.position})`;
  }, [device]);

  const formatLabel = useMemo(() => {
    const width = format?.videoWidth ?? TARGET_VIDEO_RESOLUTION.width;
    const height = format?.videoHeight ?? TARGET_VIDEO_RESOLUTION.height;
    return `${width}x${height} / JPEG 스냅샷 / 목표 ${TARGET_FRAME_FPS}fps`;
  }, [format?.videoHeight, format?.videoWidth]);

  return {
    dance,
    visible,
    cameraRef,
    device,
    format,
    hasCameraPermission,
    isCameraActive: visible && phase !== 'ready',
    cameraReady,
    deviceLabel,
    formatLabel,
    targetFrameRate: TARGET_FRAME_FPS,
    frameProcessor,
    phase,
    countdown,
    streamState,
    metrics,
    transportStats,
    phaseText,
    streamNotice,
    formattedElapsed,
    referenceVideoUrl,
    handleClose,
    handleReset,
    handleStartWorkout,
    handlePauseWorkout,
    handleResumeWorkout,
    handleCameraInitialized,
    handleCameraError,
  };
}
