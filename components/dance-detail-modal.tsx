import { colors, radius } from '@/constants/theme';
import { DanceClass, levelColors } from '@/data/dances';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type DanceDetailModalProps = {
  dance: DanceClass | null;
  visible: boolean;
  onClose: () => void;
  onStart: (dance: DanceClass) => void;
};

export function DanceDetailModal({ dance, visible, onClose, onStart }: DanceDetailModalProps) {
  if (!dance) {
    return null;
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={[styles.hero, { backgroundColor: dance.color + '20' }]}>
              <View style={styles.heroTopRow}>
                <View style={[styles.genrePill, { borderColor: dance.color + '50' }]}>
                  <Text style={[styles.genrePillText, { color: dance.color }]}>{dance.genre}</Text>
                </View>
                <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
                  <Ionicons name="close" size={20} color={colors.text1} />
                </TouchableOpacity>
              </View>

              <View style={[styles.iconCircle, { backgroundColor: dance.color }]}>
                <Ionicons name={dance.icon as keyof typeof Ionicons.glyphMap} size={34} color="#fff" />
              </View>

              <Text style={styles.title}>{dance.title}</Text>
              <Text style={styles.subtitle}>{dance.subtitle}</Text>

              <View style={styles.quickStats}>
                <StatCard icon="time-outline" label={dance.duration} />
                <StatCard icon="flame-outline" label={`${dance.kcal} kcal`} />
                <StatCard icon="people-outline" label={dance.students.toLocaleString()} />
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.instructorRow}>
                <View>
                  <Text style={styles.sectionLabel}>강사</Text>
                  <Text style={styles.instructorName}>{dance.instructor}</Text>
                </View>
                <View
                  style={[
                    styles.levelBadge,
                    {
                      backgroundColor: levelColors[dance.level] + '20',
                      borderColor: levelColors[dance.level] + '40',
                    },
                  ]}>
                  <Text style={[styles.levelText, { color: levelColors[dance.level] }]}>{dance.level}</Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>평점</Text>
                  <Text style={styles.infoValue}>{dance.rating}</Text>
                </View>
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>포인트</Text>
                  <Text style={styles.infoValue}>{dance.tags[0]}</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>이 수업에서 연습할 내용</Text>
              {dance.goals.map((goal) => (
                <View key={goal} style={styles.listRow}>
                  <View style={[styles.bullet, { backgroundColor: dance.color }]} />
                  <Text style={styles.listText}>{goal}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>수업 흐름</Text>
              {dance.steps.map((step, index) => (
                <View key={step} style={styles.stepRow}>
                  <View style={[styles.stepNumber, { backgroundColor: dance.color + '20' }]}>
                    <Text style={[styles.stepNumberText, { color: dance.color }]}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionLabel}>태그</Text>
              <View style={styles.tagWrap}>
                {dance.tags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.secondaryAction} activeOpacity={0.85}>
                <Ionicons name="bookmark-outline" size={18} color={colors.text1} />
                <Text style={styles.secondaryActionText}>저장</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryAction, { backgroundColor: dance.color }]}
                activeOpacity={0.85}
                onPress={() => onStart(dance)}>
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

function StatCard({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={16} color={colors.text2} />
      <Text style={styles.statCardText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  content: {
    padding: 20,
    paddingBottom: 32,
    gap: 18,
  },
  hero: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  genrePill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  genrePillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.text2,
    marginBottom: 16,
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
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
  },
  statCardText: {
    color: colors.text1,
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text2,
    letterSpacing: 0.8,
  },
  instructorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  instructorName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text1,
    marginTop: 4,
  },
  levelBadge: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    gap: 10,
  },
  infoCard: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 14,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.text2,
    marginBottom: 6,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text1,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: 13,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text1,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagChip: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tagText: {
    fontSize: 12,
    color: colors.text2,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  secondaryAction: {
    flex: 0.42,
    height: 52,
    borderRadius: radius.lg,
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
    fontWeight: '700',
  },
  primaryAction: {
    flex: 0.58,
    height: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
