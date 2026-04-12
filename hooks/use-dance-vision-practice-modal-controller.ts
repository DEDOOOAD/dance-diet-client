import { DanceClass } from '@/data/dances';
import { buildLiveBinaryFramePacket } from '@/services/live-frame-binary-protocol';
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

const DEBUG_PREFIX = '[DanceVisionPracticeModal]';
const REQUEST_TIMEOUT_MS = 8000;
const TARGET_FRAME_FPS = 16;
const CAPTURE_INTERVAL_MS = Math.round(1000 / TARGET_FRAME_FPS);
const UI_UPDATE_INTERVAL_MS = 250;
const SNAPSHOT_JPEG_QUALITY = 60;
const TARGET_VIDEO_RESOLUTION = { width: 320, height: 240 } as const;

function getNowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function getHttpBaseUrl() {
  return getGeneralServerHttpBaseUrl();
}

function resetMetricsState(): LiveMetrics {
  return {
    totalFrames: 0,
    elapsedSeconds: 0,
    calories: 0,
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
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
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

function formatPayloadBytes(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${bytes} B`;
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

  const cameraRef = useRef<Camera | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const captureLoopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captureLoopActiveRef = useRef(false);
  const frameIndexRef = useRef(0);
  const captureInFlightRef = useRef(false);
  const shouldTreatSocketCloseAsErrorRef = useRef(false);
  const bufferedMetricsRef = useRef<LiveMetrics>(resetMetricsState());
  const bufferedTransportStatsRef = useRef<TransportStats>(resetTransportState());
  const uiFlushPendingRef = useRef(false);

  const player = useVideoPlayer(require('@/assets/images/dance.mp4'), (videoPlayer) => {
    videoPlayer.loop = true;
  });

  const logDebug = useCallback((message: string, extra?: Record<string, unknown>) => {
    if (extra) {
      console.log(`${DEBUG_PREFIX} ${message}`, extra);
      return;
    }

    console.log(`${DEBUG_PREFIX} ${message}`);
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

  const handleServerMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const payload = JSON.parse(String(event.data));

        if (payload.type === 'session_ready') {
          setStreamState('streaming');
          return;
        }

        if (payload.type === 'frame_ack') {
          const totalFrames = Number(payload.total_frames ?? 0);
          const elapsedSeconds = Number(payload.elapsed_seconds ?? 0);
          const calories = Number(payload.calories ?? payload.total_calories ?? 0);

          updateBufferedMetrics({
            totalFrames,
            elapsedSeconds,
            calories,
          });
          setStreamState('streaming');
        }
      } catch {
        logDebug('Failed to parse server message');
        setStreamState('error');
      }
    },
    [logDebug, updateBufferedMetrics]
  );

  const createLiveSession = useCallback(
    async (targetDance: DanceClass) => {
      setStreamState('connecting');
      logDebug('Creating VisionCamera live session', {
        danceId: targetDance.id,
        danceType: targetDance.genre,
        serverBaseUrl: getHttpBaseUrl(),
      });

      try {
        const response = await fetchWithTimeout(getGeneralServerLiveSessionStartEndpoint(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: 'user-lee',
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
          const timeout = setTimeout(() => {
            socket.close();
            logDebug('VisionCamera WebSocket connection timed out', { sessionId, socketUrl });
            reject(new Error('socket_timeout'));
          }, 5000);

          socket.onopen = () => {
            clearTimeout(timeout);
            websocketRef.current = socket;
            sessionIdRef.current = sessionId;
            shouldTreatSocketCloseAsErrorRef.current = true;
            setStreamState('streaming');
            socket.onmessage = handleServerMessage;
            socket.onerror = () => {
              logDebug('VisionCamera WebSocket runtime error', { sessionId });
              if (websocketRef.current === socket) {
                setStreamState('error');
              }
            };
            socket.onclose = () => {
              const wasActiveSocket = websocketRef.current === socket;
              logDebug('VisionCamera WebSocket closed', { sessionId, wasActiveSocket });

              if (!wasActiveSocket) {
                return;
              }

              websocketRef.current = null;
              sessionIdRef.current = null;
              captureInFlightRef.current = false;
              clearCaptureLoop();

              if (shouldTreatSocketCloseAsErrorRef.current) {
                shouldTreatSocketCloseAsErrorRef.current = false;
                setStreamState('error');
              }
            };
            resolve();
          };

          socket.onerror = () => {
            clearTimeout(timeout);
            reject(new Error('socket_error'));
          };
        });

        updateBufferedMetrics(resetMetricsState(), true);
        updateBufferedTransportStats(() => resetTransportState(), true);
        frameIndexRef.current = 0;
        logDebug('VisionCamera live session ready for binary JPEG frame uploads', { sessionId });
        return true;
      } catch (error) {
        logDebug('Failed to create VisionCamera live session', {
          error: error instanceof Error ? error.message : String(error),
        });
        setStreamState('error');
        return false;
      }
    },
    [clearCaptureLoop, handleServerMessage, logDebug, updateBufferedMetrics, updateBufferedTransportStats]
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

    if (!camera || !socket || !sessionId || captureInFlightRef.current) {
      return;
    }

    if (socket.readyState !== WebSocket.OPEN) {
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

      const packet = buildLiveBinaryFramePacket(
        {
          type: 'frame_binary',
          version: 1,
          session_id: sessionId,
          frame_index: frameIndex,
          captured_at: Date.now(),
          width: capturedFrame.width,
          height: capturedFrame.height,
          mime_type: 'image/jpeg',
          byte_length: imageBytes.length,
          orientation: capturedFrame.orientation,
          is_mirrored: capturedFrame.isMirrored,
          source_timestamp: Date.now(),
        },
        imageBytes
      );
      const payloadBytes = packet.byteLength;
      socket.send(packet);
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
        setStreamState('error');
        clearCaptureLoop();
      }
    } finally {
      if (capturedFramePath) {
        await FileSystem.deleteAsync(normalizeFileUri(capturedFramePath), { idempotent: true });
      }
      captureInFlightRef.current = false;
    }
  }, [captureVisionFrame, clearCaptureLoop, logDebug, updateBufferedTransportStats]);

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

    const connected = await createLiveSession(dance);
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

  const lastPayloadLabel = useMemo(() => {
    return formatPayloadBytes(transportStats.lastPayloadBytes);
  }, [transportStats.lastPayloadBytes]);

  const averagePayloadLabel = useMemo(() => {
    return formatPayloadBytes(Math.round(transportStats.averagePayloadBytes));
  }, [transportStats.averagePayloadBytes]);

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
    lastPayloadLabel,
    averagePayloadLabel,
    handleClose,
    handleReset,
    handleStartWorkout,
    handlePauseWorkout,
    handleResumeWorkout,
    handleCameraInitialized,
    handleCameraError,
  };
}
