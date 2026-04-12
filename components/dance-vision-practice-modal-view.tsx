import { colors, radius } from '@/constants/theme';
import { DanceClass } from '@/data/dances';
import {
  LiveMetrics,
  PracticePhase,
  StreamState,
  TransportStats,
} from '@/hooks/use-dance-vision-practice-modal-controller';
import { Ionicons } from '@expo/vector-icons';
import { VideoView } from 'expo-video';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  formatLabel: string;
  targetFrameRate: number;
  phase: PracticePhase;
  countdown: number;
  streamState: StreamState;
  metrics: LiveMetrics;
  transportStats: TransportStats;
  phaseText: string;
  streamNotice: string;
  formattedElapsed: string;
  lastPayloadLabel: string;
  averagePayloadLabel: string;
  handleClose: () => void;
  handleReset: () => void;
  handleStartWorkout: () => void;
  handlePauseWorkout: () => void;
  handleResumeWorkout: () => void;
  handleCameraInitialized: () => void;
  handleCameraError: (message: string) => void;
};

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
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
  formatLabel,
  targetFrameRate,
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
}: DanceVisionPracticeModalViewProps) {
  if (!dance) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text style={styles.title}>{dance.title}</Text>
              <Text style={styles.subtitle}>VisionCamera 바이너리 JPEG 스트림</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.85}>
              <Ionicons name="close" size={24} color={colors.text1} />
            </TouchableOpacity>
          </View>

          <View style={styles.playerCard}>
            <VideoView player={player} style={styles.previewVideo} nativeControls={false} contentFit="cover" />

            <View style={styles.overlayBadge}>
              <Ionicons name="sparkles-outline" size={18} color="#fff" />
              <Text style={styles.overlayBadgeText}>가이드 비디오</Text>
            </View>

            {phase === 'countdown' && (
              <View style={styles.countdownOverlay}>
                <Text style={styles.countdownNumber}>{countdown}</Text>
                <Text style={styles.countdownText}>카운트다운이 끝나면 촬영과 전송이 시작됩니다.</Text>
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
            <Text style={styles.panelTitle}>전송 상태</Text>
            <Text style={styles.panelText}>{phaseText}</Text>

            <View style={styles.noticeRow}>
              <Ionicons
                name={streamState === 'streaming' ? 'radio-button-on' : 'hardware-chip-outline'}
                size={16}
                color={colors.teal}
              />
              <Text style={styles.noticeText}>{streamNotice}</Text>
            </View>

            <View style={styles.metricRow}>
              <MetricCard label="보낸 프레임" value={transportStats.sentFrames} />
              <MetricCard label="서버 응답" value={metrics.totalFrames} />
            </View>

            <View style={styles.metricRow}>
              <MetricCard label="경과 시간" value={formattedElapsed} />
              <MetricCard label="드롭" value={transportStats.droppedFrames} />
            </View>

            <View style={styles.metricRow}>
              <MetricCard label="최근 크기" value={lastPayloadLabel} />
              <MetricCard label="평균 크기" value={averagePayloadLabel} />
            </View>

            <View style={styles.metricRow}>
              <MetricCard label="칼로리" value={metrics.calories.toFixed(1)} />
              <MetricCard label="포맷" value={formatLabel} />
            </View>
          </View>

          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.secondaryButton} activeOpacity={0.85} onPress={handleReset}>
              <Ionicons name="refresh-outline" size={18} color={colors.text1} />
              <Text style={styles.secondaryButtonText}>초기화</Text>
            </TouchableOpacity>

            {phase === 'ready' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: dance.color }]}
                activeOpacity={0.85}
                onPress={handleStartWorkout}>
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
                onPress={handlePauseWorkout}>
                <Ionicons name="pause-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>일시정지</Text>
              </TouchableOpacity>
            )}

            {phase === 'paused' && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: dance.color }]}
                activeOpacity={0.85}
                onPress={handleResumeWorkout}>
                <Ionicons name="play-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>재개</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
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
    height: 280,
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
    backgroundColor: 'rgba(13, 13, 15, 0.58)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  countdownNumber: {
    fontSize: 78,
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
    fontSize: 15,
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
