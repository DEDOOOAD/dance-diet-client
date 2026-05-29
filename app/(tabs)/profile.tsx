import { colors, radius } from '@/constants/theme';
import { clearCurrentUserUuid, getCurrentUserUuid, loadCurrentUserUuid } from '@/services/current-user';
import { fetchUserBodyProfile, updateUserBodyProfile } from '@/services/profile';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type BodyProfile = {
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  targetDurationWeeks: string;
};

type SaveNotice = {
  tone: 'success' | 'error';
  message: string;
};

const INITIAL_BODY_PROFILE: BodyProfile = {
  heightCm: '',
  weightKg: '',
  targetWeightKg: '',
  targetDurationWeeks: '',
};

const ACHIEVEMENTS = [
  { icon: 'flame', title: '12일 연속', sub: '스트릭 유지 중', unlocked: true, color: colors.accent },
  { icon: 'star', title: '100분 달성', sub: '연습 마스터', unlocked: true, color: colors.purple },
  { icon: 'trophy', title: '10곡 완료', sub: '꾸준한 챌린저', unlocked: true, color: '#F59E0B' },
  { icon: 'nutrition', title: '1만 kcal', sub: '칼로리 버너', unlocked: false, color: colors.text3 },
] as const;

function SummaryCard({
  value,
  unit,
  label,
  showDivider,
}: {
  value: string;
  unit: string;
  label: string;
  showDivider?: boolean;
}) {
  return (
    <View style={[styles.summaryItem, showDivider && styles.summaryDivider]}>
      <Text style={styles.summaryValue}>
        {value}
        <Text style={styles.summaryUnit}> {unit}</Text>
      </Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function BodyMetricCard({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>
        {value || '--'}
        <Text style={styles.metricUnit}> {unit}</Text>
      </Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  destructive = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  destructive?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={styles.actionRow} activeOpacity={0.85} onPress={onPress} disabled={!onPress}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={18} color={destructive ? colors.accent : colors.text2} />
      </View>
      <Text style={[styles.actionLabel, destructive && styles.actionLabelDestructive]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={colors.text3} />
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const [currentUserId, setCurrentUserId] = useState(() => getCurrentUserUuid());
  const [profileName, setProfileName] = useState('USER');
  const [bodyProfile, setBodyProfile] = useState<BodyProfile>(INITIAL_BODY_PROFILE);
  const [draftBodyProfile, setDraftBodyProfile] = useState<BodyProfile>(INITIAL_BODY_PROFILE);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [isBodyModalVisible, setIsBodyModalVisible] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isSavingBodyProfile, setIsSavingBodyProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<SaveNotice | null>(null);

  useEffect(() => {
    void loadCurrentUserUuid()
      .then((userId) => {
        setCurrentUserId(userId);
      })
      .catch(() => {
        setCurrentUserId(getCurrentUserUuid());
      });
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadProfile = async () => {
      if (!currentUserId) {
        return;
      }

      setIsProfileLoading(true);
      setProfileError(null);

      try {
        const profile = await fetchUserBodyProfile(currentUserId);
        if (isCancelled) {
          return;
        }

        const nextBodyProfile = {
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          targetWeightKg: profile.targetWeightKg,
          targetDurationWeeks: profile.targetDurationWeeks,
        };

        setProfileName(profile.userName);
        setCurrentStreak(profile.currentStreak);
        setBodyProfile(nextBodyProfile);
        setDraftBodyProfile(nextBodyProfile);
      } catch (error) {
        if (!isCancelled) {
          setProfileError(error instanceof Error ? error.message : '프로필 정보를 불러오지 못했어요.');
        }
      } finally {
        if (!isCancelled) {
          setIsProfileLoading(false);
        }
      }
    };

    void loadProfile();

    return () => {
      isCancelled = true;
    };
  }, [currentUserId]);

  const targetDiff = useMemo(() => {
    const duration = bodyProfile.targetDurationWeeks.trim();
    const weight = Number(bodyProfile.weightKg);
    const target = Number(bodyProfile.targetWeightKg);
    const durationLabel = duration ? `${duration}주 목표 기간` : null;

    if (!Number.isFinite(weight) || !Number.isFinite(target) || !bodyProfile.weightKg || !bodyProfile.targetWeightKg) {
      return durationLabel;
    }

    const diff = weight - target;
    if (diff === 0) {
      return durationLabel ? `현재 체중과 목표가 같아요. ${durationLabel}` : '현재 체중과 목표가 같아요.';
    }

    const goal = diff > 0 ? `${diff.toFixed(1)}kg 감량 목표` : `${Math.abs(diff).toFixed(1)}kg 증량 목표`;
    return durationLabel ? `${goal}, ${durationLabel}` : goal;
  }, [bodyProfile.targetDurationWeeks, bodyProfile.targetWeightKg, bodyProfile.weightKg]);

  const displayUserName = profileName.trim() || 'USER';
  const avatarLabel = displayUserName.slice(0, 1).toUpperCase();

  const openBodyModal = () => {
    setDraftBodyProfile(bodyProfile);
    setSaveNotice(null);
    setIsBodyModalVisible(true);
  };

  const closeBodyModal = () => {
    if (!isSavingBodyProfile) {
      setIsBodyModalVisible(false);
    }
  };

  const saveBodyProfile = async () => {
    const nextBodyProfile = {
      heightCm: draftBodyProfile.heightCm.trim(),
      weightKg: draftBodyProfile.weightKg.trim(),
      targetWeightKg: draftBodyProfile.targetWeightKg.trim(),
      targetDurationWeeks: draftBodyProfile.targetDurationWeeks.trim(),
    };

    setIsSavingBodyProfile(true);

    try {
      await updateUserBodyProfile({
        userId: currentUserId,
        ...nextBodyProfile,
      });

      setBodyProfile(nextBodyProfile);
      setDraftBodyProfile(nextBodyProfile);
      setProfileError(null);
      setSaveNotice({
        tone: 'success',
        message: '신체 정보가 저장되었어요.',
      });
      setIsBodyModalVisible(false);
    } catch (error) {
      setSaveNotice({
        tone: 'error',
        message: error instanceof Error ? error.message : '신체 정보를 저장하지 못했어요.',
      });
    } finally {
      setIsSavingBodyProfile(false);
    }
  };

  const handleLogout = () => {
    void (async () => {
      await clearCurrentUserUuid();
      router.replace('/login');
    })();
  };

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>프로필</Text>
          <TouchableOpacity style={styles.iconBtn} activeOpacity={0.85}>
            <Ionicons name="settings-outline" size={20} color={colors.text2} />
          </TouchableOpacity>
        </View>

        <View style={styles.profileHero}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarText}>{avatarLabel}</Text>
            </View>
            <View style={styles.levelRing} />
          </View>
          <Text style={styles.profileName}>{displayUserName}</Text>
          <Text style={styles.profileSub}>내 신체 정보와 목표를 저장하고 기록에 반영해보세요.</Text>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.85} onPress={openBodyModal}>
            <Text style={styles.editBtnText}>신체 정보 수정</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard value="12,850" unit="kcal" label="총 소모" showDivider />
          <SummaryCard value="107" unit="회" label="총 운동" showDivider />
          <SummaryCard value={String(currentStreak)} unit="일" label="연속 기록" />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>신체 정보</Text>
            <TouchableOpacity onPress={openBodyModal} activeOpacity={0.85}>
              <Text style={styles.sectionAction}>수정</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bodyCard}>
            <View style={styles.bodyCardHeader}>
              <View style={styles.bodyCardIcon}>
                <Ionicons name="body-outline" size={20} color={colors.accent} />
              </View>
              <View style={styles.bodyCardText}>
                <Text style={styles.bodyCardTitle}>맞춤 목표 설정</Text>
                <Text style={styles.bodyCardSub}>
                  키, 체중, 목표 체중과 기간을 입력하면 일반 서버에 저장되고 홈과 기록에도 반영돼요.
                </Text>
              </View>
            </View>

            {isProfileLoading ? <Text style={styles.inlineNotice}>프로필 정보를 불러오는 중이에요.</Text> : null}
            {!isProfileLoading && profileError ? <Text style={styles.inlineNotice}>{profileError}</Text> : null}
            {saveNotice ? (
              <View
                style={[
                  styles.saveNoticeCard,
                  saveNotice.tone === 'success' ? styles.saveNoticeSuccess : styles.saveNoticeError,
                ]}>
                <Ionicons
                  name={saveNotice.tone === 'success' ? 'checkmark-circle' : 'alert-circle'}
                  size={16}
                  color={saveNotice.tone === 'success' ? colors.teal : colors.accent2}
                />
                <Text style={styles.saveNoticeText}>{saveNotice.message}</Text>
              </View>
            ) : null}

            <View style={styles.metricRow}>
              <BodyMetricCard label="키" value={bodyProfile.heightCm} unit="cm" />
              <BodyMetricCard label="체중" value={bodyProfile.weightKg} unit="kg" />
              <BodyMetricCard label="목표 체중" value={bodyProfile.targetWeightKg} unit="kg" />
              <BodyMetricCard label="목표 기간" value={bodyProfile.targetDurationWeeks} unit="주" />
            </View>

            <View style={styles.goalHint}>
              <Ionicons name="flag-outline" size={14} color={colors.text2} />
              <Text style={styles.goalHintText}>
                {targetDiff ?? '아직 목표 정보가 없어요. 프로필에서 먼저 설정해보세요.'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>업적</Text>
            <Text style={styles.sectionSub}>3 / 4 달성</Text>
          </View>
          <View style={styles.achGrid}>
            {ACHIEVEMENTS.map((achievement) => (
              <View key={achievement.title} style={[styles.achItem, !achievement.unlocked && styles.achLocked]}>
                <View
                  style={[
                    styles.achIcon,
                    { backgroundColor: achievement.unlocked ? `${achievement.color}20` : colors.surface2 },
                  ]}>
                  <Ionicons
                    name={achievement.icon}
                    size={24}
                    color={achievement.unlocked ? achievement.color : colors.text3}
                  />
                </View>
                <Text style={[styles.achTitle, !achievement.unlocked && styles.achTitleLocked]}>{achievement.title}</Text>
                <Text style={styles.achSub}>{achievement.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.menuSectionTitle}>계정</Text>
          <View style={styles.menuGroup}>
            <ActionRow icon="log-out-outline" label="로그아웃" destructive onPress={handleLogout} />
          </View>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal visible={isBodyModalVisible} transparent animationType="fade" onRequestClose={closeBodyModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeBodyModal}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>신체 정보 수정</Text>
                <Text style={styles.modalSub}>입력한 값은 일반 서버 프로필 정보에 바로 저장돼요.</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseButton} onPress={closeBodyModal} activeOpacity={0.85}>
                <Ionicons name="close" size={18} color={colors.text2} />
              </TouchableOpacity>
            </View>

            <View style={styles.fieldGrid}>
              <View style={styles.fieldGroupHalf}>
                <Text style={styles.fieldLabel}>키</Text>
                <TextInput
                  style={styles.input}
                  value={draftBodyProfile.heightCm}
                  onChangeText={(text) => setDraftBodyProfile((prev) => ({ ...prev, heightCm: text }))}
                  placeholder="예: 165"
                  placeholderTextColor={colors.text3}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.fieldGroupHalf}>
                <Text style={styles.fieldLabel}>현재 체중</Text>
                <TextInput
                  style={styles.input}
                  value={draftBodyProfile.weightKg}
                  onChangeText={(text) => setDraftBodyProfile((prev) => ({ ...prev, weightKg: text }))}
                  placeholder="예: 58"
                  placeholderTextColor={colors.text3}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.fieldGroupHalf}>
                <Text style={styles.fieldLabel}>목표 체중</Text>
                <TextInput
                  style={styles.input}
                  value={draftBodyProfile.targetWeightKg}
                  onChangeText={(text) => setDraftBodyProfile((prev) => ({ ...prev, targetWeightKg: text }))}
                  placeholder="예: 53"
                  placeholderTextColor={colors.text3}
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.fieldGroupHalf}>
                <Text style={styles.fieldLabel}>목표 기간</Text>
                <TextInput
                  style={styles.input}
                  value={draftBodyProfile.targetDurationWeeks}
                  onChangeText={(text) => setDraftBodyProfile((prev) => ({ ...prev, targetDurationWeeks: text }))}
                  placeholder="예: 12"
                  placeholderTextColor={colors.text3}
                  keyboardType="number-pad"
                />
              </View>
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalSecondaryButton} onPress={closeBodyModal} activeOpacity={0.85}>
                <Text style={styles.modalSecondaryText}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalPrimaryButton, isSavingBodyProfile && styles.modalPrimaryButtonDisabled]}
                onPress={saveBodyProfile}
                activeOpacity={0.85}
                disabled={isSavingBodyProfile}>
                <Text style={styles.modalPrimaryText}>{isSavingBodyProfile ? '저장 중...' : '저장'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 56,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: 0.5,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileHero: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 8,
  },
  avatarWrap: {
    position: 'relative',
    width: 88,
    height: 88,
    marginBottom: 12,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    top: 4,
    left: 4,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '800',
    color: '#fff',
  },
  levelRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: `${colors.accent}50`,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 4,
  },
  profileSub: {
    fontSize: 13,
    color: colors.text2,
    marginBottom: 14,
  },
  editBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  editBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text1,
  },
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: 18,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text1,
  },
  summaryUnit: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.text2,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.text2,
    marginTop: 4,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text1,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.text2,
  },
  sectionAction: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  bodyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
    gap: 16,
  },
  bodyCardHeader: {
    flexDirection: 'row',
    gap: 12,
  },
  bodyCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: `${colors.accent}16`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyCardText: {
    flex: 1,
    gap: 4,
  },
  bodyCardTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
  },
  bodyCardSub: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text2,
  },
  inlineNotice: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
  },
  saveNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  saveNoticeSuccess: {
    backgroundColor: `${colors.teal}12`,
    borderColor: `${colors.teal}35`,
  },
  saveNoticeError: {
    backgroundColor: `${colors.accent}12`,
    borderColor: `${colors.accent}35`,
  },
  saveNoticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text1,
    fontWeight: '600',
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '47%',
    minWidth: 140,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 6,
  },
  metricLabel: {
    fontSize: 12,
    color: colors.text2,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text1,
  },
  metricUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text2,
  },
  goalHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  goalHintText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
  },
  achGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  achItem: {
    width: '47%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  achLocked: {
    opacity: 0.8,
  },
  achIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text1,
    textAlign: 'center',
  },
  achTitleLocked: {
    color: colors.text3,
  },
  achSub: {
    fontSize: 10,
    color: colors.text2,
    textAlign: 'center',
  },
  menuSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text3,
    letterSpacing: 1,
    marginBottom: 10,
  },
  menuGroup: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text1,
    fontWeight: '500',
  },
  actionLabelDestructive: {
    color: colors.accent,
  },
  bottomSpace: {
    height: 100,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(8, 10, 18, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text1,
  },
  modalSub: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 20,
    color: colors.text2,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldGroupHalf: {
    width: '47%',
    minWidth: 130,
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.text2,
    fontWeight: '600',
  },
  input: {
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    color: colors.text1,
    fontSize: 15,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSecondaryText: {
    color: colors.text1,
    fontSize: 14,
    fontWeight: '700',
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 50,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalPrimaryButtonDisabled: {
    opacity: 0.55,
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
