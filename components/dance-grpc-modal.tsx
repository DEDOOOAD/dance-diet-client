import { colors, radius } from '@/constants/theme';
import { DanceClass } from '@/data/dances';
import {
  endPreviewUploadSession,
  getPreviewGrpcTarget,
  getPreviewGrpcUnavailableMessage,
  isPreviewGrpcAvailable,
  preparePreviewGrpcClient,
  startPreviewUploadSession,
  uploadPreviewFrame,
} from '@/services/grpc-preview-client';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system/legacy';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type DanceGrpcModalProps = {
  dance: DanceClass | null;
  visible: boolean;
  onClose: () => void;
  userId?: string;
};

type PracticePhase = 'ready' | 'countdown' | 'playing' | 'paused';
type StreamState = 'idle' | 'permission' | 'connecting' | 'streaming' | 'error' | 'unsupported';

type LiveMetrics = {
  totalFrames: number;
  elapsedSeconds: number;
  calories: number;
};

const FRAME_INTERVAL_MS = Math.round(1000 / 8);
const DEBUG_PREFIX = '[DanceGrpcModal]';
const DEFAULT_USER_ID = 'user-lee';

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Unknown gRPC error';
}

function parseDanceDurationMinutes(duration: string) {
  const match = duration.match(/\d+/);
  return match ? Math.max(1, Number(match[0])) : 30;
}

function createLocalSessionId(userId: string, danceId: string) {
  return `${userId}-${danceId}-${Date.now()}`;
}

function estimateBase64Bytes(base64: string) {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DanceGrpcModal({
  dance,
  visible,
  onClose,
  userId = DEFAULT_USER_ID,
}: DanceGrpcModalProps) {
  const [phase, setPhase] = useState<PracticePhase>('ready');
  const [countdown, setCountdown] = useState(3);
  const [cameraReady, setCameraReady] = useState(false);
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [metrics, setMetrics] = useState<LiveMetrics>({
    totalFrames: 0,
    elapsedSeconds: 0,
    calories: 0,
  });
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastServerNote, setLastServerNote] = useState<string | null>(null);
  const [lastSessionId, setLastSessionId] = useState<string | null>(null);
  const [lastAckFrameIndex, setLastAckFrameIndex] = useState<number | null>(null);
  const [lastCaptureInfo, setLastCaptureInfo] = useState<string | null>(null);
  const [lastAcceptedAt, setLastAcceptedAt] = useState<string | null>(null);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const cameraRef = useRef<CameraView | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const sessionStartedAtRef = useRef<number | null>(null);
  const frameIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const frameIndexRef = useRef(0);
  const uploadInFlightRef = useRef(false);
  const activeRunIdRef = useRef(0);

  const grpcTarget = useMemo(() => getPreviewGrpcTarget(), []);
  const grpcAvailable = useMemo(() => isPreviewGrpcAvailable(), []);

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

  const stopPreviewSession = useCallback(async () => {
    const activeSessionId = sessionIdRef.current;
    const totalFrames = frameIndexRef.current;

    logDebug('Stopping gRPC upload session', {
      sessionId: activeSessionId,
      totalFrames,
      runId: activeRunIdRef.current,
    });

    clearFrameLoop();
    activeRunIdRef.current += 1;
    uploadInFlightRef.current = false;
    sessionIdRef.current = null;
    sessionStartedAtRef.current = null;

    if (!activeSessionId || !grpcAvailable) {
      return;
    }

    try {
      const response = await endPreviewUploadSession({
        sessionId: activeSessionId,
        totalFrames,
        endedAtMs: Date.now(),
      });

      logDebug('EndSession acknowledged', {
        sessionId: response.sessionId || activeSessionId,
        totalFrames: response.totalFrames,
        acceptedAt: response.acceptedAt,
      });

      if (response.note) {
        setLastServerNote(response.note);
      }

      if (response.acceptedAt) {
        setLastAcceptedAt(response.acceptedAt);
      }
    } catch (error) {
      logDebug('EndSession failed', {
        sessionId: activeSessionId,
        error: toErrorMessage(error),
      });
    }
  }, [clearFrameLoop, grpcAvailable, logDebug]);

  const resetWorkoutState = useCallback(() => {
    clearFrameLoop();
    setPhase('ready');
    setCountdown(3);
    setCameraReady(false);
    setStreamState(grpcAvailable ? 'idle' : 'unsupported');
    setMetrics({ totalFrames: 0, elapsedSeconds: 0, calories: 0 });
    setLastError(null);
    setLastServerNote(null);
    setLastSessionId(null);
    setLastAckFrameIndex(null);
    setLastCaptureInfo(null);
    setLastAcceptedAt(null);
    frameIndexRef.current = 0;
    uploadInFlightRef.current = false;
    player.pause();
    player.currentTime = 0;
  }, [clearFrameLoop, grpcAvailable, player]);

  useEffect(() => {
    if (!visible) {
      void stopPreviewSession();
      resetWorkoutState();
      setCameraReady(false);
    }
  }, [resetWorkoutState, stopPreviewSession, visible]);

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

  const captureAndUploadFrame = useCallback(async () => {
    if (
      !dance ||
      !cameraRef.current ||
      !cameraReady ||
      !sessionIdRef.current ||
      !sessionStartedAtRef.current ||
      uploadInFlightRef.current
    ) {
      return;
    }

    const runId = activeRunIdRef.current;
    const frameIndex = frameIndexRef.current;
    const startedAt = sessionStartedAtRef.current;
    const durationMinutes = parseDanceDurationMinutes(dance.duration);

    uploadInFlightRef.current = true;

    try {
      const picture = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.2,
        skipProcessing: true,
        shutterSound: false,
      });

      if (!picture.base64) {
        throw new Error('Camera did not return base64 image data.');
      }

      const captureWidth = Number(picture.width ?? 0);
      const captureHeight = Number(picture.height ?? 0);
      const approximateBytes = estimateBase64Bytes(picture.base64);

      // UploadFrameRequest proto 매핑:
      // 1. session_id   -> 이 프레임이 속한 운동 업로드 세션 id
      // 2. frame_index  -> 0부터 시작하는 캡처 프레임 순번
      // 3. timestamp_ms -> 프레임을 찍은 시점의 로컬 타임스탬프
      // 4. image_base64 -> 실제 JPEG 카메라 프레임 payload
      // 5. width        -> 캡처 프레임 가로 픽셀 수
      // 6. height       -> 캡처 프레임 세로 픽셀 수
      // 7. mime_type    -> 전송하는 이미지 인코딩 형식
      const response = await uploadPreviewFrame({
        sessionId: sessionIdRef.current,
        frameIndex,
        timestampMs: Date.now(),
        imageBase64: picture.base64,
        width: captureWidth,
        height: captureHeight,
        mimeType: 'image/jpeg',
      });

      if (runId !== activeRunIdRef.current) {
        return;
      }

      const elapsedSeconds = (Date.now() - startedAt) / 1000;
      const estimatedCalories = (elapsedSeconds / (durationMinutes * 60)) * dance.kcal;

      frameIndexRef.current += 1;
      setMetrics({
        totalFrames: frameIndex + 1,
        elapsedSeconds,
        calories: estimatedCalories,
      });
      setLastAckFrameIndex(response.frameIndex);
      setLastServerNote(response.note || `UploadFrame acknowledged for frame ${frameIndex}.`);
      setLastAcceptedAt(response.acceptedAt || null);
      setLastCaptureInfo(`${captureWidth} x ${captureHeight} / ${formatBytes(approximateBytes)}`);
      setLastError(null);
      setStreamState('streaming');

      if (frameIndex === 0 || frameIndex % 20 === 0) {
        logDebug('UploadFrame acknowledged', {
          frameIndex,
          captureWidth,
          captureHeight,
          approximateBytes,
          acceptedAt: response.acceptedAt,
        });
      }

      if (picture.uri) {
        await FileSystem.deleteAsync(picture.uri, { idempotent: true });
      }
    } catch (error) {
      if (runId !== activeRunIdRef.current) {
        return;
      }

      const message = toErrorMessage(error);
      logDebug('UploadFrame failed', {
        frameIndex,
        error: message,
      });
      setLastError(message);
      setStreamState('error');
      clearFrameLoop();
    } finally {
      if (runId === activeRunIdRef.current) {
        uploadInFlightRef.current = false;
      }
    }
  }, [cameraReady, clearFrameLoop, dance, logDebug]);

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

    if (cameraPermission?.granted && cameraReady && streamState === 'streaming' && !frameIntervalRef.current) {
      logDebug('Starting gRPC upload loop', {
        frameIntervalMs: FRAME_INTERVAL_MS,
      });

      frameIntervalRef.current = setInterval(() => {
        void captureAndUploadFrame();
      }, FRAME_INTERVAL_MS);
    }
  }, [
    cameraPermission?.granted,
    cameraReady,
    captureAndUploadFrame,
    clearFrameLoop,
    logDebug,
    phase,
    player,
    streamState,
    visible,
  ]);

  const startWorkout = async () => {
    if (!dance) {
      return;
    }

    logDebug('Start gRPC workout pressed', {
      danceId: dance.id,
      grpcTarget,
      grpcAvailable,
    });

    await stopPreviewSession();
    resetWorkoutState();

    if (!grpcAvailable) {
      const message = getPreviewGrpcUnavailableMessage();
      setLastError(message);
      setStreamState('unsupported');
      return;
    }

    if (!cameraPermission?.granted) {
      const response = await requestCameraPermission();
      logDebug('Camera permission requested', { granted: response.granted });

      if (!response.granted) {
        setLastError('Camera permission is required before gRPC frame uploads can start.');
        setStreamState('permission');
        return;
      }
    }

    const runId = activeRunIdRef.current;
    const fallbackSessionId = createLocalSessionId(userId, dance.id);
    const startedAtMs = Date.now();

    setStreamState('connecting');
    setLastError(null);

    try {
      preparePreviewGrpcClient();

      // StartSessionRequest proto 매핑:
      // 1. user_id         -> 앱 사용자 id
      // 2. dance_type      -> 선택한 춤 장르
      // 3. content_id      -> 선택한 춤 콘텐츠 id
      // 4. client_name     -> 모바일 앱 클라이언트 식별자
      // 5. device_platform -> ios / android / web
      // 6. started_at_ms   -> 운동 시작 시점의 로컬 타임스탬프
      const sessionResponse = await startPreviewUploadSession({
        userId,
        danceType: dance.genre,
        contentId: dance.id,
        clientName: 'dance-diet-mobile',
        devicePlatform: Platform.OS,
        startedAtMs,
      });

      if (runId !== activeRunIdRef.current) {
        return;
      }

      const resolvedSessionId = sessionResponse.sessionId || fallbackSessionId;

      sessionIdRef.current = resolvedSessionId;
      sessionStartedAtRef.current = startedAtMs;
      frameIndexRef.current = 0;

      setLastSessionId(resolvedSessionId);
      setLastServerNote(sessionResponse.note || 'StartSession acknowledged. UploadFrame requests are ready.');
      setLastAcceptedAt(sessionResponse.acceptedAt || null);
      setMetrics({ totalFrames: 0, elapsedSeconds: 0, calories: 0 });
      setCountdown(3);
      setStreamState('streaming');
      setPhase('countdown');

      logDebug('StartSession acknowledged', {
        sessionId: resolvedSessionId,
        acceptedAt: sessionResponse.acceptedAt,
      });
    } catch (error) {
      if (runId !== activeRunIdRef.current) {
        return;
      }

      const message = toErrorMessage(error);
      logDebug('StartSession failed', { error: message });
      setLastError(message);
      setStreamState(message === getPreviewGrpcUnavailableMessage() ? 'unsupported' : 'error');
    }
  };

  const handleReset = () => {
    logDebug('Workout reset');
    void stopPreviewSession();
    resetWorkoutState();
  };

  const handleClose = () => {
    logDebug('Workout modal closed');
    void stopPreviewSession();
    resetWorkoutState();
    onClose();
  };

  const phaseText = useMemo(() => {
    switch (phase) {
      case 'ready':
        return 'This app-first gRPC flow uses StartSession, UploadFrame, and EndSession unary RPCs. Each UploadFrame call carries the actual camera image as image_base64.';
      case 'countdown':
        return `Starting in ${countdown}. StartSession has already been sent, and UploadFrame requests begin after the countdown.`;
      case 'playing':
        return 'Camera frames are being captured on a timed loop and uploaded through gRPC as image_base64 payloads.';
      case 'paused':
        return 'Frame uploads are paused. The active gRPC session stays open until you stop or close the modal.';
    }
  }, [countdown, phase]);

  const streamNotice = useMemo(() => {
    switch (streamState) {
      case 'permission':
        return 'Camera permission is required before the gRPC upload loop can start.';
      case 'connecting':
        return `Opening a native gRPC channel to ${grpcTarget} and sending StartSession.`;
      case 'streaming':
        return `Connected to ${grpcTarget}. UploadFrame requests are active.`;
      case 'unsupported':
        return getPreviewGrpcUnavailableMessage();
      case 'error':
        return lastError ?? 'gRPC upload failed. Check the device build and the server logs.';
      default:
        return grpcAvailable
          ? `Ready to target ${grpcTarget}. Start to send image frames through gRPC.`
          : getPreviewGrpcUnavailableMessage();
    }
  }, [grpcAvailable, grpcTarget, lastError, streamState]);

  const helperText = useMemo(() => {
    if (lastServerNote) {
      return lastServerNote;
    }

    return 'UploadFrame payload fields: session_id, frame_index, timestamp_ms, image_base64, width, height, mime_type.';
  }, [lastServerNote]);

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
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{dance.title}</Text>
              <Text style={styles.subtitle}>
                {dance.instructor} / {dance.duration}
              </Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.85}>
              <Ionicons name="close" size={24} color={colors.text1} />
            </TouchableOpacity>
          </View>

          <View style={styles.playerCard}>
            <VideoView player={player} style={styles.previewVideo} nativeControls={false} contentFit="cover" />

            <View style={styles.overlayBadge}>
              <Ionicons name="radio-button-on" size={18} color="#fff" />
              <Text style={styles.overlayBadgeText}>gRPC image upload</Text>
            </View>

            {phase === 'countdown' && (
              <View style={styles.countdownOverlay}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
                <Text style={styles.countdownText}>UploadFrame starts after countdown</Text>
              </View>
            )}

            {phase === 'paused' && (
              <View style={styles.pauseOverlay}>
                <Ionicons name="pause-circle" size={48} color="#fff" />
                <Text style={styles.pauseText}>Paused</Text>
              </View>
            )}
          </View>

          <View style={styles.infoPanel}>
            <Text style={styles.panelTitle}>gRPC Upload Flow</Text>
            <Text style={styles.panelText}>{phaseText}</Text>

            <View style={styles.noticeRow}>
              <Ionicons
                name={streamState === 'streaming' ? 'radio-button-on' : 'cloud-outline'}
                size={16}
                color={colors.teal}
              />
              <Text style={styles.noticeText}>{streamNotice}</Text>
            </View>

            <View style={styles.helperCard}>
              <Text style={styles.helperTitle}>Proto Payload</Text>
              <Text style={styles.helperText}>{helperText}</Text>
              <Text style={styles.helperMeta}>Target: {grpcTarget}</Text>
              <Text style={styles.helperMeta}>Session: {lastSessionId ?? 'waiting for StartSession'}</Text>
              <Text style={styles.helperMeta}>Last ack frame: {lastAckFrameIndex ?? 'waiting for UploadFrame'}</Text>
              <Text style={styles.helperMeta}>Last capture: {lastCaptureInfo ?? 'waiting for camera frame'}</Text>
              <Text style={styles.helperMeta}>Accepted at: {lastAcceptedAt ?? 'waiting for response'}</Text>
            </View>

            <View style={styles.metricRow}>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Frames</Text>
                <Text style={styles.metricValue}>{metrics.totalFrames}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Elapsed</Text>
                <Text style={styles.metricValue}>{formattedElapsed}</Text>
              </View>
              <View style={styles.metricCard}>
                <Text style={styles.metricLabel}>Calories*</Text>
                <Text style={styles.metricValue}>{metrics.calories.toFixed(1)}</Text>
              </View>
            </View>

            <Text style={styles.metricFootnote}>
              * Calories are still estimated locally. This gRPC upload contract focuses on sending image frames, not workout scoring.
            </Text>
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={handleReset}>
              <Ionicons name="refresh-outline" size={18} color={colors.text1} />
              <Text style={styles.secondaryButtonText}>Reset</Text>
            </TouchableOpacity>

            {phase === 'ready' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: dance.color }]}
                activeOpacity={0.85}
                onPress={() => void startWorkout()}>
                <Ionicons name="play-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Start</Text>
              </TouchableOpacity>
            )}

            {phase === 'countdown' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.text3 }]}
                activeOpacity={0.85}
                onPress={handleReset}>
                <Ionicons name="stop-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Stop</Text>
              </TouchableOpacity>
            )}

            {phase === 'playing' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: dance.color }]}
                activeOpacity={0.85}
                onPress={() => setPhase('paused')}>
                <Ionicons name="pause-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Pause</Text>
              </TouchableOpacity>
            )}

            {phase === 'paused' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: dance.color }]}
                activeOpacity={0.85}
                onPress={() => setPhase('playing')}>
                <Ionicons name="play-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>Resume</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

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
                setLastError(event.message);
                setStreamState('error');
              }}
              onCameraReady={() => {
                logDebug('Camera ready');
                setCameraReady(true);
              }}
            />
          </View>
        )}
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
  helperCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 12,
    gap: 4,
  },
  helperTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text1,
  },
  helperText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
  },
  helperMeta: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.text2,
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
  metricFootnote: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.text2,
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
