import { DanceClass } from '@/data/dances';
import { getCurrentUserUuid, loadCurrentUserUuid } from '@/services/current-user';
import { getGeneralServerHttpBaseUrl, resolveGeneralServerLiveSessionWsUrl } from '@/services/server-config/base';
import {
  getGeneralServerLiveSessionEndEndpoint,
  getGeneralServerLiveSessionStartEndpoint,
} from '@/services/server-config/general-server';
import * as FileSystem from 'expo-file-system/legacy';
import { File as ExpoFile } from 'expo-file-system';
import { useVideoPlayer } from 'expo-video';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import {
  Camera,
  type CameraDevice,
  useCameraDevice,
  useCameraFormat,
  useCameraPermission,
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

type CapturedVisionFrame = {
  path: string;
  width: number;
  height: number;
  orientation: string;
  isMirrored: boolean;
};

const REQUEST_TIMEOUT_MS = 8000;
const SESSION_READY_TIMEOUT_MS = 8000;
const TARGET_FRAME_FPS = 16;
const CAPTURE_INTERVAL_MS = Math.round(1000 / TARGET_FRAME_FPS);
const UI_UPDATE_INTERVAL_MS = 250;
const SNAPSHOT_JPEG_QUALITY = 40;
const TARGET_VIDEO_RESOLUTION = { width: 320, height: 240 } as const;
const DEFAULT_LIVE_USER_WEIGHT_KG = 60;
const textEncoder = new TextEncoder();

function getNowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

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

function normalizeFileUri(path: string) {
  if (path.startsWith('file://')) {
    return path;
  }

  return `file://${path}`;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
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
  const captureLoopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureLoopActiveRef = useRef(false);
  const frameIndexRef = useRef(0);
  const captureInFlightRef = useRef(false);
  const sessionReadyRef = useRef(false);
  const awaitingFrameResultRef = useRef(false);
  const shouldTreatSocketCloseAsErrorRef = useRef(false);
  const bufferedMetricsRef = useRef<LiveMetrics>(resetMetricsState());
  const bufferedTransportStatsRef = useRef<TransportStats>(resetTransportState());
  const uiFlushPendingRef = useRef(false);

  const player = useVideoPlayer(require('@/assets/images/dance.mp4'), (videoPlayer) => {
    videoPlayer.loop = true;
  });

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
    const wasActive = captureLoopActiveRef.current || Boolean(captureLoopTimeoutRef.current);
    captureLoopActiveRef.current = false;

    if (captureLoopTimeoutRef.current) {
      clearTimeout(captureLoopTimeoutRef.current);
      captureLoopTimeoutRef.current = null;
    }

    if (wasActive) {
      logDebug('Vision capture loop cleared');
    }
  }, [logDebug]);

  const releaseFrameBackpressure = useCallback(() => {
    awaitingFrameResultRef.current = false;
  }, []);

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
    captureInFlightRef.current = false;
    sessionReadyRef.current = false;
    awaitingFrameResultRef.current = false;
    shouldTreatSocketCloseAsErrorRef.current = false;
    player.pause();
    player.currentTime = 0;
  }, [clearCaptureLoop, player]);

  const stopLiveSession = useCallback(async () => {
    logDebug('Stopping VisionCamera live session', {
      sessionId: sessionIdRef.current,
      hasSocket: Boolean(websocketRef.current),
    });

    clearCaptureLoop();
    captureInFlightRef.current = false;
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
        setStreamState('streaming');
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
        setStreamState('error');
      }

      return payloadType;
    },
    [logDebug, releaseFrameBackpressure, updateBufferedMetrics]
  );

  const createLiveSession = useCallback(
    async (targetDance: DanceClass, sessionUuid: string) => {
      setStreamState('connecting');
      logDebug('Creating VisionCamera live session', {
        danceId: targetDance.id,
        danceType: targetDance.genre,
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
            dance_type: targetDance.genre,
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
              captureInFlightRef.current = false;
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

  const captureVisionFrame = useCallback(
    async (camera: Camera): Promise<CapturedVisionFrame> => {
      try {
        const snapshot = await camera.takeSnapshot({
          quality: SNAPSHOT_JPEG_QUALITY,
        });

        return {
          path: snapshot.path,
          width: snapshot.width,
          height: snapshot.height,
          orientation: snapshot.orientation,
          isMirrored: snapshot.isMirrored,
        };
      } catch (snapshotError) {
        logDebug('Vision snapshot failed, falling back to takePhoto', {
          error: snapshotError instanceof Error ? snapshotError.message : String(snapshotError),
        });

        const photo = await camera.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });

        return {
          path: photo.path,
          width: photo.width,
          height: photo.height,
          orientation: photo.orientation,
          isMirrored: photo.isMirrored,
        };
      }
    },
    [logDebug]
  );

  const captureAndSendFrame = useCallback(async () => {
    const camera = cameraRef.current;
    const socket = websocketRef.current;
    const sessionId = sessionIdRef.current;
    const liveSessionUuid = currentUserUuidRef.current;

    if (!camera || !socket || !sessionId || !liveSessionUuid || captureInFlightRef.current || awaitingFrameResultRef.current) {
      return;
    }

    if (socket.readyState !== WebSocket.OPEN || !sessionReadyRef.current) {
      return;
    }

    captureInFlightRef.current = true;
    const frameIndex = frameIndexRef.current;
    let capturedFramePath: string | null = null;

    try {
      const capturedFrame = await captureVisionFrame(camera);
      capturedFramePath = capturedFrame.path;

      if (websocketRef.current !== socket || socket.readyState !== WebSocket.OPEN) {
        logDebug('Skipping VisionCamera frame send because WebSocket is no longer open', { frameIndex });
        return;
      }

      const imageFile = new ExpoFile(normalizeFileUri(capturedFrame.path));
      const imageBytes = await imageFile.bytes();

      if (!imageBytes.length) {
        return;
      }

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

      logDebug('VisionCamera frame capture/send failed', {
        error: error instanceof Error ? error.message : String(error),
        frameIndex,
      });

      if (websocketRef.current === socket && socket.readyState === WebSocket.OPEN) {
        releaseFrameBackpressure();
        setStreamState('error');
        clearCaptureLoop();
      }
    } finally {
      if (capturedFramePath) {
        void FileSystem.deleteAsync(normalizeFileUri(capturedFramePath), { idempotent: true }).catch(() => {
          // Ignore cleanup failures so they do not block the capture loop.
        });
      }
      captureInFlightRef.current = false;
    }
  }, [captureVisionFrame, clearCaptureLoop, liveUserWeightKg, logDebug, releaseFrameBackpressure, updateBufferedTransportStats]);

  const scheduleNextCapture = useCallback(
    (delayMs: number) => {
      if (!captureLoopActiveRef.current) {
        return;
      }

      captureLoopTimeoutRef.current = setTimeout(() => {
        captureLoopTimeoutRef.current = null;

        void (async () => {
          if (!captureLoopActiveRef.current) {
            return;
          }

          const cycleStartedAtMs = getNowMs();
          await captureAndSendFrame();
          const cycleElapsedMs = getNowMs() - cycleStartedAtMs;

          if (!captureLoopActiveRef.current) {
            return;
          }

          const nextDelayMs = Math.max(0, CAPTURE_INTERVAL_MS - cycleElapsedMs);
          scheduleNextCapture(nextDelayMs);
        })();
      }, Math.max(0, Math.round(delayMs)));
    },
    [captureAndSendFrame]
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (phase === 'ready') {
      player.pause();
      player.currentTime = 0;
      clearCaptureLoop();
      return;
    }

    if (phase === 'countdown') {
      player.pause();
      player.currentTime = 0;
      clearCaptureLoop();
      return;
    }

    if (phase === 'paused') {
      player.pause();
      clearCaptureLoop();
      return;
    }

    player.play();

    if (
      hasCameraPermission &&
      cameraReady &&
      sessionReadyRef.current &&
      websocketRef.current &&
      websocketRef.current.readyState === WebSocket.OPEN &&
      !captureLoopActiveRef.current
    ) {
      logDebug('Starting VisionCamera binary JPEG capture loop', {
        captureIntervalMs: CAPTURE_INTERVAL_MS,
        phase,
      });
      captureLoopActiveRef.current = true;
      scheduleNextCapture(0);
    }
  }, [
    cameraReady,
    clearCaptureLoop,
    hasCameraPermission,
    logDebug,
    phase,
    player,
    scheduleNextCapture,
    visible,
  ]);

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
    player,
    cameraRef,
    device,
    format,
    hasCameraPermission,
    isCameraActive: visible && phase !== 'ready',
    cameraReady,
    deviceLabel,
    formatLabel,
    targetFrameRate: TARGET_FRAME_FPS,
    phase,
    countdown,
    streamState,
    metrics,
    transportStats,
    phaseText,
    streamNotice,
    formattedElapsed,
    handleClose,
    handleReset,
    handleStartWorkout,
    handlePauseWorkout,
    handleResumeWorkout,
    handleCameraInitialized,
    handleCameraError,
  };
}
