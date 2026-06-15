import { DanceDetailModal } from '@/components/dance-detail-modal';
import { DanceVisionPracticeModal } from '@/components/dance-vision-practice-modal';
import { colors, radius } from '@/constants/theme';
import { danceClasses, type DanceClass } from '@/data/dances';
import { useGeneralServerDanceClasses } from '@/hooks/use-general-server-dance-classes';
import { getCurrentUserUuid, loadCurrentUserUuid } from '@/services/current-user';
import { loadFavoriteDanceIds, subscribeFavoriteDanceIds } from '@/services/favorite-dances';
import { fetchDailyIntakeKcal, fetchHomeSummary, fetchWeekActivity, type HomeSummary, type HomeWeekActivity } from '@/services/home-tab';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, ImageBackground, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

const DAY_KEYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

type DayKey = (typeof DAY_KEYS)[number];

type WeekDay = {
  name: DayKey;
  num: number;
  date: Date;
  dateKey: string;
  done: boolean;
};

type DayMetrics = {
  burnedCalories: number;
  burnedGoal: number;
  workoutMinutes: number;
  workoutGoal: number;
  intakeCalories: number;
  intakeGoal: number;
};

const DEFAULT_WORKOUT_GOAL_MINUTES = 80;

function getDayKey(date: Date): DayKey {
  return DAY_KEYS[(date.getDay() + 6) % 7];
}

function getStartOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function getStartOfWeek(date: Date) {
  const next = getStartOfDay(date);
  next.setDate(next.getDate() - ((next.getDay() + 6) % 7));
  return next;
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function buildWeekDays(today: Date, activeDateKeys: Set<string>): WeekDay[] {
  const startOfWeek = getStartOfWeek(today);

  return DAY_KEYS.map((name, index) => {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + index);
    const dateKey = getDateKey(date);

    return {
      name,
      num: date.getDate(),
      date,
      dateKey,
      done: activeDateKeys.has(dateKey),
    };
  });
}

function RingChart({ kcal, goal = 1950 }: { kcal: number; goal?: number }) {
  const safeGoal = Math.max(goal, 1);
  const pct = Math.min(kcal / safeGoal, 1);
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
  onOpen: (dance: DanceClass) => void;
};

function getMissionCaption(item: DanceClass) {
  const instructor = item.instructor?.trim();
  if (!instructor) {
    return '즐겨찾기한 클래스';
  }

  if (instructor.toLowerCase() === 'youtube') {
    return 'YouTube 클래스';
  }

  return instructor;
}

function MissionCard({ item, onOpen }: MissionCardProps) {
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
      <TouchableOpacity style={styles.missionCard} onPress={handlePress} activeOpacity={0.9}>
        {item.thumbnailUrl ? (
          <ImageBackground source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} imageStyle={styles.missionImage}>
            <View style={styles.missionImageOverlay} />
          </ImageBackground>
        ) : (
          <View style={[styles.missionFallback, { backgroundColor: `${item.color}1C` }]}>
            <View style={[styles.missionFallbackOrb, { backgroundColor: `${item.color}26` }]} />
            <View style={[styles.thumb, { backgroundColor: item.color }]}>
              <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={26} color="#fff" />
            </View>
          </View>
        )}

        <View style={[styles.missionTint, { backgroundColor: `${item.color}18` }]} />

        <View style={styles.missionInfo}>
          <View style={styles.missionBadge}>
            <Text style={styles.missionBadgeText}>즐겨찾기</Text>
          </View>
          <Text style={styles.missionName} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.missionSubtitle} numberOfLines={1}>
            {getMissionCaption(item)}
          </Text>
        </View>

        <View style={[styles.playBtn, { backgroundColor: item.color }]}>
          <Ionicons name="play" size={16} color="#fff" />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<DayKey>(() => getDayKey(new Date()));
  const [selectedDance, setSelectedDance] = useState<DanceClass | null>(null);
  const [practiceDance, setPracticeDance] = useState<DanceClass | null>(null);
  const [favoriteDanceIds, setFavoriteDanceIds] = useState<string[]>([]);
  const [currentUserId, setCurrentUserId] = useState(() => getCurrentUserUuid());
  const [homeSummary, setHomeSummary] = useState<HomeSummary | null>(null);
  const [weekActivity, setWeekActivity] = useState<Record<string, HomeWeekActivity>>({});
  const [dailyIntakeByDateKey, setDailyIntakeByDateKey] = useState<Record<string, number>>({});
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);
  const { classes: serverDanceClasses, isFallback } = useGeneralServerDanceClasses();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDate(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

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
    const unsubscribe = subscribeFavoriteDanceIds((nextFavoriteIds) => {
      setFavoriteDanceIds(nextFavoriteIds);
    });

    void loadFavoriteDanceIds().then((nextFavoriteIds) => {
      setFavoriteDanceIds(nextFavoriteIds);
    });

    return unsubscribe;
  }, []);

  const baseWeekDays = useMemo(() => buildWeekDays(currentDate, new Set()), [currentDate]);
  const weekDates = useMemo(() => baseWeekDays.map((day) => day.date), [baseWeekDays]);
  const activityDateKeys = useMemo(() => {
    const activeKeys = new Set<string>();

    Object.values(weekActivity).forEach((activity) => {
      if (activity.count > 0 || activity.kcal > 0 || activity.minutes > 0) {
        activeKeys.add(activity.dateKey);
      }
    });

    return activeKeys;
  }, [weekActivity]);
  const weekDays = useMemo(
    () =>
      baseWeekDays.map((day) => ({
        ...day,
        done: activityDateKeys.has(day.dateKey),
      })),
    [activityDateKeys, baseWeekDays]
  );

  const favoriteDances = useMemo(() => {
    const combinedClasses = [...serverDanceClasses, ...danceClasses];
    const classesById = new Map<string, DanceClass>();

    combinedClasses.forEach((dance) => {
      if (!classesById.has(dance.id)) {
        classesById.set(dance.id, dance);
      }
    });

    return favoriteDanceIds
      .map((danceId) => classesById.get(danceId) ?? null)
      .filter((dance): dance is DanceClass => dance !== null);
  }, [favoriteDanceIds, serverDanceClasses]);

  const selectedDayInfo = useMemo(
    () =>
      weekDays.find((day) => day.name === selectedDay) ??
      weekDays[0] ?? {
        name: 'MON',
        num: currentDate.getDate(),
        date: currentDate,
        dateKey: getDateKey(currentDate),
        done: false,
      },
    [currentDate, selectedDay, weekDays]
  );

  useFocusEffect(
    useCallback(() => {
      let isCancelled = false;

      if (!currentUserId) {
        return () => {
          isCancelled = true;
        };
      }

      // Home data can change in other tabs or flows, so refresh whenever this tab regains focus.
      setDailyIntakeByDateKey({});
      setHomeLoading(true);
      setHomeError(null);

      void Promise.all([
        fetchHomeSummary(currentUserId),
        fetchWeekActivity(currentUserId, weekDates),
      ])
        .then(([summary, activity]) => {
          if (isCancelled) {
            return;
          }

          setHomeSummary(summary);
          setWeekActivity(activity);
        })
        .catch((error) => {
          if (isCancelled) {
            return;
          }

          setHomeError(error instanceof Error ? error.message : 'Failed to load home data.');
        })
        .finally(() => {
          if (!isCancelled) {
            setHomeLoading(false);
          }
        });

      return () => {
        isCancelled = true;
      };
    }, [currentUserId, weekDates])
  );

  useEffect(() => {
    let isCancelled = false;

    const dateKey = selectedDayInfo.dateKey;
    if (!currentUserId || dailyIntakeByDateKey[dateKey] !== undefined) {
      return;
    }

    void fetchDailyIntakeKcal(currentUserId, selectedDayInfo.date)
      .then((intakeKcal) => {
        if (isCancelled) {
          return;
        }

        setDailyIntakeByDateKey((previousState) => ({
          ...previousState,
          [dateKey]: intakeKcal,
        }));
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setDailyIntakeByDateKey((previousState) => ({
          ...previousState,
          [dateKey]: 0,
        }));
      });

    return () => {
      isCancelled = true;
    };
  }, [currentUserId, dailyIntakeByDateKey, selectedDayInfo.date, selectedDayInfo.dateKey]);

  const selectedActivity = weekActivity[selectedDayInfo.dateKey];
  const selectedMetrics: DayMetrics = useMemo(() => {
    const targetKcal = homeSummary?.targetKcal ?? 0;
    const selectedIntakeKcal =
      dailyIntakeByDateKey[selectedDayInfo.dateKey] ??
      (selectedDayInfo.dateKey === getDateKey(currentDate) ? homeSummary?.todayIntakeKcal ?? 0 : 0);

    return {
      burnedCalories: selectedActivity?.kcal ?? 0,
      burnedGoal: targetKcal,
      workoutMinutes: selectedActivity?.minutes ?? 0,
      workoutGoal: DEFAULT_WORKOUT_GOAL_MINUTES,
      intakeCalories: selectedIntakeKcal,
      intakeGoal: targetKcal,
    };
  }, [currentDate, dailyIntakeByDateKey, homeSummary, selectedActivity, selectedDayInfo.dateKey]);

  const progressStats = useMemo(
    () => [
      {
        label: '\uC18C\uBAA8 \uCE7C\uB85C\uB9AC',
        val: `${selectedMetrics.burnedCalories.toLocaleString()}/${selectedMetrics.burnedGoal.toLocaleString()} kcal`,
        pct: selectedMetrics.burnedGoal > 0 ? selectedMetrics.burnedCalories / selectedMetrics.burnedGoal : 0,
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
        pct: selectedMetrics.intakeGoal > 0 ? selectedMetrics.intakeCalories / selectedMetrics.intakeGoal : 0,
        color: colors.teal,
      },
    ],
    [selectedMetrics]
  );

  const openDance = (dance: DanceClass) => {
    setSelectedDance(dance);
  };

  const displayUserName = homeSummary?.userName || 'USER';
  const currentStreakDays = homeSummary?.currentStreak ?? 0;

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{'\uCDA4\uCD9C \uC900\uBE44\uB410\uC5B4\uC694?'}</Text>
            <Text style={styles.username}>{displayUserName}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{displayUserName.slice(0, 1).toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.streak}>
          <Ionicons name="flame" size={24} color={colors.accent2} />
          <View style={styles.streakCopy}>
            <Text style={styles.streakTitle}>{`${currentStreakDays}\uC77C \uC5F0\uC18D \uB304\uC2A4 \uCC4C\uB9B0\uC9C0`}</Text>
            <Text style={styles.streakSub}>
              {'\uC624\uB298\uB3C4 \uC88B\uC544\uD558\uB294 \uCD64\uC744 \uACE0\uB974\uACE0 \uB9AC\uB4EC\uC744 \uC774\uC5B4\uAC00\uBCF4\uC138\uC694.'}
            </Text>
          </View>
          <View style={styles.streakBadge}>
            <Text style={styles.streakBadgeText}>{`${currentStreakDays}D`}</Text>
          </View>
        </View>

        {homeLoading ? (
          <View style={styles.catalogNotice}>
            <Text style={styles.catalogNoticeText}>{'홈 대시보드 데이터를 불러오는 중이에요.'}</Text>
          </View>
        ) : null}

        {homeError ? (
          <View style={styles.catalogNotice}>
            <Text style={styles.catalogNoticeText}>{homeError}</Text>
          </View>
        ) : null}

        {isFallback ? (
          <View style={styles.catalogNotice}>
            <Text style={styles.catalogNoticeText}>{'서버 연결이 잠시 불안정해서 기본 추천 클래스를 보여주고 있어요.'}</Text>
          </View>
        ) : null}

        <View style={styles.weekSection}>
          <Text style={styles.sectionLabel}>{'\uC774\uBC88 \uC8FC'}</Text>
          <FlatList
            data={weekDays}
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
            <Text style={styles.sectionTitle}>{'즐겨찾기'}</Text>
            <TouchableOpacity activeOpacity={0.8}>
              <Text style={styles.seeAll}>{'전체 보기'}</Text>
            </TouchableOpacity>
          </View>
          {favoriteDances.length > 0 ? (
            favoriteDances.map((item) => (
              <MissionCard key={item.id} item={item} onOpen={openDance} />
            ))
          ) : (
            <View style={styles.favoriteEmptyCard}>
              <Text style={styles.favoriteEmptyTitle}>{'아직 즐겨찾기한 클래스가 없어요.'}</Text>
              <Text style={styles.favoriteEmptyBody}>{'클래스 탭에서 마음에 드는 클래스의 즐겨찾기 버튼을 눌러보세요.'}</Text>
            </View>
          )}
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
  catalogNotice: {
    marginHorizontal: 20,
    marginBottom: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  catalogNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
    fontWeight: '600',
  },
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
  favoriteEmptyCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingHorizontal: 20,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  favoriteEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
    textAlign: 'center',
  },
  favoriteEmptyBody: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
    textAlign: 'center',
  },
  missionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 24,
    minHeight: 132,
    marginBottom: 12,
    overflow: 'hidden',
    justifyContent: 'space-between',
    padding: 18,
  },
  missionImage: {
    borderRadius: 24,
  },
  missionImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 7, 10, 0.5)',
  },
  missionFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    padding: 18,
  },
  missionFallbackOrb: {
    position: 'absolute',
    right: -16,
    top: -20,
    width: 110,
    height: 110,
    borderRadius: 55,
  },
  missionTint: {
    ...StyleSheet.absoluteFillObject,
  },
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  missionInfo: {
    flex: 1,
    justifyContent: 'space-between',
    minHeight: 96,
  },
  missionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
    backgroundColor: 'rgba(13, 13, 15, 0.58)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  missionBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.accent2,
    letterSpacing: 0.8,
  },
  missionName: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '900',
    color: colors.text1,
    marginTop: 14,
    marginBottom: 8,
    maxWidth: '84%',
  },
  missionSubtitle: {
    fontSize: 13,
    color: 'rgba(242,242,245,0.72)',
    fontWeight: '600',
  },
  playBtn: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
