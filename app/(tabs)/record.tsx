import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { colors, radius } from '@/constants/theme';

type RecordTab = 'monthly' | 'weight';
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
type WeightPoint = {
  key: string;
  date: Date;
  label: string;
  shortLabel: string;
  kg: number;
  delta: number;
  note: string;
  active?: boolean;
};

const MONTHS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const TIMES = ['07:20', '09:10', '12:40', '18:10', '19:30', '20:50', '21:40'];
const TEMPLATES = [
  { name: 'Jazz Lines 루틴', icon: '🎷', color: colors.accent, kcal: 180, duration: 18 },
  { name: 'K-POP 챌린지', icon: '🎤', color: colors.purple, kcal: 230, duration: 24 },
  { name: '전신 파워 무브', icon: '🔥', color: colors.accent2, kcal: 280, duration: 30 },
  { name: '스트레치 & 밸런스', icon: '🧘', color: colors.teal, kcal: 120, duration: 16 },
  { name: '걸스힙합 콤보', icon: '✨', color: '#F59E0B', kcal: 250, duration: 28 },
  { name: '하우스 카디오 부스터', icon: '💃', color: '#38BDF8', kcal: 300, duration: 32 },
];
const WEIGHT_NOTES = [
  '식단과 운동 루틴을 안정적으로 유지했어요.',
  '붓기 변동은 있었지만 전체 흐름은 좋은 편이에요.',
  '주 4회 이상 운동한 달이라 체중도 같이 반응했어요.',
  '감량 속도가 무리하지 않게 이어지고 있어요.',
  '유지 구간을 잘 지나가고 있어요.',
  '수면 패턴이 좋아질수록 변화 폭도 안정적이에요.',
];

const pad = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
const monthTitle = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
const shiftMonth = (date: Date, offset: number) => new Date(date.getFullYear(), date.getMonth() + offset, 1);
const formatDelta = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}`;
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

function monthlyChart(data: Session[]) {
  const buckets = [0, 0, 0, 0, 0];
  data.forEach((item) => {
    buckets[Math.floor((item.day - 1) / 7)] += item.kcal;
  });
  const max = Math.max(...buckets, 0);
  return buckets
    .map((kcal, i) => ({ label: `${i + 1}주차`, kcal, active: kcal > 0 && kcal === max }))
    .filter((item, i, arr) => item.kcal > 0 || i < arr.length - 1);
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

function makeWeightHistory(selectedMonth: Date) {
  const endMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
  const seed = (endMonth.getFullYear() * 12 + endMonth.getMonth()) % 5;
  const endWeight = 60.6 + seed * 0.2;
  const trendOffsets = [2.2, 1.7, 1.3, 0.9, 0.5, 0];
  const series = trendOffsets.map((offset, index) => {
    const date = shiftMonth(endMonth, index - 5);
    const variation = (((date.getMonth() + 1) % 3) - 1) * 0.1;
    const kg = Number((endWeight + offset + variation).toFixed(1));
    return {
      key: dateKey(date),
      date,
      label: `${date.getFullYear()}년 ${date.getMonth() + 1}월`,
      shortLabel: `${date.getMonth() + 1}월`,
      kg,
      delta: 0,
      note: WEIGHT_NOTES[index % WEIGHT_NOTES.length],
      active: sameMonth(date, endMonth),
    };
  });

  return series.map((item, index) => ({
    ...item,
    delta: index === 0 ? 0 : Number((item.kg - series[index - 1].kg).toFixed(1)),
  }));
}

function weightStats(history: WeightPoint[], targetWeight: number): Stat[] {
  const current = history.at(-1)?.kg ?? 0;
  const first = history[0]?.kg ?? current;
  const change = Number((current - first).toFixed(1));
  const goalGap = Number((current - targetWeight).toFixed(1));
  const avgMonthly = Number(((current - first) / Math.max(history.length - 1, 1)).toFixed(1));
  const bestDrop = history.slice(1).reduce(
    (best, point) => (point.delta < best.delta ? point : best),
    history[1] ?? history[0] ?? { delta: 0, label: '-', kg: 0 } as WeightPoint
  );

  return [
    { label: '현재 체중', value: current.toFixed(1), unit: 'kg', icon: 'body', color: colors.accent },
    { label: '6개월 변화', value: formatDelta(change), unit: 'kg', icon: 'trending-down', color: colors.teal },
    { label: '목표까지', value: goalGap > 0 ? goalGap.toFixed(1) : '0.0', unit: 'kg', icon: 'flag', color: colors.purple },
    { label: '월평균 변화', value: formatDelta(avgMonthly), unit: 'kg', icon: 'pulse', color: '#F59E0B' },
    { label: '가장 많이 변한 달', value: bestDrop.label, unit: formatDelta(bestDrop.delta), icon: 'analytics', color: colors.accent2 },
    { label: '목표 체중', value: targetWeight.toFixed(1), unit: 'kg', icon: 'trophy', color: '#38BDF8' },
  ];
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

function WeightTrendChart({ data, targetWeight }: { data: WeightPoint[]; targetWeight: number }) {
  const width = 320;
  const height = 156;
  const paddingX = 18;
  const paddingTop = 14;
  const paddingBottom = 28;
  const minValue = Math.min(...data.map((item) => item.kg), targetWeight) - 0.4;
  const maxValue = Math.max(...data.map((item) => item.kg), targetWeight) + 0.4;
  const graphHeight = height - paddingTop - paddingBottom;
  const graphWidth = width - paddingX * 2;

  const xFor = (index: number) => paddingX + (graphWidth / Math.max(data.length - 1, 1)) * index;
  const yFor = (value: number) => paddingTop + ((maxValue - value) / Math.max(maxValue - minValue, 0.1)) * graphHeight;
  const points = data.map((item, index) => `${xFor(index)},${yFor(item.kg)}`).join(' ');
  const targetY = yFor(targetWeight);

  return (
    <Svg width="100%" height={height + 26} viewBox={`0 0 ${width} ${height + 26}`}>
      {[0, 0.5, 1].map((ratio) => {
        const value = maxValue - (maxValue - minValue) * ratio;
        const y = yFor(value);
        return (
          <G key={ratio}>
            <Line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke={colors.border} strokeDasharray="4 6" />
            <SvgText x={width - 4} y={y + 4} fontSize={10} fill={colors.text3} textAnchor="end">
              {value.toFixed(1)}
            </SvgText>
          </G>
        );
      })}

      <Line x1={paddingX} y1={targetY} x2={width - paddingX} y2={targetY} stroke={colors.teal} strokeDasharray="6 6" strokeWidth={1.5} />
      <SvgText x={paddingX} y={targetY - 8} fontSize={10} fill={colors.teal} fontWeight="700">
        목표 {targetWeight.toFixed(1)}kg
      </SvgText>

      <Polyline points={points} fill="none" stroke={colors.accent} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />

      {data.map((item, index) => {
        const x = xFor(index);
        const y = yFor(item.kg);
        const active = item.active;
        return (
          <G key={item.key}>
            <Circle cx={x} cy={y} r={active ? 5.5 : 4.5} fill={active ? colors.accent2 : colors.surface} stroke={colors.accent} strokeWidth={2} />
            {active ? (
              <SvgText x={x} y={y - 12} fontSize={11} fill={colors.text1} textAnchor="middle" fontWeight="700">
                {item.kg.toFixed(1)}kg
              </SvgText>
            ) : null}
            <SvgText x={x} y={height + 16} fontSize={11} fill={active ? colors.accent : colors.text3} textAnchor="middle" fontWeight={active ? '700' : '500'}>
              {item.shortLabel}
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

function WeightLogRow({ item, targetWeight }: { item: WeightPoint; targetWeight: number }) {
  const changeColor = item.delta <= 0 ? colors.teal : colors.accent2;
  const targetGap = Number((item.kg - targetWeight).toFixed(1));
  return (
    <View style={styles.weightLogItem}>
      <View style={styles.weightLogMain}>
        <Text style={styles.weightLogMonth}>{item.label}</Text>
        <Text style={styles.weightLogNote}>{item.note}</Text>
      </View>
      <View style={styles.weightLogMetrics}>
        <Text style={styles.weightLogValue}>{item.kg.toFixed(1)}kg</Text>
        <Text style={[styles.weightLogDelta, { color: item.delta === 0 ? colors.text2 : changeColor }]}>
          {item.delta === 0 ? '기준값' : `${formatDelta(item.delta)}kg`}
        </Text>
        <Text style={styles.weightLogSub}>목표까지 {targetGap > 0 ? `${targetGap.toFixed(1)}kg` : '달성'}</Text>
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
            <Text style={styles.monthModalTitle}>조회 월 선택</Text>
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
  const [tab, setTab] = useState<RecordTab>('monthly');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedMonth.getFullYear());
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const [showAllWeightLogs, setShowAllWeightLogs] = useState(false);

  const sessions = useMemo(() => makeSessions(selectedMonth), [selectedMonth]);
  const monthlyPoints = useMemo(() => monthlyChart(sessions), [sessions]);
  const monthlyStats = useMemo(() => statsForMonthly(monthlyPoints, sessions), [monthlyPoints, sessions]);
  const groupedAll = useMemo(() => byDate(sessions), [sessions]);
  const calendar = useMemo(() => makeCalendar(selectedMonth, sessions), [selectedMonth, sessions]);
  const monthSummary = useMemo(() => ({
    kcal: sessions.reduce((sum, item) => sum + item.kcal, 0),
    minutes: sessions.reduce((sum, item) => sum + item.duration, 0),
    activeDays: new Set(sessions.map((item) => item.dateKey)).size,
  }), [sessions]);

  const weightHistory = useMemo(() => makeWeightHistory(selectedMonth), [selectedMonth]);
  const targetWeight = useMemo(() => Number(((weightHistory.at(-1)?.kg ?? 60) - 2.4).toFixed(1)), [weightHistory]);
  const weightSummary = useMemo(() => {
    const current = weightHistory.at(-1)?.kg ?? 0;
    const start = weightHistory[0]?.kg ?? current;
    const change = Number((current - start).toFixed(1));
    const recent = weightHistory.at(-1)?.delta ?? 0;
    return {
      current,
      change,
      recent,
      targetGap: Number((current - targetWeight).toFixed(1)),
    };
  }, [targetWeight, weightHistory]);
  const weightCards = useMemo(() => weightStats(weightHistory, targetWeight), [targetWeight, weightHistory]);
  const visibleWeightHistory = useMemo(
    () => (showAllWeightLogs ? weightHistory.slice().reverse() : weightHistory.slice().reverse().slice(0, 3)),
    [showAllWeightLogs, weightHistory]
  );

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
          {([
            { key: 'monthly' as const, label: '월간 보기' },
            { key: 'weight' as const, label: '몸무게 추이' },
          ]).map((next) => (
            <TouchableOpacity key={next.key} style={[styles.tab, tab === next.key && styles.tabActive]} onPress={() => setTab(next.key)} activeOpacity={0.85}>
              <Text style={[styles.tabText, tab === next.key && styles.tabTextActive]}>{next.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === 'monthly' ? (
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
                <Text style={styles.sectionSub}>날짜를 눌러 이력을 확인해보세요</Text>
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
        ) : (
          <>
            <View style={[styles.hero, styles.weightHero]}>
              <View style={styles.heroTop}>
                <View style={styles.heroCopy}>
                  <Text style={styles.heroEyebrow}>BODY TREND</Text>
                  <Text style={styles.heroTitle}>체중 흐름</Text>
                  <Text style={styles.weightHeroSub}>{monthTitle(selectedMonth)} 기준</Text>
                </View>
                <View style={[styles.heroBadge, styles.weightHeroBadge]}>
                  <Ionicons name="trending-down" size={14} color="#fff" />
                  <Text style={styles.heroBadgeText}>{formatDelta(weightSummary.change)} kg</Text>
                </View>
              </View>
              <View style={styles.heroMetrics}>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricLabel}>현재 체중</Text>
                  <Text style={styles.heroMetricValue}>{weightSummary.current.toFixed(1)}kg</Text>
                </View>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricLabel}>최근 한 달</Text>
                  <Text style={styles.heroMetricValue}>{formatDelta(weightSummary.recent)}kg</Text>
                </View>
                <View style={styles.heroMetric}>
                  <Text style={styles.heroMetricLabel}>목표까지</Text>
                  <Text style={styles.heroMetricValue}>{weightSummary.targetGap > 0 ? `${weightSummary.targetGap.toFixed(1)}kg` : '달성'}</Text>
                </View>
              </View>
            </View>

            <View style={styles.grid}>
              {weightCards.map((item, index) => <StatCard key={item.label} item={item} strong={index === 0} />)}
            </View>

            <View style={styles.card}>
              <View style={styles.rowBetween}>
                <View>
                  <Text style={styles.cardTitle}>6개월 몸무게 변화 추이</Text>
                  <Text style={styles.cardSub}>선택한 월을 기준으로 최근 6개월 흐름을 보여줘요</Text>
                </View>
                <Text style={styles.cardMeta}>목표 {targetWeight.toFixed(1)}kg</Text>
              </View>
              <View style={styles.chartWrap}>
                <WeightTrendChart data={weightHistory} targetWeight={targetWeight} />
              </View>
            </View>

            <View style={[styles.card, styles.tipCard]}>
              <View style={styles.tipIcon}>
                <Ionicons name="sparkles" size={18} color={colors.accent} />
              </View>
              <View style={styles.tipBody}>
                <Text style={styles.tipTitle}>체중 인사이트</Text>
                <Text style={styles.tipText}>
                  최근 6개월 동안 {Math.abs(weightSummary.change).toFixed(1)}kg {weightSummary.change <= 0 ? '감량' : '증가'}했고,
                  최근 한 달 변화는 {formatDelta(weightSummary.recent)}kg예요. 목표 체중까지는{' '}
                  {weightSummary.targetGap > 0 ? `${weightSummary.targetGap.toFixed(1)}kg` : '이미 도달했어요'}.
                </Text>
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={styles.sectionTitle}>월별 체중 기록</Text>
                <Text style={styles.sectionSub}>기본 3개 표시</Text>
              </View>
              <View style={styles.weightLogList}>
                {visibleWeightHistory.map((item) => (
                  <WeightLogRow key={item.key} item={item} targetWeight={targetWeight} />
                ))}
              </View>
              {weightHistory.length > 3 ? (
                <TouchableOpacity
                  style={styles.moreButton}
                  onPress={() => setShowAllWeightLogs((prev) => !prev)}
                  activeOpacity={0.85}>
                  <Text style={styles.moreButtonText}>{showAllWeightLogs ? '접기' : '더보기'}</Text>
                  <Ionicons
                    name={showAllWeightLogs ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.text1}
                  />
                </TouchableOpacity>
              ) : null}
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
  tipBody: { flex: 1, minWidth: 0, flexShrink: 1 },
  tipTitle: { fontSize: 14, fontWeight: '800', color: colors.text1, marginBottom: 4 },
  tipText: { fontSize: 13, lineHeight: 20, color: colors.text2 },
  hero: {
    marginHorizontal: 20, marginBottom: 16, borderRadius: radius.xl, padding: 18, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: `${colors.accent}40`,
  },
  weightHero: { borderColor: `${colors.teal}50` },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  heroCopy: { flex: 1, minWidth: 0, flexShrink: 1 },
  heroEyebrow: { fontSize: 11, letterSpacing: 1.2, color: colors.accent2, fontWeight: '800', marginBottom: 6 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: colors.text1 },
  weightHeroSub: { marginTop: 6, fontSize: 13, color: colors.text2, fontWeight: '600' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: radius.full, backgroundColor: colors.accent,
  },
  weightHeroBadge: { backgroundColor: colors.teal, alignSelf: 'flex-start', flexShrink: 0, maxWidth: '38%' },
  heroBadgeText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  heroMetrics: { flexDirection: 'row', gap: 10, marginTop: 18 },
  heroMetric: { flex: 1, backgroundColor: colors.surface2, borderRadius: radius.md, padding: 12 },
  heroMetricLabel: { fontSize: 11, color: colors.text2, marginBottom: 6 },
  heroMetricValue: { fontSize: 18, fontWeight: '800', color: colors.text1 },
  heroMetricUnit: { marginTop: 4, fontSize: 11, color: colors.text2 },
  section: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text1, letterSpacing: 0.4 },
  sectionSub: { fontSize: 12, color: colors.text2 },
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
  emptyCardSoft: { backgroundColor: colors.surface2, borderRadius: radius.lg, padding: 16 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: colors.text1, marginBottom: 4 },
  emptyText: { fontSize: 13, lineHeight: 20, color: colors.text2 },
  weightLogList: { marginTop: 14, marginBottom: 8, gap: 10 },
  weightLogItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  weightLogMain: { flex: 1 },
  weightLogMonth: { fontSize: 14, fontWeight: '800', color: colors.text1, marginBottom: 4 },
  weightLogNote: { fontSize: 12, lineHeight: 18, color: colors.text2 },
  weightLogMetrics: { alignItems: 'flex-end', justifyContent: 'center' },
  weightLogValue: { fontSize: 18, fontWeight: '900', color: colors.text1 },
  weightLogDelta: { marginTop: 2, fontSize: 12, fontWeight: '700' },
  weightLogSub: { marginTop: 4, fontSize: 11, color: colors.text3 },
  moreButton: {
    marginTop: 8,
    marginBottom: 8,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  moreButtonText: { fontSize: 14, fontWeight: '700', color: colors.text1 },
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
