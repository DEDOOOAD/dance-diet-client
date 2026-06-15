import { colors, radius } from '@/constants/theme';
import { DanceClass } from '@/data/dances';
import { DanceDetailQuickStat } from '@/hooks/use-dance-detail-modal-controller';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ImageBackground,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type DanceDetailModalViewProps = {
  dance: DanceClass | null;
  visible: boolean;
  quickStats: DanceDetailQuickStat[];
  heroBackgroundColor: string;
  isFavorite: boolean;
  handleStart: () => void;
  handleToggleFavorite: () => void;
  handleClose: () => void;
};

function getSourceLabel(dance: DanceClass) {
  const instructor = dance.instructor?.trim();
  if (!instructor) {
    return '추천 클래스';
  }

  if (instructor.toLowerCase() === 'youtube') {
    return 'YouTube 클래스';
  }

  return instructor;
}

function getDescription(dance: DanceClass) {
  return dance.description?.trim() || dance.subtitle;
}

export function DanceDetailModalView({
  dance,
  visible,
  quickStats,
  heroBackgroundColor,
  isFavorite,
  handleStart,
  handleToggleFavorite,
  handleClose,
}: DanceDetailModalViewProps) {
  const insets = useSafeAreaInsets();

  if (!dance) {
    return null;
  }

  const description = getDescription(dance);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} />
        <View style={styles.sheet}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}>
            <View style={[styles.hero, { backgroundColor: heroBackgroundColor }]}>
              {dance.thumbnailUrl ? (
                <ImageBackground source={{ uri: dance.thumbnailUrl }} style={StyleSheet.absoluteFill} imageStyle={styles.heroImage}>
                  <View style={styles.heroImageOverlay} />
                </ImageBackground>
              ) : (
                <>
                  <View style={[styles.heroGlow, { backgroundColor: `${dance.color}24` }]} />
                  <View style={[styles.heroOrb, { backgroundColor: `${dance.color}18` }]} />
                </>
              )}

              <View style={[styles.heroTint, { backgroundColor: `${dance.color}18` }]} />

              <View style={styles.heroTopRow}>
                <TouchableOpacity style={styles.heroIconButton} onPress={handleToggleFavorite} activeOpacity={0.85}>
                  <Ionicons name={isFavorite ? 'bookmark' : 'bookmark-outline'} size={18} color={colors.text1} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.heroIconButton} onPress={handleClose} activeOpacity={0.85}>
                  <Ionicons name="close" size={20} color={colors.text1} />
                </TouchableOpacity>
              </View>

              <View style={styles.heroCopy}>
                <View style={styles.sourceChip}>
                  <Text style={styles.sourceChipText}>{getSourceLabel(dance)}</Text>
                </View>
                <Text style={styles.title} numberOfLines={3}>
                  {dance.title}
                </Text>
                <Text style={styles.subtitle} numberOfLines={3}>
                  {dance.subtitle}
                </Text>
              </View>

              <View style={styles.quickStats}>
                {quickStats.map((stat) => (
                  <StatCard key={`${stat.icon}-${stat.label}`} icon={stat.icon} label={stat.label} />
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>클래스 소개</Text>
              <Text style={styles.descriptionText}>{description}</Text>
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>진행 채널</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {getSourceLabel(dance)}
                </Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>예상 소모</Text>
                <Text style={styles.detailValue}>{`${dance.kcal} kcal`}</Text>
              </View>
            </View>

            <View style={styles.detailGrid}>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>재생 길이</Text>
                <Text style={styles.detailValue}>{dance.duration}</Text>
              </View>
              <View style={styles.detailCard}>
                <Text style={styles.detailLabel}>참여 클래스</Text>
                <Text style={styles.detailValue}>{`${dance.students.toLocaleString()}명`}</Text>
              </View>
            </View>

            <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity style={styles.secondaryAction} activeOpacity={0.85} onPress={handleToggleFavorite}>
                <Ionicons name={isFavorite ? 'bookmark' : 'bookmark-outline'} size={18} color={colors.text1} />
                <Text style={styles.secondaryActionText}>{isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryAction, { backgroundColor: dance.color }]}
                activeOpacity={0.85}
                onPress={handleStart}>
                <Ionicons name="play" size={18} color="#fff" />
                <Text style={styles.primaryActionText}>춤 시작하기</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function StatCard({ icon, label }: DanceDetailQuickStat) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={16} color={colors.text1} />
      <Text style={styles.statCardText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  content: {
    padding: 20,
    gap: 16,
  },
  hero: {
    minHeight: 360,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: 20,
    justifyContent: 'space-between',
  },
  heroImage: {
    borderRadius: 28,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 7, 10, 0.48)',
  },
  heroGlow: {
    position: 'absolute',
    right: -32,
    top: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  heroOrb: {
    position: 'absolute',
    left: -24,
    bottom: -40,
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13, 13, 15, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroCopy: {
    marginTop: 38,
    gap: 12,
  },
  sourceChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(13, 13, 15, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  sourceChipText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent2,
    letterSpacing: 0.9,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.8)',
  },
  quickStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13, 13, 15, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.full,
  },
  statCardText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
    gap: 10,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text3,
    letterSpacing: 1,
  },
  descriptionText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text1,
  },
  detailGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  detailCard: {
    flex: 1,
    minHeight: 104,
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    color: colors.text3,
    fontWeight: '700',
  },
  detailValue: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '800',
    color: colors.text1,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 2,
  },
  secondaryAction: {
    flex: 0.42,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionText: {
    color: colors.text1,
    fontSize: 14,
    fontWeight: '800',
  },
  primaryAction: {
    flex: 0.58,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
