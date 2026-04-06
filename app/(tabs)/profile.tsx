import { colors, radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const ACHIEVEMENTS = [
  { icon: 'flame', title: '12일 연속', sub: '스트릭 유지 중', unlocked: true, color: colors.accent },
  { icon: 'star', title: '100분 달성', sub: '연습 마스터', unlocked: true, color: colors.purple },
  { icon: 'trophy', title: '10회 완료', sub: '꾸준한 도전자', unlocked: true, color: '#F59E0B' },
  { icon: 'nutrition', title: '1만 kcal', sub: '칼로리 버너', unlocked: false, color: colors.text3 },
  { icon: 'heart', title: '5회 챌린지', sub: '목표 달성 직전', unlocked: false, color: colors.text3 },
  { icon: 'musical-notes', title: '장르 마스터', sub: '5개 장르 완료', unlocked: false, color: colors.text3 },
] as const;

const MENU_SECTIONS = [
  {
    title: '목표 및 건강',
    items: [
      { icon: 'nutrition-outline', label: '하루 칼로리 목표', value: '1,950 kcal', arrow: true },
      { icon: 'barbell-outline', label: '주간 운동 목표', value: '5회', arrow: true },
    ],
  },
  {
    title: '앱 설정',
    items: [
      { icon: 'notifications-outline', label: '운동 알림', toggle: true, defaultOn: false },
      { icon: 'moon-outline', label: '다크 모드', toggle: true, defaultOn: true },
      { icon: 'musical-notes-outline', label: '배경 음악 자동재생', toggle: true, defaultOn: true },
    ],
  },
  {
    title: '기타',
    items: [
      { icon: 'share-social-outline', label: '친구에게 공유', arrow: true },
      { icon: 'star-outline', label: '앱 평가하기', arrow: true },
      { icon: 'help-circle-outline', label: '문의 및 지원', arrow: true },
    ],
  },
] as const;

type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  arrow?: boolean;
  toggle?: boolean;
  defaultOn?: boolean;
  value?: string;
};

type BodyProfile = {
  heightCm: string;
  weightKg: string;
  targetWeightKg: string;
  targetDurationWeeks: string;
};

const INITIAL_BODY_PROFILE: BodyProfile = {
  heightCm: '',
  weightKg: '',
  targetWeightKg: '',
  targetDurationWeeks: '',
};

function MenuRow({ item }: { item: MenuItem }) {
  const [on, setOn] = useState(item.defaultOn ?? false);

  return (
    <View style={styles.menuItem}>
      <View style={styles.menuIcon}>
        <Ionicons name={item.icon} size={18} color={colors.text2} />
      </View>
      <Text style={styles.menuLabel}>{item.label}</Text>
      {item.value && <Text style={styles.menuValue}>{item.value}</Text>}
      {item.toggle && (
        <Switch
          value={on}
          onValueChange={setOn}
          trackColor={{ false: colors.border, true: colors.accent + '80' }}
          thumbColor={on ? colors.accent : colors.text3}
          ios_backgroundColor={colors.border}
        />
      )}
      {item.arrow && <Ionicons name="chevron-forward" size={16} color={colors.text3} />}
    </View>
  );
}

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

export default function ProfileScreen() {
  const [bodyProfile, setBodyProfile] = useState<BodyProfile>(INITIAL_BODY_PROFILE);
  const [draftBodyProfile, setDraftBodyProfile] = useState<BodyProfile>(INITIAL_BODY_PROFILE);
  const [isBodyModalVisible, setIsBodyModalVisible] = useState(false);

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
      return durationLabel ? `현재 체중과 목표가 같아요 · ${durationLabel}` : '현재 체중과 목표가 같아요';
    }

    const weightGoal = diff > 0 ? `${diff.toFixed(1)}kg 감량 목표` : `${Math.abs(diff).toFixed(1)}kg 증량 목표`;

    return durationLabel ? `${weightGoal} · ${durationLabel}` : weightGoal;
  }, [bodyProfile.targetDurationWeeks, bodyProfile.targetWeightKg, bodyProfile.weightKg]);

  const openBodyModal = () => {
    setDraftBodyProfile(bodyProfile);
    setIsBodyModalVisible(true);
  };

  const closeBodyModal = () => {
    setIsBodyModalVisible(false);
  };

  const saveBodyProfile = () => {
    setBodyProfile({
      heightCm: draftBodyProfile.heightCm.trim(),
      weightKg: draftBodyProfile.weightKg.trim(),
      targetWeightKg: draftBodyProfile.targetWeightKg.trim(),
      targetDurationWeeks: draftBodyProfile.targetDurationWeeks.trim(),
    });
    setIsBodyModalVisible(false);
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
              <Text style={styles.avatarText}>L</Text>
            </View>
            <View style={styles.levelRing} />
          </View>
          <Text style={styles.profileName}>LEE</Text>
          <Text style={styles.profileSub}>K-POP 루틴을 즐기는 댄스 유저</Text>
          <TouchableOpacity style={styles.editBtn} activeOpacity={0.85} onPress={openBodyModal}>
            <Text style={styles.editBtnText}>신체 정보 설정</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <SummaryCard value="12,850" unit="kcal" label="총 소모" showDivider />
          <SummaryCard value="107" unit="회" label="총 운동" showDivider />
          <SummaryCard value="12" unit="일" label="연속 기록" />
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>내 신체 정보</Text>
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
                  키, 몸무게, 목표 몸무게와 목표 기간을 저장해두고 나중에 프로필과 추천 로직에 연결할 수 있어요.
                </Text>
              </View>
            </View>

            <View style={styles.metricRow}>
              <BodyMetricCard label="키" value={bodyProfile.heightCm} unit="cm" />
              <BodyMetricCard label="몸무게" value={bodyProfile.weightKg} unit="kg" />
              <BodyMetricCard label="목표 몸무게" value={bodyProfile.targetWeightKg} unit="kg" />
              <BodyMetricCard label="목표 기간" value={bodyProfile.targetDurationWeeks} unit="주" />
            </View>

            <View style={styles.goalHint}>
              <Ionicons name="flag-outline" size={14} color={colors.text2} />
              <Text style={styles.goalHintText}>{targetDiff ?? '아직 목표 정보가 없어요. 프로필에서 먼저 설정해보세요.'}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>업적</Text>
            <Text style={styles.sectionSub}>3 / 6 달성</Text>
          </View>
          <View style={styles.achGrid}>
            {ACHIEVEMENTS.map((achievement) => (
              <View key={achievement.title} style={[styles.achItem, !achievement.unlocked && styles.achLocked]}>
                <View
                  style={[
                    styles.achIcon,
                    {
                      backgroundColor: achievement.unlocked ? achievement.color + '20' : colors.surface2,
                    },
                  ]}>
                  <Ionicons
                    name={achievement.icon}
                    size={24}
                    color={achievement.unlocked ? achievement.color : colors.text3}
                  />
                  {!achievement.unlocked && (
                    <View style={styles.lockIcon}>
                      <Ionicons name="lock-closed" size={10} color={colors.text3} />
                    </View>
                  )}
                </View>
                <Text style={[styles.achTitle, !achievement.unlocked && styles.achTitleLocked]}>
                  {achievement.title}
                </Text>
                <Text style={styles.achSub}>{achievement.sub}</Text>
              </View>
            ))}
          </View>
        </View>

        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.menuSectionTitle}>{section.title}</Text>
            <View style={styles.menuGroup}>
              {section.items.map((item, index) => (
                <View key={item.label}>
                  <MenuRow item={item as MenuItem} />
                  {index < section.items.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        ))}

        <View style={styles.bottomSpace} />
      </ScrollView>

      <Modal visible={isBodyModalVisible} transparent animationType="fade" onRequestClose={closeBodyModal}>
        <Pressable style={styles.modalBackdrop} onPress={closeBodyModal}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>신체 정보 설정</Text>
                <Text style={styles.modalSub}>회원가입 때 놓친 정보는 여기서 천천히 입력하면 돼요.</Text>
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
                <Text style={styles.fieldLabel}>현재 몸무게</Text>
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
                <Text style={styles.fieldLabel}>목표 몸무게</Text>
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
              <TouchableOpacity style={styles.modalPrimaryButton} onPress={saveBodyProfile} activeOpacity={0.85}>
                <Text style={styles.modalPrimaryText}>저장</Text>
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
    borderColor: colors.accent + '50',
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
    marginTop: 2,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text1,
  },
  sectionSub: {
    fontSize: 13,
    color: colors.text2,
  },
  sectionAction: {
    fontSize: 13,
    color: colors.accent,
    fontWeight: '700',
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
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent + '15',
  },
  bodyCardText: {
    flex: 1,
    gap: 4,
  },
  bodyCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text1,
  },
  bodyCardSub: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text2,
  },
  metricRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 10,
    rowGap: 10,
  },
  metricCard: {
    flexBasis: '48%',
    maxWidth: '48%',
    flexGrow: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 12,
    minHeight: 82,
    justifyContent: 'space-between',
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
    gap: 8,
    alignItems: 'center',
    padding: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
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
    gap: 10,
  },
  achItem: {
    width: '30%',
    alignItems: 'center',
    gap: 6,
  },
  achLocked: {
    opacity: 0.65,
  },
  achIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  lockIcon: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: colors.surface2,
    borderRadius: 6,
    padding: 2,
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.text1,
    fontWeight: '500',
  },
  menuValue: {
    fontSize: 13,
    color: colors.text2,
    marginRight: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 60,
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
    gap: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 6,
  },
  modalSub: {
    fontSize: 13,
    lineHeight: 19,
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
  fieldGroup: {
    gap: 8,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldGroupHalf: {
    width: '48%',
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text1,
  },
  input: {
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    paddingHorizontal: 14,
    fontSize: 14,
    color: colors.text1,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalSecondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  modalSecondaryText: {
    color: colors.text1,
    fontSize: 14,
    fontWeight: '700',
  },
  modalPrimaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  modalPrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
