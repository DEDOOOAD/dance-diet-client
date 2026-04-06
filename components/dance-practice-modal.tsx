import { colors, radius } from '@/constants/theme';
import { DanceClass } from '@/data/dances';
import {
  getGeneralServerHttpBaseUrl,
  resolveGeneralServerLiveSessionWsUrl,
} from '@/services/server-config';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type DancePracticeModalProps = {
  dance: DanceClass | null;
  visible: boolean;
  onClose: () => void;
};

type PracticePhase = 'ready' | 'countdown' | 'playing' | 'paused';
type StreamState = 'idle' | 'permission' | 'connecting' | 'streaming' | 'error';

type LiveMetrics = {
  totalFrames: number;
  elapsedSeconds: number;
  calories: number;
};

type SessionStartResponse = {
  session_id: string;
  ws_url?: string;
};

const FRAME_INTERVAL_MS = Math.round(1000 / 8);
const DEBUG_PREFIX = '[DancePracticeModal]';
const REQUEST_TIMEOUT_MS = 8000;

function getHttpBaseUrl() {
  return getGeneralServerHttpBaseUrl();
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

export function DancePracticeModal({ dance, visible, onClose }: DancePracticeModalProps) {
  const [phase, setPhase] = useState<PracticePhase>('ready');
  const [countdown, setCountdown] = useState(3);
  const [cameraReady, setCameraReady] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [metrics, setMetrics] = useState<LiveMetrics>({
    totalFrames: 0,
    elapsedSeconds: 0,
    calories: 0,
  });
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIndexRef = useRef(0);
  const captureInFlightRef = useRef(false);

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

  const clearFrameLoop = useCallback(() => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
      logDebug('Frame loop cleared');
    }
  }, [logDebug]);

  const resetWorkoutState = useCallback(() => {
    clearFrameLoop();
    setPhase('ready');
    setCountdown(3);
    setStreamState('idle');
    setMetrics({ totalFrames: 0, elapsedSeconds: 0, calories: 0 });
    frameIndexRef.current = 0;
    captureInFlightRef.current = false;
    player.pause();
    player.currentTime = 0;
  }, [clearFrameLoop, player]);

  const stopLiveSession = useCallback(async () => {
    logDebug('Stopping live session', {
      sessionId: sessionIdRef.current,
      hasSocket: Boolean(websocketRef.current),
    });
    clearFrameLoop();
    captureInFlightRef.current = false;

    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }

    if (sessionIdRef.current) {
      const activeSessionId = sessionIdRef.current;
      sessionIdRef.current = null;

      try {
        await fetchWithTimeout(`${getHttpBaseUrl()}/api/live/session/end`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ session_id: activeSessionId }),
        });
        logDebug('Live session end request sent', { sessionId: activeSessionId });
      } catch {
        logDebug('Live session end request failed', { sessionId: activeSessionId });
      }
    }
  }, [clearFrameLoop, logDebug]);

  useEffect(() => {
    if (!visible) {
      resetWorkoutState();
      setCameraReady(false);
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
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, phase]);

  const handleServerMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const payload = JSON.parse(String(event.data));
        logDebug('Server message received', { type: payload.type, payload });

        if (payload.type === 'session_ready') {
          setStreamState('streaming');
          return;
        }

        if (payload.type === 'frame_ack') {
          const totalFrames = Number(payload.total_frames ?? 0);
          const elapsedSeconds = Number(payload.elapsed_seconds ?? 0);
          const calories = Number(payload.calories ?? payload.total_calories ?? 0);

          setMetrics({
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
    [logDebug]
  );

  const createLiveSession = useCallback(
    async (targetDance: DanceClass) => {
      setStreamState('connecting');
      logDebug('Creating live session', {
        danceId: targetDance.id,
        danceType: targetDance.genre,
        serverBaseUrl: getHttpBaseUrl(),
      });

      try {
        const response = await fetchWithTimeout(`${getHttpBaseUrl()}/api/live/session/start`, {
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
        logDebug('Live session start response received', {
          ok: response.ok,
          status: response.status,
        });

        if (!response.ok) {
          logDebug('Live session start request failed', { status: response.status });
          throw new Error('session_start_failed');
        }

        const payload = (await response.json()) as SessionStartResponse;
        const sessionId = String(payload.session_id);
        const socketUrl = normalizeWsUrl(payload.ws_url, sessionId);
        logDebug('Live session created', { sessionId, socketUrl });

        await new Promise<void>((resolve, reject) => {
          const socket = new WebSocket(socketUrl);
          const timeout = setTimeout(() => {
            socket.close();
            logDebug('WebSocket connection timed out', { sessionId, socketUrl });
            reject(new Error('socket_timeout'));
          }, 5000);

          socket.onopen = () => {
            clearTimeout(timeout);
            websocketRef.current = socket;
            sessionIdRef.current = sessionId;
            socket.onmessage = handleServerMessage;
            socket.onerror = () => {
              logDebug('WebSocket runtime error', { sessionId });
              setStreamState('error');
            };
            socket.onclose = () => {
              logDebug('WebSocket closed', { sessionId });
              websocketRef.current = null;
            };
            logDebug('WebSocket opened', { sessionId });
            resolve();
          };

          socket.onerror = () => {
            clearTimeout(timeout);
            logDebug('WebSocket failed to open', { sessionId, socketUrl });
            reject(new Error('socket_error'));
          };
        });

        setMetrics({ totalFrames: 0, elapsedSeconds: 0, calories: 0 });
        frameIndexRef.current = 0;
        logDebug('Live session ready for streaming', { sessionId });
        return true;
      } catch (error) {
        logDebug('Failed to create live session', {
          error: error instanceof Error ? error.message : String(error),
        });
        setStreamState('error');
        return false;
      }
    },
    [handleServerMessage, logDebug]
  );

  const captureAndSendFrame = useCallback(async () => {
    if (!cameraRef.current || !websocketRef.current || captureInFlightRef.current) {
      return;
    }

    if (websocketRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    captureInFlightRef.current = true;

    try {
      const picture = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.2,
        skipProcessing: true,
        shutterSound: false,
      });

      if (picture.base64) {
        if (frameIndexRef.current === 0 || frameIndexRef.current % 30 === 0) {
          logDebug('Sending frame', {
            frameIndex: frameIndexRef.current,
            width: picture.width,
            height: picture.height,
          });
        }

        websocketRef.current.send(
          JSON.stringify({
            type: 'frame',
            frame_index: frameIndexRef.current,
            captured_at: Date.now(),
            image_base64: picture.base64,
            width: picture.width,
            height: picture.height,
          })
        );
        frameIndexRef.current += 1;
      }

      if (picture.uri) {
        await FileSystem.deleteAsync(picture.uri, { idempotent: true });
      }
    } catch (error) {
      logDebug('Frame capture/send failed', {
        error: error instanceof Error ? error.message : String(error),
        frameIndex: frameIndexRef.current,
      });
      setStreamState('error');
      clearFrameLoop();
    } finally {
      captureInFlightRef.current = false;
    }
  }, [clearFrameLoop, logDebug]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (phase === 'ready') {
      player.pause();
      player.currentTime = 0;
      clearFrameLoop();
      return;
    }

    if (phase === 'countdown') {
      player.pause();
      player.currentTime = 0;
      clearFrameLoop();
      return;
    }

    if (phase === 'paused') {
      player.pause();
      clearFrameLoop();
      return;
    }

    player.play();

    if (
      cameraPermission?.granted &&
      cameraReady &&
      websocketRef.current &&
      websocketRef.current.readyState === WebSocket.OPEN &&
      !frameIntervalRef.current
    ) {
      logDebug('Starting frame loop', {
        frameIntervalMs: FRAME_INTERVAL_MS,
        phase,
      });
      frameIntervalRef.current = setInterval(() => {
        void captureAndSendFrame();
      }, FRAME_INTERVAL_MS);
    }
  }, [cameraPermission?.granted, cameraReady, captureAndSendFrame, clearFrameLoop, logDebug, phase, player, visible]);

  const startWorkout = async () => {
    if (!dance) {
      return;
    }

    logDebug('Start workout pressed', {
      danceId: dance.id,
      platform: Platform.OS,
      cameraPermission: cameraPermission?.granted ?? null,
    });

    await stopLiveSession();

    if (!cameraPermission?.granted) {
      const response = await requestCameraPermission();
      logDebug('Camera permission requested', { granted: response.granted });
      if (!response.granted) {
        setStreamState('permission');
        return;
      }
    }

    const connected = await createLiveSession(dance);
    if (!connected) {
      return;
    }

    setCountdown(3);
    setPhase('countdown');
  };

  const handleReset = () => {
    logDebug('Workout reset');
    resetWorkoutState();
    void stopLiveSession();
  };

  const handleClose = () => {
    logDebug('Workout modal closed');
    resetWorkoutState();
    void stopLiveSession();
    onClose();
  };

  const phaseText = useMemo(() => {
    switch (phase) {
      case 'ready':
        return '시작을 누르면 3초 카운트다운 뒤에 가이드 영상이 재생되고, 카메라 프레임이 최대 8fps로 서버에 전송됩니다.';
      case 'countdown':
        return `${countdown}초 뒤에 운동이 시작됩니다. 자세를 미리 맞춰 주세요.`;
      case 'playing':
        return '실시간 분석이 진행 중입니다. 카메라 프레임을 서버로 보내고, 응답에 따라 측정값이 갱신됩니다.';
      case 'paused':
        return '운동이 일시정지되었습니다. 프레임 전송도 잠시 멈춘 상태입니다.';
    }
  }, [countdown, phase]);

  const streamNotice = useMemo(() => {
    switch (streamState) {
      case 'permission':
        return '실시간 프레임 전송을 시작하려면 카메라 권한이 필요합니다.';
      case 'connecting':
        return '라이브 세션 서버에 연결하는 중입니다.';
      case 'streaming':
        return '실시간 프레임 전송이 정상적으로 진행 중입니다.';
      case 'error':
        return '서버 연결 또는 프레임 업로드 중 문제가 발생했습니다.';
      default:
        return cameraPermission?.granted
          ? '카메라 권한이 준비되었습니다. 운동을 시작하면 숨겨진 캡처 카메라가 함께 동작합니다.'
          : '운동 시작 전에 카메라 권한을 먼저 확인합니다.';
    }
  }, [cameraPermission?.granted, streamState]);

  const formattedElapsed = useMemo(() => {
    const totalSeconds = Math.max(0, Math.floor(metrics.elapsedSeconds));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [metrics.elapsedSeconds]);

  if (!dance) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        {cameraPermission?.granted && (
          <View style={styles.hiddenCameraWrap} pointerEvents="none">
            <CameraView
              ref={cameraRef}
              style={styles.hiddenCamera}
              facing="front"
              mirror
              animateShutter={false}
              active={visible && phase !== 'ready'}
              onMountError={(event) => {
                logDebug('Camera mount error', { message: event.message });
                setStreamState('error');
              }}
              onCameraReady={() => {
                logDebug('Camera ready');
                setCameraReady(true);
              }}
            />
          </View>
        )}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{dance.title}</Text>
              <Text style={styles.subtitle}>
                {dance.instructor} · {dance.duration}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.85}>
              <Ionicons name="close" size={24} color={colors.text1} />
            </TouchableOpacity>
          </View>

          <View style={styles.playerCard}>
            <VideoView player={player} style={styles.previewVideo} nativeControls={false} contentFit="cover" />

            <View style={styles.overlayBadge}>
              <Ionicons name="play-circle" size={22} color="#fff" />
              <Text style={styles.overlayBadgeText}>가이드 영상</Text>
            </View>

            {phase === 'countdown' && (
              <View style={styles.countdownOverlay}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
                <Text style={styles.countdownText}>운동이 곧 시작됩니다</Text>
              </View>
            )}

            {phase === 'paused' && (
              <View style={styles.pauseOverlay}>
                <Ionicons name="pause-circle" size={48} color="#fff" />
                <Text style={styles.pauseText}>일시정지</Text>
              </View>
            )}
          </View>

          <View style={styles.infoPanel}>
            <Text style={styles.panelTitle}>실시간 분석</Text>
            <Text style={styles.panelText}>{phaseText}</Text>

            <View style={styles.noticeRow}>
              <Ionicons
                name={streamState === 'streaming' ? 'radio-button-on' : 'videocam-outline'}
                size={16}
                color={colors.teal}
              />
              <Text style={styles.noticeText}>{streamNotice}</Text>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>전송 프레임</Text>
                <Text style={styles.metricValue}>{metrics.totalFrames}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>운동 시간</Text>
                <Text style={styles.metricValue}>{formattedElapsed}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>예상 칼로리</Text>
                <Text style={styles.metricValue}>{metrics.calories.toFixed(1)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={handleReset}>
              <Ionicons name="refresh-outline" size={18} color={colors.text1} />
              <Text style={styles.secondaryButtonText}>다시보기</Text>
            </TouchableOpacity>

            {phase === 'ready' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: dance.color }]}
                activeOpacity={0.85}
                onPress={() => void startWorkout()}>
                <Ionicons name="play-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>시작</Text>
              </TouchableOpacity>
            )}

            {phase === 'countdown' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.text3 }]}
                activeOpacity={0.85}
                onPress={handleReset}>
                <Ionicons name="stop-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>취소</Text>
              </TouchableOpacity>
            )}

            {phase === 'playing' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: dance.color }]}
                activeOpacity={0.85}
                onPress={() => setPhase('paused')}>
                <Ionicons name="pause-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>일시정지</Text>
              </TouchableOpacity>
            )}

            {phase === 'paused' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: dance.color }]}
                activeOpacity={0.85}
                onPress={() => setPhase('playing')}>
                <Ionicons name="play-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>다시 시작</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  hiddenCameraWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 1,
    height: 1,
    opacity: 0,
  },
  hiddenCamera: {
    width: 1,
    height: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text2,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playerCard: {
    height: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  previewVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(13, 13, 15, 0.68)',
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  overlayBadgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 13, 15, 0.52)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 78,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
  },
  countdownText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 13, 15, 0.44)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  pauseText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  infoPanel: {
    marginTop: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    gap: 10,
  },
  panelTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
  },
  panelText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text2,
  },
  noticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    color: colors.teal,
    fontWeight: '600',
  },
  metricRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 12,
  },
  metricLabel: {
    fontSize: 11,
    color: colors.text2,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text1,
  },
  bottomBar: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  secondaryButton: {
    flex: 0.38,
    height: 54,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButtonText: {
    color: colors.text1,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryButton: {
    flex: 0.62,
    height: 54,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
