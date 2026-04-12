import { DanceDetailModal } from '@/components/dance-detail-modal';
import { DanceVisionPracticeModal } from '@/components/dance-vision-practice-modal';
import { colors, radius } from '@/constants/theme';
import { danceClasses, featuredDanceIds, type DanceClass } from '@/data/dances';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef, useState } from 'react';
import { Animated, FlatList, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const DAYS = [
  { name: 'MON', num: 10, done: true },
  { name: 'TUE', num: 11, done: true },
  { name: 'WED', num: 12, done: true },
  { name: 'THU', num: 13, done: true },
  { name: 'FRI', num: 14, done: false },
  { name: 'SAT', num: 15, done: false },
  { name: 'SUN', num: 16, done: false },
] as const;

type DayKey = (typeof DAYS)[number]['name'];

const DAY_METRICS: Record<
  DayKey,
  {
    burnedCalories: number;
    burnedGoal: number;
    workoutMinutes: number;
    workoutGoal: number;
    intakeCalories: number;
    intakeGoal: number;
  }
> = {
  MON: {
    burnedCalories: 1120,
    burnedGoal: 1950,
    workoutMinutes: 38,
    workoutGoal: 80,
    intakeCalories: 1490,
    intakeGoal: 2100,
  },
  TUE: {
    burnedCalories: 1360,
    burnedGoal: 1950,
    workoutMinutes: 49,
    workoutGoal: 80,
    intakeCalories: 1620,
    intakeGoal: 2100,
  },
  WED: {
    burnedCalories: 980,
    burnedGoal: 1950,
    workoutMinutes: 31,
    workoutGoal: 80,
    intakeCalories: 1710,
    intakeGoal: 2100,
  },
  THU: {
    burnedCalories: 1250,
    burnedGoal: 1950,
    workoutMinutes: 45,
    workoutGoal: 80,
    intakeCalories: 1580,
    intakeGoal: 2100,
  },
  FRI: {
    burnedCalories: 1430,
    burnedGoal: 1950,
    workoutMinutes: 57,
    workoutGoal: 80,
    intakeCalories: 1750,
    intakeGoal: 2100,
  },
  SAT: {
    burnedCalories: 1680,
    burnedGoal: 1950,
    workoutMinutes: 66,
    workoutGoal: 80,
    intakeCalories: 1890,
    intakeGoal: 2100,
  },
  SUN: {
    burnedCalories: 890,
    burnedGoal: 1950,
    workoutMinutes: 29,
    workoutGoal: 80,
    intakeCalories: 1460,
    intakeGoal: 2100,
  },
};

function RingChart({ kcal, goal = 1950 }: { kcal: number; goal?: number }) {
  const pct = Math.min(kcal / goal, 1);
  const outerRadius = 44;
  const innerRadius = 30;
  const size = 110;
  const outerCircumference = 2 * Math.PI * outerRadius;
  const innerCircumference = 2 * Math.PI * innerRadius;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={cx} cy={cy} r={outerRadius} stroke={colors.surface2} strokeWidth={10} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={outerRadius}
          stroke={colors.accent}
          strokeWidth={10}
          fill="none"
          strokeDasharray={outerCircumference}
          strokeDashoffset={outerCircumference * (1 - pct)}
          strokeLinecap="round"
        />
        <Circle cx={cx} cy={cy} r={innerRadius} stroke={colors.surface2} strokeWidth={8} fill="none" />
        <Circle
          cx={cx}
          cy={cy}
          r={innerRadius}
          stroke={colors.purple}
          strokeWidth={8}
          fill="none"
          strokeDasharray={innerCircumference}
          strokeDashoffset={innerCircumference * 0.45}
          strokeLinecap="round"
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringKcal}>{kcal.toLocaleString()}</Text>
        <Text style={styles.ringUnit}>kcal</Text>
      </View>
    </View>
  );
}

type MissionCardProps = {
  item: DanceClass;
  isLive?: boolean;
  onOpen: (dance: DanceClass) => void;
};

function MissionCard({ item, isLive, onOpen }: MissionCardProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: true }),
    ]).start();
    onOpen(item);
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.missionCard, isLive && { borderColor: colors.accent + '50' }]}
        onPress={handlePress}
        activeOpacity={0.9}>
        {isLive && (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        )}
        <View style={[styles.thumb, { backgroundColor: item.color }]}>
          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={26} color="#fff" />
        </View>
        <View style={styles.missionInfo}>
          <Text style={[styles.missionGenre, { color: item.color }]}>{item.genre}</Text>
          <Text style={styles.missionName} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={styles.metaRow}>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{item.level}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{item.duration}</Text>
            </View>
            <View style={styles.metaPill}>
              <Text style={styles.metaText}>{item.kcal} kcal</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={[styles.playBtn, { backgroundColor: item.color }]} onPress={handlePress}>
          <Ionicons name="play" size={16} color="#fff" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const [selectedDay, setSelectedDay] = useState<DayKey>('THU');
  const [selectedDance, setSelectedDance] = useState<DanceClass | null>(null);
  const [practiceDance, setPracticeDance] = useState<DanceClass | null>(null);

  const favoriteDances = useMemo(
    () => danceClasses.filter((dance) => featuredDanceIds.includes(dance.id as (typeof featuredDanceIds)[number])),
    []
  );

  const selectedDayInfo = useMemo(
    () => DAYS.find((day) => day.name === selectedDay) ?? DAYS[0],
    [selectedDay]
  );

  const selectedMetrics = DAY_METRICS[selectedDay];

  const progressStats = useMemo(
    () => [
      {
        label: '\uC18C\uBAA8 \uCE7C\uB85C\uB9AC',
        val: `${selectedMetrics.burnedCalories.toLocaleString()}/${selectedMetrics.burnedGoal.toLocaleString()}`,
        pct: selectedMetrics.burnedCalories / selectedMetrics.burnedGoal,
        color: colors.accent,
      },
      {
        label: '\uC6B4\uB3D9 \uC2DC\uAC04',
        val: `${selectedMetrics.workoutMinutes}/${selectedMetrics.workoutGoal}\uBD84`,
        pct: selectedMetrics.workoutMinutes / selectedMetrics.workoutGoal,
        color: colors.purple,
      },
      {
        label: '\uC12D\uCDE8 \uCE7C\uB85C\uB9AC',
        val: `${selectedMetrics.intakeCalories.toLocaleString()}/${selectedMetrics.intakeGoal.toLocaleString()} kcal`,
        pct: selectedMetrics.intakeCalories / selectedMetrics.intakeGoal,
        color: colors.teal,
      },
    ],
    [selectedMetrics]
  );

  const openDance = (dance: DanceClass) => {
    setSelectedDance(dance);
  };

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{'\uCDA4\uCD9C \uC900\uBE44\uB410\uC5B4\uC694?'}</Text>
            <Text style={styles.username}>LEE</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>L</Text>
          </View>
        </View>

        <View style={styles.streak}>
          <Ionicons name="flame" size={24} color={colors.accent2} />
          <View style={styles.streakCopy}>
            <Text style={styles.streakTitle}>{'\u0031\u0032\uC77C \uC5F0\uC18D \uB304\uC2A4 \uCC4C\uB9B0\uC9C0'}</Text>
            <Text style={styles.streakSub}>
              {'\uC624\uB298\uB3C4 \uC88B\uC544\uD558\uB294 \uCD64\uC744 \uACE0\uB974\uACE0 \uB9AC\uB4EC\uC744 \uC774\uC5B4\uAC00\uBCF4\uC138\uC694.'}
            </Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakBadgeText}>12D</Text>
          </View>
        </View>

        <View style={styles.weekSection}>
          <Text style={styles.sectionLabel}>{'\uC774\uBC88 \uC8FC'}</Text>
          <FlatList
            data={DAYS}
            extraData={selectedDay}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dayList}
            keyExtractor={(day) => day.name}
            renderItem={({ item }) => {
              const isSelected = item.name === selectedDay;

              return (
                <TouchableOpacity
                  style={[styles.dayChip, item.done && styles.dayDone, isSelected && styles.dayActive]}
                  onPress={() => setSelectedDay(item.name)}
                  activeOpacity={0.85}>
                  <Text style={[styles.dayName, isSelected && { color: 'rgba(255,255,255,0.82)' }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.dayNum, isSelected && { color: '#fff' }]}>{item.num}</Text>
                  <View
                    style={[
                      styles.dayDot,
                      item.done && { backgroundColor: colors.accent },
                      isSelected && { backgroundColor: '#fff' },
                    ]}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>

        <View style={styles.ringCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>{'\uC624\uB298\uC758 \uC6C0\uC9C1\uC784 \uC9C4\uD589\uB3C4'}</Text>
            <View style={styles.cardBadge}>
              <Text style={styles.cardBadgeText}>{`${selectedDayInfo.name} ${selectedDayInfo.num}`}</Text>
            </View>
          </View>

          <View style={styles.ringRow}>
            <RingChart kcal={selectedMetrics.burnedCalories} goal={selectedMetrics.burnedGoal} />
            <View style={styles.ringStats}>
              {progressStats.map((stat) => (
                <View key={stat.label} style={styles.statRow}>
                  <View style={[styles.statDot, { backgroundColor: stat.color }]} />
                  <View style={styles.statContent}>
                    <Text style={styles.statLabel} numberOfLines={1}>
                      {`${stat.label} ${stat.val}`}
                    </Text>
                    <View style={styles.statTrack}>
                      <View
                        style={[
                          styles.statFill,
                          { width: `${Math.min(stat.pct, 1) * 100}%` as const, backgroundColor: stat.color },
                        ]}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{'\uC990\uACA8\uCC3E\uAE30 \uCD64'}</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.seeAll}>{'\uC804\uCCB4 \uBCF4\uAE30'}</Text>
            </TouchableOpacity>
          </View>
          {favoriteDances.map((item, index) => (
            <MissionCard key={item.id} item={item} isLive={index === 0} onOpen={openDance} />
          ))}
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>

      <DanceDetailModal
        dance={selectedDance}
        visible={selectedDance !== null}
        onClose={() => setSelectedDance(null)}
        onStart={(dance) => {
          setSelectedDance(null);
          setPracticeDance(dance);
        }}
      />
      <DanceVisionPracticeModal
        dance={practiceDance}
        visible={practiceDance !== null}
        onClose={() => setPracticeDance(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  greeting: { fontSize: 13, color: colors.text2 },
  username: { fontSize: 34, fontWeight: '800', color: colors.text1, letterSpacing: 1, marginTop: 2 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  streak: {
    marginHorizontal: 20,
    marginBottom: 18,
    backgroundColor: colors.accent + '12',
    borderWidth: 1,
    borderColor: colors.accent + '30',
    borderRadius: radius.lg,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  streakCopy: {
    flex: 1,
    marginLeft: 12,
  },
  streakTitle: { fontSize: 13, fontWeight: '700', color: colors.accent2, marginBottom: 2 },
  streakSub: { fontSize: 12, color: colors.text2 },
  streakBadge: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  streakBadgeText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  weekSection: {
    marginBottom: 18,
  },
  ringCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 20,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  cardLabel: { fontSize: 13, color: colors.text2, fontWeight: '500' },
  cardBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.text1,
    letterSpacing: 0.4,
  },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ringCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringKcal: { fontSize: 22, fontWeight: '800', color: colors.text1, letterSpacing: 0.5 },
  ringUnit: { fontSize: 10, color: colors.text2, marginTop: 1 },
  ringStats: { flex: 1, gap: 10 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statContent: { flex: 1 },
  statLabel: { fontSize: 11, color: colors.text2, fontWeight: '600', marginBottom: 3 },
  statTrack: { height: 4, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  statFill: { height: '100%', borderRadius: 4 },
  sectionLabel: {
    fontSize: 13,
    color: colors.text2,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  dayList: { paddingHorizontal: 20, gap: 8 },
  dayChip: {
    width: 52,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dayDone: { backgroundColor: colors.surface2, borderColor: colors.accent + '40' },
  dayActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  dayName: { fontSize: 10, fontWeight: '700', color: colors.text2, letterSpacing: 1 },
  dayNum: { fontSize: 18, fontWeight: '600', color: colors.text1 },
  dayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.border },
  section: { marginTop: 24, paddingHorizontal: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: colors.text1, letterSpacing: 0.5 },
  seeAll: { fontSize: 13, color: colors.accent, fontWeight: '600' },
  missionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 10,
  },
  liveBadge: {
    position: 'absolute',
    top: 12,
    right: 66,
    backgroundColor: colors.accent,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 20,
  },
  liveBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  thumb: { width: 60, height: 60, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  missionInfo: { flex: 1 },
  missionGenre: { fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  missionName: { fontSize: 15, fontWeight: '700', color: colors.text1, marginBottom: 6 },
  metaRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  metaPill: {
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaText: { fontSize: 11, color: colors.text2 },
  playBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
