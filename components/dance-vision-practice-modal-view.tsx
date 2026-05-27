import { YoutubeEmbedPlayer } from '@/components/youtube-embed-player';
import { colors, radius } from '@/constants/theme';
import { DanceClass } from '@/data/dances';
import {
  LiveMetrics,
  PracticePhase,
  StreamState,
  TransportStats,
} from '@/hooks/use-dance-vision-practice-modal-controller';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Image, Linking, Modal, NativeModules, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, type CameraDevice, type CameraDeviceFormat, type ReadonlyFrameProcessor } from 'react-native-vision-camera';

type DanceVisionPracticeModalViewProps = {
  dance: DanceClass | null;
  visible: boolean;
  cameraRef: React.RefObject<Camera | null>;
  device: CameraDevice | undefined;
  format: CameraDeviceFormat | undefined;
  hasCameraPermission: boolean;
  isCameraActive: boolean;
  frameProcessor: ReadonlyFrameProcessor;
  targetFrameRate: number;
  phase: PracticePhase;
  countdown: number;
  streamState: StreamState;
  metrics: LiveMetrics;
  transportStats: TransportStats;
  formattedElapsed: string;
  referenceVideoUrl: string | null;
  handleClose: () => void;
  handleReset: () => void;
  handleStartWorkout: () => void;
  handlePauseWorkout: () => void;
  handleResumeWorkout: () => void;
  handleCameraInitialized: () => void;
  handleCameraError: (message: string) => void;
};

type MetricCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  color: string;
};

function MetricCard({ icon, label, value, color }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricCardTopRow}>
        <View style={[styles.metricIconWrap, { backgroundColor: `${color}20` }]}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function getPhaseLabel(phase: PracticePhase) {
  switch (phase) {
    case 'countdown':
      return '카운트다운';
    case 'playing':
      return '재생 중';
    case 'paused':
      return '일시정지';
    case 'ready':
    default:
      return '준비';
  }
}

function getPhaseAccentColor(phase: PracticePhase, danceColor: string) {
  switch (phase) {
    case 'countdown':
      return colors.accent2;
    case 'playing':
      return danceColor;
    case 'paused':
      return colors.purple;
    case 'ready':
    default:
      return colors.teal;
  }
}

function extractYoutubeVideoId(videoId: string | null | undefined, youtubeUrl: string | null | undefined) {
  if (videoId && videoId.trim()) {
    return videoId.trim();
  }

  if (!youtubeUrl || !youtubeUrl.trim()) {
    return null;
  }

  try {
    const parsedUrl = new URL(youtubeUrl.trim());
    const host = parsedUrl.hostname.replace(/^www\./, '');

    if (host === 'youtu.be') {
      return parsedUrl.pathname.split('/').filter(Boolean)[0] ?? null;
    }

    if (host.endsWith('youtube.com')) {
      if (parsedUrl.pathname === '/watch') {
        return parsedUrl.searchParams.get('v');
      }

      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      if (pathSegments[0] === 'embed' || pathSegments[0] === 'shorts') {
        return pathSegments[1] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
}

function buildYoutubeThumbnailUrl(dance: DanceClass, referenceVideoUrl: string | null) {
  if (dance.thumbnailUrl && dance.thumbnailUrl.trim()) {
    return dance.thumbnailUrl.trim();
  }

  const resolvedVideoId = extractYoutubeVideoId(dance.videoId, referenceVideoUrl);
  if (!resolvedVideoId) {
    return null;
  }

  return `https://i.ytimg.com/vi/${encodeURIComponent(resolvedVideoId)}/hqdefault.jpg`;
}

function StaticVideoPreview({
  dance,
  thumbnailUrl,
}: {
  dance: DanceClass;
  thumbnailUrl: string | null;
}) {
  return (
    <View style={styles.previewSurface}>
      {thumbnailUrl ? <Image source={{ uri: thumbnailUrl }} style={styles.previewImage} resizeMode="cover" /> : null}
      <View style={styles.previewScrim} />
      <View style={styles.previewContent}>
        <View style={[styles.previewPlayBadge, { backgroundColor: `${dance.color}CC` }]}>
          <Ionicons name="play" size={18} color="#fff" />
        </View>
        <Text style={styles.previewTitle} numberOfLines={2}>
          {dance.title}
        </Text>
        <Text style={styles.previewSubtitle} numberOfLines={2}>
          {dance.instructor} · {dance.duration}
        </Text>
      </View>
    </View>
  );
}

function PlayerOverlay({
  phase,
  countdown,
}: {
  phase: PracticePhase;
  countdown: number;
}) {
  return (
    <>
      <View pointerEvents="none" style={styles.playerScrim} />

      {phase === 'countdown' ? (
        <View style={styles.countdownOverlay}>
          <Text style={styles.countdownNumber}>{countdown}</Text>
          <Text style={styles.countdownText}>Workout starts as soon as the countdown ends.</Text>
        </View>
      ) : null}

      {phase === 'paused' ? (
        <View style={styles.pauseOverlay}>
          <Ionicons name="pause-circle" size={52} color="#fff" />
          <Text style={styles.pauseText}>Practice paused</Text>
        </View>
      ) : null}
    </>
  );
}

export function DanceVisionPracticeModalView({
  dance,
  visible,
  cameraRef,
  device,
  format,
  hasCameraPermission,
  isCameraActive,
  frameProcessor,
  targetFrameRate,
  phase,
  countdown,
  metrics,
  formattedElapsed,
  referenceVideoUrl,
  handleClose,
  handleReset,
  handleStartWorkout,
  handlePauseWorkout,
  handleResumeWorkout,
  handleCameraInitialized,
  handleCameraError,
}: DanceVisionPracticeModalViewProps) {
  const insets = useSafeAreaInsets();
  const [isPlayerFullscreen, setIsPlayerFullscreen] = React.useState(false);
  const playerPlaybackPositionSecondsRef = React.useRef(0);
  const orientationControlModule = NativeModules.OrientationControl as
    | {
        allowFullscreenRotation?: () => Promise<void>;
        lockPortrait?: () => Promise<void>;
      }
    | undefined;

  React.useEffect(() => {
    if (!visible) {
      setIsPlayerFullscreen(false);
      playerPlaybackPositionSecondsRef.current = 0;
    }
  }, [visible]);

  React.useEffect(() => {
    playerPlaybackPositionSecondsRef.current = 0;
    setIsPlayerFullscreen(false);
  }, [dance?.id]);

  React.useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    const applyOrientation = async () => {
      try {
        if (isPlayerFullscreen) {
          await orientationControlModule?.allowFullscreenRotation?.();
          return;
        }

        await orientationControlModule?.lockPortrait?.();
      } catch {
        // Ignore orientation failures so fullscreen playback still works.
      }
    };

    void applyOrientation();

    return () => {
      if (Platform.OS !== 'android') {
        return;
      }

      void orientationControlModule?.lockPortrait?.().catch(() => {
        // Ignore cleanup failures when closing the fullscreen player.
      });
    };
  }, [isPlayerFullscreen, orientationControlModule]);

  const handlePlaybackPositionChange = React.useCallback(
    (seconds: number) => {
      if (phase === 'ready') {
        return;
      }

      playerPlaybackPositionSecondsRef.current = seconds;
    },
    [phase]
  );

  const handleLocalReset = React.useCallback(() => {
    playerPlaybackPositionSecondsRef.current = 0;
    setIsPlayerFullscreen(false);
    handleReset();
  }, [handleReset]);

  if (!dance) {
    return null;
  }

  const phaseLabel = getPhaseLabel(phase);
  const phaseColor = getPhaseAccentColor(phase, dance.color);
  const hasEmbeddedYoutubeReference = Boolean(referenceVideoUrl || dance.videoId);
  const canOpenYoutubeFallback = Boolean(referenceVideoUrl);
  const shouldMountYoutubePlayer = hasEmbeddedYoutubeReference && phase !== 'ready' && !isPlayerFullscreen;
  const shouldShowStaticPreview =
    hasEmbeddedYoutubeReference && (phase === 'ready' || phase === 'countdown' || isPlayerFullscreen);
  const previewThumbnailUrl = buildYoutubeThumbnailUrl(dance, referenceVideoUrl);

  const handleOpenYoutubeFallback = () => {
    if (!referenceVideoUrl) {
      return;
    }

    void Linking.openURL(referenceVideoUrl);
  };

  const primaryAction =
    phase === 'ready'
      ? {
          icon: 'play-outline' as const,
          label: 'Start',
          onPress: handleStartWorkout,
          color: dance.color,
        }
      : phase === 'countdown'
        ? {
            icon: 'stop-outline' as const,
            label: 'Cancel',
            onPress: handleLocalReset,
            color: colors.text3,
          }
        : phase === 'playing'
          ? {
              icon: 'pause-outline' as const,
              label: 'Pause',
              onPress: handlePauseWorkout,
              color: dance.color,
            }
          : {
              icon: 'play-outline' as const,
              label: 'Resume',
              onPress: handleResumeWorkout,
              color: dance.color,
            };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        <View pointerEvents="none" style={[styles.backgroundOrbTop, { backgroundColor: `${dance.color}18` }]} />
        <View pointerEvents="none" style={styles.backgroundOrbBottom} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 176 + insets.bottom }]}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <Text style={styles.title}>{dance.title}</Text>
              <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.85}>
                <Ionicons name="close" size={24} color={colors.text1} />
              </TouchableOpacity>
            </View>

            <View style={styles.summaryRow}>
              <View style={styles.summaryChip}>
                <Ionicons name="sparkles-outline" size={14} color={colors.accent2} />
                <Text style={styles.summaryChipText}>{dance.tags[0]}</Text>
              </View>
              <View style={styles.summaryChip}>
                <Ionicons name="ribbon-outline" size={14} color={colors.teal} />
                <Text style={styles.summaryChipText}>{dance.level}</Text>
              </View>
            </View>
          </View>

          {hasEmbeddedYoutubeReference ? (
            <View style={[styles.playerCard, { borderColor: `${dance.color}44` }]}>
              {shouldMountYoutubePlayer ? (
                <YoutubeEmbedPlayer
                  videoId={dance.videoId}
                  youtubeUrl={referenceVideoUrl}
                  playbackState={phase}
                  playbackPositionSeconds={playerPlaybackPositionSecondsRef.current}
                  onPlaybackPositionChange={handlePlaybackPositionChange}
                />
              ) : null}
              {shouldShowStaticPreview ? <StaticVideoPreview dance={dance} thumbnailUrl={previewThumbnailUrl} /> : null}
              {hasEmbeddedYoutubeReference ? (
                <TouchableOpacity
                  style={styles.fullscreenButton}
                  activeOpacity={0.88}
                  onPress={() => {
                    setIsPlayerFullscreen(true);
                  }}>
                  <Ionicons name="expand-outline" size={14} color="#fff" />
                  <Text style={styles.playerTapHintText}>FULLSCREEN</Text>
                </TouchableOpacity>
              ) : null}
              <PlayerOverlay
                phase={phase}
                countdown={countdown}
              />
            </View>
          ) : (
            <View style={[styles.playerCard, styles.fallbackPlayerCard, { borderColor: `${dance.color}44` }]}>
              <View style={styles.fallbackPlayerBody}>
                <View style={[styles.fallbackPlayerIconWrap, { backgroundColor: `${dance.color}20` }]}>
                  <Ionicons
                    name={canOpenYoutubeFallback ? 'logo-youtube' : 'videocam-off-outline'}
                    size={28}
                    color={dance.color}
                  />
                </View>
                <Text style={styles.fallbackPlayerTitle}>
                  {canOpenYoutubeFallback ? 'Embedded player unavailable' : 'Reference video unavailable'}
                </Text>
                <Text style={styles.fallbackPlayerBodyText}>
                  {canOpenYoutubeFallback
                    ? 'This class could not open the in-app YouTube embed, so you can open the original YouTube video instead.'
                    : 'This class does not have an embeddable or fallback YouTube link yet.'}
                </Text>
                {canOpenYoutubeFallback ? (
                  <TouchableOpacity
                    style={[styles.youtubeFallbackButton, { backgroundColor: dance.color }]}
                    activeOpacity={0.88}
                    onPress={handleOpenYoutubeFallback}>
                    <Ionicons name="open-outline" size={16} color="#fff" />
                    <Text style={styles.youtubeFallbackButtonText}>Open in YouTube</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              <PlayerOverlay
                phase={phase}
                countdown={countdown}
              />
            </View>
          )}

            <View style={styles.infoPanel}>
              <View style={styles.panelHeader}>
                <View>
                <Text style={styles.panelEyebrow}>라이브 대시보드</Text>
                <Text style={styles.panelTitle}>실시간 운동 현황</Text>
                </View>
                <View style={styles.panelStatusChip}>
                  <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
                  <Text style={styles.panelStatusText}>{phaseLabel}</Text>
                </View>
              </View>

              <View style={styles.metricRowThree}>
              <MetricCard icon="flame-outline" label="칼로리" value={metrics.calories.toFixed(1)} color={colors.accent2} />
              <MetricCard icon="body-outline" label="움직임" value={metrics.movementScore.toFixed(2)} color={dance.color} />
              <MetricCard icon="time-outline" label="운동 시간" value={formattedElapsed} color={colors.teal} />
              </View>
            </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.footerCard}>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={handleLocalReset}>
              <Ionicons name="refresh-outline" size={18} color={colors.text1} />
              <Text style={styles.secondaryButtonText}>Reset</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: primaryAction.color }]}
              activeOpacity={0.88}
              onPress={primaryAction.onPress}>
              <Ionicons name={primaryAction.icon} size={18} color="#fff" />
              <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal
          visible={isPlayerFullscreen}
          animationType="fade"
          transparent={false}
          presentationStyle="fullScreen"
          onRequestClose={() => {
            setIsPlayerFullscreen(false);
          }}>
          <SafeAreaView style={styles.fullscreenContainer}>
            <View style={styles.fullscreenHeader}>
              <View style={styles.fullscreenHeaderBadge}>
                <Ionicons name="expand-outline" size={14} color={dance.color} />
                <Text style={[styles.fullscreenHeaderText, { color: dance.color }]}>{dance.title}</Text>
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                activeOpacity={0.85}
                onPress={() => {
                  setIsPlayerFullscreen(false);
                }}>
                <Ionicons name="contract-outline" size={22} color={colors.text1} />
              </TouchableOpacity>
            </View>

            <View style={styles.fullscreenPlayerShell}>
              {phase !== 'ready' ? (
                <YoutubeEmbedPlayer
                  videoId={dance.videoId}
                  youtubeUrl={referenceVideoUrl}
                  playbackState={phase}
                  playbackPositionSeconds={playerPlaybackPositionSecondsRef.current}
                  onPlaybackPositionChange={handlePlaybackPositionChange}
                />
              ) : null}
              {(phase === 'ready' || phase === 'countdown') ? (
                <StaticVideoPreview dance={dance} thumbnailUrl={previewThumbnailUrl} />
              ) : null}
              <PlayerOverlay
                phase={phase}
                countdown={countdown}
              />
            </View>
          </SafeAreaView>
        </Modal>

        {hasCameraPermission && device ? (
          <View style={styles.hiddenCameraHost} pointerEvents="none">
            <Camera
              ref={cameraRef}
              style={styles.hiddenCameraPreview}
              device={device}
              format={format}
              fps={targetFrameRate}
              isActive={isCameraActive}
              photo
              preview={false}
              frameProcessor={frameProcessor}
              pixelFormat="yuv"
              resizeMode="cover"
              androidPreviewViewType="texture-view"
              enableBufferCompression={false}
              onInitialized={handleCameraInitialized}
              onError={(error) => {
                handleCameraError(error.message);
              }}
            />
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#09090c',
  },
  fullscreenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  fullscreenHeaderBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fullscreenHeaderText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  fullscreenPlayerShell: {
    flex: 1,
    backgroundColor: '#09090c',
  },
  backgroundOrbTop: {
    position: 'absolute',
    top: -70,
    right: -20,
    width: 220,
    height: 220,
    borderRadius: 110,
  },
  backgroundOrbBottom: {
    position: 'absolute',
    left: -80,
    bottom: 110,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  header: {
    marginBottom: 18,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 30,
    fontWeight: '900',
    color: colors.text1,
    paddingTop: 2,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text1,
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
    height: 328,
    borderRadius: 28,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  fallbackPlayerCard: {
    padding: 22,
  },
  previewSurface: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#09090c',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 12, 0.42)',
  },
  previewContent: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 20,
    gap: 10,
  },
  previewPlayBadge: {
    width: 42,
    height: 42,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#fff',
  },
  previewSubtitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.82)',
  },
  fallbackPlayerBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    gap: 12,
  },
  fallbackPlayerIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackPlayerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text1,
    textAlign: 'center',
  },
  fallbackPlayerBodyText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text2,
    textAlign: 'center',
  },
  fallbackPlayerMeta: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text3,
    textAlign: 'center',
  },
  youtubeFallbackButton: {
    marginTop: 4,
    minHeight: 46,
    borderRadius: radius.full,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  youtubeFallbackButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
  previewVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  playerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 12, 0.18)',
  },
  playerTapHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  fullscreenButton: {
    position: 'absolute',
    top: 18,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: 'rgba(13, 13, 15, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  fullscreenButtonDisabled: {
    opacity: 0.58,
  },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 13, 15, 0.94)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  countdownNumber: {
    fontSize: 84,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 8,
  },
  countdownText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
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
    marginTop: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  panelEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: colors.text3,
    marginBottom: 6,
  },
  panelTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text1,
  },
  panelStatusChip: {
    height: 34,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
  },
  panelStatusText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text1,
  },
  metricRowThree: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minHeight: 116,
    padding: 14,
    borderRadius: 18,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'space-between',
  },
  metricCardTopRow: {
    gap: 10,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 11,
    color: colors.text2,
    fontWeight: '700',
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.text1,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 14,
    backgroundColor: 'rgba(13, 13, 15, 0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  footerCard: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryButton: {
    flex: 0.38,
    height: 58,
    borderRadius: 18,
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
    fontWeight: '800',
  },
  primaryButton: {
    flex: 0.62,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  hiddenCameraHost: {
    position: 'absolute',
    top: -10000,
    left: -10000,
    overflow: 'hidden',
  },
  hiddenCameraPreview: {
    width: 1,
    height: 1,
    opacity: 0.01,
  },
});
