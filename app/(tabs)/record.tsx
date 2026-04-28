import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { colors, radius } from '@/constants/theme';

type RecordTab = 'weekly' | 'monthly';
type ChartPoint = { label: string; kcal: number; active?: boolean };
type Session = {
  key: string;
  day: number;
  date: Date;
  dateKey: string;
  dateLabel: string;
  weekday: string;
  time: string;
  name: string;
  kcal: number;
  duration: number;
  icon: string;
  color: string;
};
type Stat = {
  label: string;
  value: string;
  unit?: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};
type CalendarDay = { day: number; dateKey: string; kcal: number; minutes: number; count: number; isToday: boolean };

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const TIMES = ['07:20', '09:10', '12:40', '18:10', '19:30', '20:50', '21:40'];
const TEMPLATES = [
  { name: 'Jazz Lines 루틴', icon: '🎷', color: colors.accent, kcal: 180, duration: 18 },
  { name: 'K-POP 챌린지', icon: '🎤', color: colors.purple, kcal: 230, duration: 24 },
  { name: '힙합 파워 무브', icon: '🔥', color: colors.accent2, kcal: 280, duration: 30 },
  { name: '스트레치 & 밸런스', icon: '🧘', color: colors.teal, kcal: 120, duration: 16 },
  { name: '걸스힙합 콤보', icon: '✨', color: '#F59E0B', kcal: 250, duration: 28 },
  { name: '댄스 카디오 부스터', icon: '💥', color: '#38BDF8', kcal: 300, duration: 32 },
];

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const monthTitle = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
const durationText = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
};

function makeSessions(selectedMonth: Date) {
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const seed = month + 1;
  const count = 11 + (seed % 4);
  const list: Session[] = [];

  for (let i = 0; i < count; i += 1) {
    const template = TEMPLATES[(i + seed) % TEMPLATES.length];
    const day = ((seed * 3 + i * 5 + (i % 2) * 2) % daysInMonth) + 1;
    const date = new Date(year, month, day);
    const kcal = template.kcal + (((seed + 2) * (i + 3) * 17) % 90);
    const duration = template.duration + (((seed + i) * 7) % 14);
    list.push({
      key: `${day}-${i}`,
      day,
      date,
      dateKey: dateKey(date),
      dateLabel: `${month + 1}월 ${day}일`,
      weekday: WEEKDAYS[date.getDay()],
      time: TIMES[(i + seed) % TIMES.length],
      name: template.name,
      kcal,
      duration,
      icon: template.icon,
      color: template.color,
    });
  }

  return list.sort((a, b) => (b.date.getTime() - a.date.getTime()) || b.time.localeCompare(a.time));
}

function weekRange(selectedMonth: Date) {
  const today = new Date();
  const end = sameMonth(today, selectedMonth)
    ? new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), today.getDate())
    : new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
  const start = new Date(end);
  start.setDate(end.getDate() - 6);
  return { start, end };
}

function chart(data: Session[], selectedMonth: Date, mode: RecordTab) {
  if (mode === 'monthly') {
    const buckets = [0, 0, 0, 0, 0];
    data.forEach((item) => {
      buckets[Math.floor((item.day - 1) / 7)] += item.kcal;
    });
    const max = Math.max(...buckets, 0);
    return buckets
      .map((kcal, i) => ({ label: `${i + 1}주차`, kcal, active: kcal > 0 && kcal === max }))
      .filter((item, i, arr) => item.kcal > 0 || i < arr.length - 1);
  }

  const { start, end } = weekRange(selectedMonth);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      label: WEEKDAYS[d.getDay()],
      kcal: data.filter((item) => sameDay(item.date, d)).reduce((sum, item) => sum + item.kcal, 0),
      active: sameDay(d, end),
    };
  });
}

function statsForWeekly(points: ChartPoint[], sessions: Session[]): Stat[] {
  const totalKcal = points.reduce((sum, item) => sum + item.kcal, 0);
  const totalMinutes = sessions.reduce((sum, item) => sum + item.duration, 0);
  const activeDays = points.filter((item) => item.kcal > 0).length;
  const avg = activeDays ? Math.round(totalKcal / activeDays) : 0;
  return [
    { label: '이번 주 소모', value: totalKcal.toLocaleString(), unit: 'kcal', icon: 'flame', color: colors.accent },
    { label: '운동 시간', value: String(totalMinutes), unit: '분', icon: 'time', color: colors.purple },
    { label: '운동한 날', value: String(activeDays), unit: '일', icon: 'calendar', color: colors.teal },
    { label: '활동일 평균', value: avg.toLocaleString(), unit: 'kcal', icon: 'stats-chart', color: '#F59E0B' },
  ];
}

function statsForMonthly(points: ChartPoint[], sessions: Session[]): Stat[] {
  const totalKcal = sessions.reduce((sum, item) => sum + item.kcal, 0);
  const totalMinutes = sessions.reduce((sum, item) => sum + item.duration, 0);
  const activeDays = new Set(sessions.map((item) => item.dateKey)).size;
  const avgKcal = sessions.length ? Math.round(totalKcal / sessions.length) : 0;
  const peak = points.reduce((best, point) => (point.kcal > best.kcal ? point : best), points[0] ?? { label: '-', kcal: 0 });
  return [
    { label: '이번 달 소모', value: totalKcal.toLocaleString(), unit: 'kcal', icon: 'flame', color: colors.accent },
    { label: '총 운동 시간', value: durationText(totalMinutes), icon: 'time', color: colors.purple },
    { label: '운동한 날짜', value: String(activeDays), unit: '일', icon: 'calendar', color: colors.teal },
    { label: '주간 피크', value: peak.label, unit: `${peak.kcal.toLocaleString()} kcal`, icon: 'sparkles', color: colors.accent2 },
    { label: '세션 평균 소모', value: avgKcal.toLocaleString(), unit: 'kcal', icon: 'pulse', color: '#22C55E' },
    { label: '총 세션 수', value: String(sessions.length), unit: '회', icon: 'checkmark-circle', color: '#38BDF8' },
  ];
}

function byDate(items: Session[]) {
  return items.reduce<Record<string, Session[]>>((acc, item) => {
    acc[item.dateKey] = [...(acc[item.dateKey] ?? []), item];
    return acc;
  }, {});
}

function makeCalendar(selectedMonth: Date, sessions: Session[]) {
  const year = selectedMonth.getFullYear();
  const month = selectedMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const days: CalendarDay[] = Array.from({ length: daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(year, month, day);
    const items = sessions.filter((item) => item.day === day);
    return {
      day,
      dateKey: dateKey(date),
      kcal: items.reduce((sum, item) => sum + item.kcal, 0),
      minutes: items.reduce((sum, item) => sum + item.duration, 0),
      count: items.length,
      isToday: sameDay(today, date),
    };
  });

  const firstWeekday = new Date(year, month, 1).getDay();
  const cells: Array<CalendarDay | null> = Array.from({ length: firstWeekday }, () => null);
  days.forEach((day) => cells.push(day));
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
}

function BarChart({ data }: { data: ChartPoint[] }) {
  const max = Math.max(...data.map((item) => item.kcal), 1);
  const width = 320;
  const height = 138;
  const bar = data.length > 5 ? 30 : 42;
  const gap = data.length > 1 ? (width - bar * data.length) / (data.length - 1) : 0;
  return (
    <Svg width="100%" height={height + 28} viewBox={`0 0 ${width} ${height + 28}`}>
      {[0.25, 0.5, 0.75].map((ratio) => {
        const y = height - height * ratio;
        return <Line key={ratio} x1="0" y1={y} x2={width} y2={y} stroke={colors.border} strokeDasharray="4 6" />;
      })}
      {data.map((item, i) => {
        const h = Math.max((item.kcal / max) * height, item.kcal > 0 ? 6 : 0);
        const x = i * (bar + gap);
        const fill = item.active ? colors.accent : item.kcal > 0 ? colors.purple : colors.border;
        return (
          <G key={`${item.label}-${i}`}>
            <Rect x={x} y={height - h} width={bar} height={Math.max(h, 6)} rx={8} fill={fill} fillOpacity={item.active ? 1 : 0.78} />
            <SvgText x={x + bar / 2} y={height + 18} fontSize={11} fill={item.active ? colors.accent : colors.text3} textAnchor="middle" fontWeight={item.active ? '700' : '500'}>
              {item.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function StatCard({ item, strong = false }: { item: Stat; strong?: boolean }) {
  return (
    <View style={[styles.statCard, strong && styles.statCardStrong]}>
      <View style={[styles.statIcon, { backgroundColor: `${item.color}20` }]}>
        <Ionicons name={item.icon} size={18} color={item.color} />
      </View>
      <Text style={styles.statLabel}>{item.label}</Text>
      <Text style={styles.statValue}>
        {item.value}
        {item.unit ? <Text style={styles.statUnit}> {item.unit}</Text> : null}
      </Text>
    </View>
  );
}

function HistoryRow({ item }: { item: Session }) {
  return (
    <View style={styles.historyItem}>
      <View style={[styles.historyIcon, { backgroundColor: `${item.color}20` }]}>
        <Text style={styles.historyEmoji}>{item.icon}</Text>
      </View>
      <View style={styles.historyBody}>
        <Text style={styles.historyName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.historyMeta}>{item.weekday} · {item.time} · {item.duration}분</Text>
      </View>
      <View style={styles.historyKcal}>
        <Text style={[styles.kcalValue, { color: item.color }]}>{item.kcal}</Text>
        <Text style={styles.kcalUnit}>kcal</Text>
      </View>
    </View>
  );
}

function MonthPicker({
  visible,
  selectedMonth,
  pickerYear,
  onChangeYear,
  onClose,
  onPickMonth,
  onPickCurrentMonth,
}: {
  visible: boolean;
  selectedMonth: Date;
  pickerYear: number;
  onChangeYear: (next: number) => void;
  onClose: () => void;
  onPickMonth: (monthIndex: number) => void;
  onPickCurrentMonth: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.monthModal} onPress={() => undefined}>
          <View style={styles.rowBetween}>
            <Text style={styles.monthModalTitle}>조회할 달 선택</Text>
            <TouchableOpacity style={styles.monthModalClose} onPress={onClose} activeOpacity={0.85}>
              <Ionicons name="close" size={18} color={colors.text2} />
            </TouchableOpacity>
          </View>
          <View style={[styles.rowBetween, styles.yearRow]}>
            <TouchableOpacity style={styles.yearButton} onPress={() => onChangeYear(pickerYear - 1)} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={18} color={colors.text1} />
            </TouchableOpacity>
            <Text style={styles.yearText}>{pickerYear}년</Text>
            <TouchableOpacity style={styles.yearButton} onPress={() => onChangeYear(pickerYear + 1)} activeOpacity={0.85}>
              <Ionicons name="chevron-forward" size={18} color={colors.text1} />
            </TouchableOpacity>
          </View>
          <View style={styles.monthGrid}>
            {MONTHS.map((label, idx) => {
              const active = selectedMonth.getFullYear() === pickerYear && selectedMonth.getMonth() === idx;
              return (
                <TouchableOpacity key={label} style={[styles.monthChip, active && styles.monthChipActive]} onPress={() => onPickMonth(idx)} activeOpacity={0.85}>
                  <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.todayButton} onPress={onPickCurrentMonth} activeOpacity={0.85}>
            <Text style={styles.todayButtonText}>이번 달로 이동</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function RecordScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const [tab, setTab] = useState<RecordTab>('weekly');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedMonth.getFullYear());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);

  const sessions = useMemo(() => makeSessions(selectedMonth), [selectedMonth]);
  const monthlyPoints = useMemo(() => chart(sessions, selectedMonth, 'monthly'), [sessions, selectedMonth]);
  const weeklyPoints = useMemo(() => chart(sessions, selectedMonth, 'weekly'), [sessions, selectedMonth]);
  const { start, end } = useMemo(() => weekRange(selectedMonth), [selectedMonth]);
  const weeklySessions = useMemo(() => sessions.filter((item) => item.date >= start && item.date <= end), [sessions, start, end]);
  const weeklyStats = useMemo(() => statsForWeekly(weeklyPoints, weeklySessions), [weeklyPoints, weeklySessions]);
  const monthlyStats = useMemo(() => statsForMonthly(monthlyPoints, sessions), [monthlyPoints, sessions]);
  const groupedWeekly = useMemo(() => byDate(weeklySessions), [weeklySessions]);
  const groupedAll = useMemo(() => byDate(sessions), [sessions]);
  const calendar = useMemo(() => makeCalendar(selectedMonth, sessions), [selectedMonth, sessions]);
  const monthSummary = useMemo(() => ({
    kcal: sessions.reduce((sum, item) => sum + item.kcal, 0),
    minutes: sessions.reduce((sum, item) => sum + item.duration, 0),
    activeDays: new Set(sessions.map((item) => item.dateKey)).size,
  }), [sessions]);

  useEffect(() => {
    setSelectedDateKey(sessions[0]?.dateKey ?? null);
  }, [sessions, selectedMonth]);

  const selectedDay = useMemo(() => {
    for (const week of calendar) {
      for (const day of week) {
        if (day?.dateKey === selectedDateKey) return day;
      }
    }
    return null;
  }, [calendar, selectedDateKey]);

  const selectedItems = useMemo(() => (selectedDay ? groupedAll[selectedDay.dateKey] ?? [] : []), [groupedAll, selectedDay]);
  const weeklyTotal = useMemo(() => weeklyPoints.reduce((sum, item) => sum + item.kcal, 0), [weeklyPoints]);
  const peakWeek = useMemo(() => monthlyPoints.reduce((best, point) => (point.kcal > best.kcal ? point : best), monthlyPoints[0] ?? { label: '-', kcal: 0 }), [monthlyPoints]);
  const calendarCellWidth = useMemo(() => {
    const screenPadding = 40;
    const cardInnerPadding = 28;
    const weekGapTotal = 36;
    return Math.max(36, Math.floor((windowWidth - screenPadding - cardInnerPadding - weekGapTotal) / 7));
  }, [windowWidth]);

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={[styles.rowBetween, styles.header]}>
          <View>
            <Text style={styles.title}>기록</Text>
            <Text style={styles.caption}>{monthTitle(selectedMonth)}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={() => { setPickerYear(selectedMonth.getFullYear()); setCalendarVisible(true); }} activeOpacity={0.85}>
            <Ionicons name="calendar-outline" size={20} color={colors.text2} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {(['weekly', 'monthly'] as const).map((next) => (
            <TouchableOpacity key={next} style={[styles.tab, tab === next && styles.tabActive]} onPress={() => setTab(next)} activeOpacity={0.85}>
              <Text style={[styles.tabText, tab === next && styles.tabTextActive]}>{next === 'weekly' ? '주간 보기' : '월간 보기'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'weekly' ? (
          <>
            <View style={styles.grid}>
              {weeklyStats.map((item) => <StatCard key={item.label} item={item} />)}
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.cardTitle}>최근 7일 소모 흐름</Text>
                  <Text style={styles.cardSub}>{monthTitle(selectedMonth)} 기준 최근 주간</Text>
                </View>
                <Text style={styles.cardMeta}>총 {weeklyTotal.toLocaleString()} kcal</Text>
              </View>
              <View style={styles.chartWrap}>
                <BarChart data={weeklyPoints} />
              </View>
            </View>

            <View style={[styles.card, styles.tipCard]}>
              <View style={styles.tipIcon}>
                <Ionicons name="sparkles" size={18} color={colors.accent} />
              </View>
              <View style={styles.tipBody}>
                <Text style={styles.tipTitle}>주간 인사이트</Text>
                <Text style={styles.tipText}>
                  최근 7일 중 {weeklyPoints.filter((item) => item.kcal > 0).length}일 운동했고 가장 강했던 날은{' '}
                  {weeklyPoints.reduce((best, point) => (point.kcal > best.kcal ? point : best), weeklyPoints[0]).label}요일이었어요.
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>주간 운동 이력</Text>
                <Text style={styles.sectionSub}>최근 7일</Text>
              </View>
              {Object.entries(groupedWeekly).length > 0 ? (
                Object.entries(groupedWeekly).map(([key, items]) => (
                  <View key={key} style={styles.group}>
                    <Text style={styles.groupLabel}>{items[0]?.dateLabel}</Text>
                    {items.map((item) => <HistoryRow key={item.key} item={item} />)}
                  </View>
                ))
              ) : (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyTitle}>이번 주 운동 기록이 없어요</Text>
                  <Text style={styles.emptyText}>운동을 시작하면 최근 7일 이력이 여기에 정리됩니다.</Text>
                </View>
              )}
            </View>
          </>
        ) : (
          <>
            <View style={styles.hero}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.heroEyebrow}>MONTHLY OVERVIEW</Text>
                  <Text style={styles.heroTitle}>{monthTitle(selectedMonth)} 리포트</Text>
                </View>
                <View style={styles.heroBadge}>
                  <Ionicons name="flame" size={14} color="#fff" />
                  <Text style={styles.heroBadgeText}>{monthSummary.kcal.toLocaleString()} kcal</Text>
                </View>
              </View>
              <View style={styles.heroMetrics}>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricLabel}>이번 달 소모</Text>
                  <Text style={styles.heroMetricValue}>{monthSummary.kcal.toLocaleString()}</Text>
                  <Text style={styles.heroMetricUnit}>kcal</Text>
                </View>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricLabel}>운동 시간</Text>
                  <Text style={styles.heroMetricValue}>{durationText(monthSummary.minutes)}</Text>
                </View>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricLabel}>운동한 날짜</Text>
                  <Text style={styles.heroMetricValue}>{monthSummary.activeDays}일</Text>
                </View>
              </View>
            </View>

            <View style={styles.grid}>
              {monthlyStats.map((item, index) => <StatCard key={item.label} item={item} strong={index === 0} />)}
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.cardTitle}>월간 주차별 소모</Text>
                  <Text style={styles.cardSub}>주차별 리듬을 한눈에 확인해보세요</Text>
                </View>
                <Text style={styles.cardMeta}>피크 {peakWeek.label}</Text>
              </View>
              <View style={styles.chartWrap}>
                <BarChart data={monthlyPoints} />
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>월간 캘린더</Text>
                <Text style={styles.sectionSub}>날짜를 눌러 이력을 확인하세요</Text>
              </View>

              <View style={styles.calendarCard}>
                <View style={styles.weekHeader}>
                  {WEEKDAYS.map((label) => (
                    <Text key={label} style={[styles.weekHeaderText, { width: calendarCellWidth }]}>
                      {label}
                    </Text>
                  ))}
                </View>
                {calendar.map((week, index) => (
                  <View key={`week-${index}`} style={styles.weekRow}>
                    {week.map((day, dayIndex) => {
                      if (!day) {
                        return <View key={`empty-${index}-${dayIndex}`} style={[styles.dayEmpty, { width: calendarCellWidth }]} />;
                      }
                      const active = day.count > 0;
                      const selected = selectedDay?.dateKey === day.dateKey;
                      return (
                        <TouchableOpacity
                          key={day.dateKey}
                          style={[
                            styles.dayCell,
                            { width: calendarCellWidth },
                            active && styles.dayCellActive,
                            selected && styles.dayCellSelected,
                          ]}
                          onPress={() => setSelectedDateKey(day.dateKey)}
                          activeOpacity={0.85}>
                          <View style={styles.rowBetween}>
                            <Text style={[styles.dayText, day.isToday && styles.dayToday, selected && styles.dayTextSelected]}>{day.day}</Text>
                            {active ? <View style={styles.dayDot} /> : null}
                          </View>
                          <Text style={[styles.dayKcal, selected && styles.dayTextSelected]}>{active ? day.kcal : '-'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={[styles.card, styles.inlineCard]}>
                <View style={styles.rowBetween}>
                  <View>
                    <Text style={styles.cardTitle}>{selectedDay ? `${selectedDay.day}일 기록` : '선택한 날짜 기록'}</Text>
                    <Text style={styles.cardSub}>
                      {selectedDay?.count ? `${selectedDay.count}회 · ${selectedDay.kcal.toLocaleString()} kcal · ${selectedDay.minutes}분` : '이 날짜에는 기록이 없어요'}
                    </Text>
                  </View>
                  <Ionicons name="footsteps-outline" size={20} color={colors.text2} />
                </View>
                <View style={styles.dayList}>
                  {selectedItems.length > 0 ? (
                    selectedItems.map((item) => <HistoryRow key={item.key} item={item} />)
                  ) : (
                    <View style={styles.emptyCardSoft}>
                      <Text style={styles.emptyTitle}>운동 기록 없음</Text>
                      <Text style={styles.emptyText}>다른 날짜를 선택하거나 이번 달 운동을 시작해보세요.</Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          </>
        )}

        <View style={styles.spacer} />
      </ScrollView>

      <MonthPicker
        visible={calendarVisible}
        selectedMonth={selectedMonth}
        pickerYear={pickerYear}
        onChangeYear={setPickerYear}
        onClose={() => setCalendarVisible(false)}
        onPickMonth={(monthIndex) => {
          setSelectedMonth(new Date(pickerYear, monthIndex, 1));
          setCalendarVisible(false);
        }}
        onPickCurrentMonth={() => {
          const now = new Date();
          setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
          setPickerYear(now.getFullYear());
          setCalendarVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  header: { paddingHorizontal: 20, marginBottom: 16 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  title: { fontSize: 30, fontWeight: '800', color: colors.text1, letterSpacing: 0.5 },
  caption: { marginTop: 4, fontSize: 13, color: colors.text2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  tabRow: {
    flexDirection: 'row', marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: 4,
  },
  tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: radius.md },
  tabActive: { backgroundColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.text2 },
  tabTextActive: { color: '#fff' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, minWidth: '47%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, padding: 14,
  },
  statCardStrong: { borderColor: `${colors.accent}55` },
  statIcon: {
    width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  statLabel: { fontSize: 12, color: colors.text2, marginBottom: 6 },
  statValue: { fontSize: 21, fontWeight: '800', color: colors.text1 },
  statUnit: { fontSize: 13, color: colors.text2, fontWeight: '500' },
  card: {
    marginHorizontal: 20, marginBottom: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: 18,
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text1, marginBottom: 4 },
  cardSub: { fontSize: 13, color: colors.text2 },
  cardMeta: { fontSize: 12, fontWeight: '700', color: colors.text2 },
  chartWrap: { paddingHorizontal: 4 },
  tipCard: { flexDirection: 'row', gap: 12, backgroundColor: `${colors.teal}12`, borderColor: `${colors.teal}33` },
  tipIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: `${colors.accent}20`, alignItems: 'center', justifyContent: 'center',
  },
  tipBody: { flex: 1 },
  tipTitle: { fontSize: 14, fontWeight: '800', color: colors.text1, marginBottom: 4 },
  tipText: { fontSize: 13, lineHeight: 20, color: colors.text2 },
  hero: {
    marginHorizontal: 20, marginBottom: 16, borderRadius: radius.xl, padding: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: `${colors.accent}40`,
  },
  heroEyebrow: { fontSize: 11, letterSpacing: 1.2, color: colors.accent2, fontWeight: '800', marginBottom: 6 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: colors.text1 },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.accent,
  },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  heroMetrics: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroMetric: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12 },
  heroMetricLabel: { fontSize: 11, color: colors.text2, marginBottom: 6 },
  heroMetricValue: { fontSize: 18, fontWeight: '800', color: colors.text1 },
  heroMetricUnit: { marginTop: 4, fontSize: 11, color: colors.text2 },
  section: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text1, letterSpacing: 0.4 },
  sectionSub: { fontSize: 12, color: colors.text2 },
  group: { marginBottom: 6 },
  groupLabel: { fontSize: 12, fontWeight: '800', color: colors.text3, letterSpacing: 0.8, marginBottom: 8, marginTop: 4 },
  historyItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 8,
  },
  historyIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyEmoji: { fontSize: 20 },
  historyBody: { flex: 1 },
  historyName: { fontSize: 14, fontWeight: '700', color: colors.text1, marginBottom: 4 },
  historyMeta: { fontSize: 12, color: colors.text2 },
  historyKcal: { alignItems: 'flex-end' },
  kcalValue: { fontSize: 17, fontWeight: '900' },
  kcalUnit: { fontSize: 11, color: colors.text2 },
  calendarCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 14, marginBottom: 14,
  },
  weekHeader: { flexDirection: 'row', justifyContent: 'flex-start', marginBottom: 10, gap: 6 },
  weekHeaderText: { textAlign: 'center', fontSize: 11, color: colors.text3, fontWeight: '800' },
  weekRow: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'stretch', gap: 6, marginBottom: 6 },
  dayEmpty: {
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'transparent',
    opacity: 0,
  },
  dayCell: {
    minHeight: 62,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: 'transparent',
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  dayCellActive: { borderColor: `${colors.teal}55` },
  dayCellSelected: { backgroundColor: `${colors.accent}22`, borderColor: colors.accent },
  dayText: { fontSize: 13, fontWeight: '800', color: colors.text1 },
  dayToday: { color: colors.accent2 },
  dayTextSelected: { color: '#fff' },
  dayDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.teal },
  dayKcal: { fontSize: 11, color: colors.text2, fontWeight: '700' },
  dayList: { marginTop: 12 },
  inlineCard: { marginHorizontal: 0 },
  emptyCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 18 },
  emptyCardSoft: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.text1, marginBottom: 4 },
  emptyText: { fontSize: 13, lineHeight: 20, color: colors.text2 },
  spacer: { height: 100 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(13, 13, 15, 0.72)', justifyContent: 'center', paddingHorizontal: 20 },
  monthModal: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 18 },
  monthModalTitle: { fontSize: 18, fontWeight: '800', color: colors.text1 },
  monthModalClose: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  yearRow: { marginTop: 18, marginBottom: 16 },
  yearButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  yearText: { fontSize: 16, fontWeight: '700', color: colors.text1 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  monthChip: { width: '31%', minWidth: '31%', paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.surface2, borderWidth: 1, borderColor: colors.border, alignItems: 'center' },
  monthChipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  monthChipText: { fontSize: 13, fontWeight: '700', color: colors.text1 },
  monthChipTextActive: { color: '#fff' },
  todayButton: { marginTop: 16, height: 46, borderRadius: radius.lg, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  todayButtonText: { fontSize: 14, fontWeight: '700', color: colors.text1 },
});
