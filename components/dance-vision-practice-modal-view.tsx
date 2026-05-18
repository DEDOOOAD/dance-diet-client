import { colors, radius } from '@/constants/theme';
import { DanceClass } from '@/data/dances';
import { LiveMetrics, PracticePhase, StreamState, TransportStats } from '@/hooks/use-dance-vision-practice-modal-controller';
import { Ionicons } from '@expo/vector-icons';
import { VideoView } from 'expo-video';
import React, { useRef } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Camera, type CameraDevice, type CameraDeviceFormat } from 'react-native-vision-camera';

type DanceVisionPracticeModalViewProps = {
  dance: DanceClass | null;
  visible: boolean;
  player: React.ComponentProps<typeof VideoView>['player'];
  cameraRef: React.RefObject<Camera | null>;
  device: CameraDevice | undefined;
  format: CameraDeviceFormat | undefined;
  hasCameraPermission: boolean;
  isCameraActive: boolean;
  targetFrameRate: number;
  phase: PracticePhase;
  countdown: number;
  streamState: StreamState;
  metrics: LiveMetrics;
  transportStats: TransportStats;
  formattedElapsed: string;
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
      return '운동 중';
    case 'paused':
      return '일시 정지';
    case 'ready':
    default:
      return '시작 대기';
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

export function DanceVisionPracticeModalView({
  dance,
  visible,
  player,
  cameraRef,
  device,
  format,
  hasCameraPermission,
  isCameraActive,
  targetFrameRate,
  phase,
  countdown,
  metrics,
  formattedElapsed,
  handleClose,
  handleReset,
  handleStartWorkout,
  handlePauseWorkout,
  handleResumeWorkout,
  handleCameraInitialized,
  handleCameraError,
}: DanceVisionPracticeModalViewProps) {
  const insets = useSafeAreaInsets();
  const videoViewRef = useRef<VideoView | null>(null);

  if (!dance) {
    return null;
  }

  const phaseLabel = getPhaseLabel(phase);
  const phaseColor = getPhaseAccentColor(phase, dance.color);

  const openFullscreen = () => {
    void videoViewRef.current?.enterFullscreen();
  };

  const primaryAction =
    phase === 'ready'
      ? {
          icon: 'play-outline' as const,
          label: '시작하기',
          onPress: handleStartWorkout,
          color: dance.color,
        }
      : phase === 'countdown'
        ? {
            icon: 'stop-outline' as const,
            label: '취소',
            onPress: handleReset,
            color: colors.text3,
          }
        : phase === 'playing'
          ? {
              icon: 'pause-outline' as const,
              label: '일시 정지',
              onPress: handlePauseWorkout,
              color: dance.color,
            }
          : {
              icon: 'play-outline' as const,
              label: '이어서 하기',
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
                <Ionicons name="musical-notes-outline" size={14} color={dance.color} />
                <Text style={styles.summaryChipText}>{dance.genre}</Text>
              </View>
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

          <Pressable style={[styles.playerCard, { borderColor: `${dance.color}44` }]} onPress={openFullscreen}>
            <VideoView
              ref={videoViewRef}
              player={player}
              style={styles.previewVideo}
              nativeControls={false}
              contentFit="cover"
              allowsFullscreen
            />
            <View style={styles.playerScrim} />

            <View style={styles.playerTopRow}>
              <View style={[styles.playerBadge, { borderColor: `${dance.color}55` }]}>
                <Ionicons name="disc-outline" size={14} color={dance.color} />
                <Text style={[styles.playerBadgeText, { color: dance.color }]}>{dance.genre}</Text>
              </View>

              <View style={styles.playerBadgeGroup}>
                <View style={styles.playerTapHint}>
                  <Ionicons name="expand-outline" size={13} color="#fff" />
                  <Text style={styles.playerTapHintText}>전체화면</Text>
                </View>
              </View>
            </View>

            {phase === 'countdown' && (
              <View style={styles.countdownOverlay}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
                <Text style={styles.countdownText}>카운트가 끝나면 바로 연습이 시작돼요.</Text>
              </View>
            )}

            {phase === 'paused' && (
              <View style={styles.pauseOverlay}>
                <Ionicons name="pause-circle" size={52} color="#fff" />
                <Text style={styles.pauseText}>잠시 멈췄어요</Text>
              </View>
            )}
          </Pressable>

          <View style={styles.infoPanel}>
            <View style={styles.panelHeader}>
              <View>
                <Text style={styles.panelEyebrow}>LIVE DASHBOARD</Text>
                <Text style={styles.panelTitle}>실시간 지표</Text>
              </View>
              <View style={styles.panelStatusChip}>
                <View style={[styles.phaseDot, { backgroundColor: phaseColor }]} />
                <Text style={styles.panelStatusText}>{phaseLabel}</Text>
              </View>
            </View>

            <View style={styles.metricRowThree}>
              <MetricCard icon="flame-outline" label="칼로리" value={metrics.calories.toFixed(1)} color={colors.accent2} />
              <MetricCard icon="body-outline" label="무브먼트" value={metrics.movementScore.toFixed(2)} color={dance.color} />
              <MetricCard icon="time-outline" label="시간" value={formattedElapsed} color={colors.teal} />
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <View style={styles.footerCard}>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={handleReset}>
              <Ionicons name="refresh-outline" size={18} color={colors.text1} />
              <Text style={styles.secondaryButtonText}>초기화</Text>
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

        {hasCameraPermission && device ? (
          <View style={styles.hiddenCameraHost} pointerEvents="none">
            <Camera
              ref={cameraRef}
              style={styles.hiddenCameraPreview}
              device={device}
              format={format}
              fps={targetFrameRate}
              isActive={isCameraActive}
              preview
              photo
              video
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
  previewVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  playerScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(9, 9, 12, 0.18)',
  },
  playerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  playerBadgeGroup: {
    alignItems: 'flex-end',
    gap: 8,
  },
  playerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: 'rgba(13, 13, 15, 0.66)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  playerBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  playerTapHint: {
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
  playerTapHintText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  phaseDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 13, 15, 0.58)',
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
    width: 2,
    height: 2,
    opacity: 0,
    overflow: 'hidden',
  },
  hiddenCameraPreview: {
    width: 2,
    height: 2,
  },
});
