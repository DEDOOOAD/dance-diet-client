import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { G, Rect, Text as SvgText } from 'react-native-svg';
import { colors, radius } from '@/constants/theme';

type RecordTab = 'weekly' | 'monthly';

type ChartPoint = {
  label: string;
  kcal: number;
  active?: boolean;
};

type HistoryTemplate = {
  name: string;
  time: string;
  kcal: number;
  duration: number;
  icon: string;
  color: string;
  day: number;
};

type HistoryItem = HistoryTemplate & {
  dateLabel: string;
};

type StatItem = {
  label: string;
  value: string;
  unit: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
};

const WEEKLY_BASE = [320, 580, 410, 1250, 720, 260, 140];
const MONTHLY_BASE = [1640, 2190, 1860, 2410];
const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const WEEKDAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const HISTORY_TEMPLATES: HistoryTemplate[] = [
  { day: 28, time: '18:30', name: '최신 K-POP 챌린지', kcal: 150, duration: 15, icon: '🎤', color: colors.accent },
  { day: 24, time: '10:00', name: '힙합 유산소 파티', kcal: 300, duration: 30, icon: '🎧', color: colors.purple },
  { day: 18, time: '20:00', name: '살사 & 레게톤 믹스', kcal: 200, duration: 20, icon: '💃', color: colors.teal },
  { day: 12, time: '09:15', name: 'HYBE 안무 마스터클래스', kcal: 320, duration: 45, icon: '🎤', color: colors.accent },
  { day: 7, time: '21:00', name: '올드스쿨 비트 파티', kcal: 280, duration: 30, icon: '🎧', color: colors.purple },
];

function formatMonthTitle(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function formatHistoryDate(year: number, monthIndex: number, day: number) {
  return `${monthIndex + 1}월 ${day}일`;
}

function createChartPoints(tab: RecordTab, selectedMonth: Date) {
  const monthSeed = selectedMonth.getMonth() + 1;

  if (tab === 'weekly') {
    return WEEKDAY_LABELS.map((label, index) => {
      const swing = ((monthSeed + 2) * (index + 3) * 19) % 220;
      const kcal = Math.max(0, WEEKLY_BASE[index] + swing - 90);
      return {
        label,
        kcal,
        active: index === ((monthSeed + 1) % WEEKDAY_LABELS.length),
      };
    });
  }

  return MONTHLY_BASE.map((base, index) => {
    const swing = ((monthSeed + 1) * (index + 2) * 51) % 260;
    return {
      label: `${index + 1}주`,
      kcal: base + swing,
      active: index === ((monthSeed + 2) % MONTHLY_BASE.length),
    };
  });
}

function createHistory(selectedMonth: Date) {
  const year = selectedMonth.getFullYear();
  const monthIndex = selectedMonth.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const monthSeed = monthIndex + 1;

  return HISTORY_TEMPLATES.map((item, index) => {
    const adjustedDay = Math.max(1, Math.min(daysInMonth, item.day - (monthSeed % 3) * index));
    return {
      ...item,
      kcal: item.kcal + ((monthSeed + index) % 4) * 20,
      duration: item.duration + ((monthSeed + index) % 3) * 5,
      dateLabel: formatHistoryDate(year, monthIndex, adjustedDay),
    };
  });
}

function createStats(chartPoints: ChartPoint[], history: HistoryItem[]) {
  const totalKcal = chartPoints.reduce((sum, item) => sum + item.kcal, 0);
  const totalMinutes = history.reduce((sum, item) => sum + item.duration, 0);
  const sessionCount = history.length;
  const streak = 8 + (totalMinutes % 7);

  return [
    {
      label: '이번 기간 소모',
      value: totalKcal.toLocaleString(),
      unit: 'kcal',
      icon: 'flame',
      color: colors.accent,
    },
    {
      label: '총 운동 시간',
      value: String(totalMinutes),
      unit: '분',
      icon: 'time',
      color: colors.purple,
    },
    {
      label: '완료 세션',
      value: String(sessionCount),
      unit: '회',
      icon: 'checkmark-circle',
      color: colors.teal,
    },
    {
      label: '연속 달성',
      value: String(streak),
      unit: '일',
      icon: 'trending-up',
      color: '#F59E0B',
    },
  ] satisfies StatItem[];
}

function groupHistoryByDate(history: HistoryItem[]) {
  return history.reduce<Record<string, HistoryItem[]>>((acc, item) => {
    if (!acc[item.dateLabel]) {
      acc[item.dateLabel] = [];
    }
    acc[item.dateLabel].push(item);
    return acc;
  }, {});
}

function BarChart({ data }: { data: ChartPoint[] }) {
  const maxKcal = Math.max(...data.map((item) => item.kcal), 1);
  const chartWidth = 300;
  const chartHeight = 100;
  const barWidth = data.length > 4 ? 28 : 46;
  const gap = data.length > 1 ? (chartWidth - barWidth * data.length) / (data.length - 1) : 0;

  return (
    <Svg width="100%" height={chartHeight + 24} viewBox={`0 0 ${chartWidth} ${chartHeight + 24}`}>
      {data.map((item, index) => {
        const barHeight = Math.max((item.kcal / maxKcal) * chartHeight, item.kcal > 0 ? 4 : 0);
        const x = index * (barWidth + gap);
        const y = chartHeight - barHeight;
        const fill = item.active ? colors.accent : item.kcal > 0 ? colors.purple : colors.border;

        return (
          <G key={`${item.label}-${index}`}>
            <Rect
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 4)}
              rx={6}
              fill={fill}
              fillOpacity={item.active ? 1 : 0.72}
            />
            <SvgText
              x={x + barWidth / 2}
              y={chartHeight + 18}
              fontSize={11}
              fill={item.active ? colors.accent : colors.text3}
              textAnchor="middle"
              fontWeight={item.active ? '700' : '400'}>
              {item.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

function MonthPickerModal({
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
  onChangeYear: (nextYear: number) => void;
  onClose: () => void;
  onPickMonth: (monthIndex: number) => void;
  onPickCurrentMonth: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.monthModal} onPress={() => undefined}>
          <View style={styles.monthModalHeader}>
            <Text style={styles.monthModalTitle}>원하는 달 선택</Text>
            <TouchableOpacity style={styles.monthModalClose} onPress={onClose} activeOpacity={0.85}>
              <Ionicons name="close" size={18} color={colors.text2} />
            </TouchableOpacity>
          </View>

          <View style={styles.yearRow}>
            <TouchableOpacity style={styles.yearButton} onPress={() => onChangeYear(pickerYear - 1)} activeOpacity={0.85}>
              <Ionicons name="chevron-back" size={18} color={colors.text1} />
            </TouchableOpacity>
            <Text style={styles.yearText}>{pickerYear}년</Text>
            <TouchableOpacity style={styles.yearButton} onPress={() => onChangeYear(pickerYear + 1)} activeOpacity={0.85}>
              <Ionicons name="chevron-forward" size={18} color={colors.text1} />
            </TouchableOpacity>
          </View>

          <View style={styles.monthGrid}>
            {MONTH_LABELS.map((label, monthIndex) => {
              const isSelected =
                selectedMonth.getFullYear() === pickerYear && selectedMonth.getMonth() === monthIndex;

              return (
                <TouchableOpacity
                  key={label}
                  style={[styles.monthChip, isSelected && styles.monthChipActive]}
                  onPress={() => onPickMonth(monthIndex)}
                  activeOpacity={0.85}>
                  <Text style={[styles.monthChipText, isSelected && styles.monthChipTextActive]}>{label}</Text>
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
  const [tab, setTab] = useState<RecordTab>('weekly');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [calendarVisible, setCalendarVisible] = useState(false);
  const [pickerYear, setPickerYear] = useState(selectedMonth.getFullYear());

  const chartData = useMemo(() => createChartPoints(tab, selectedMonth), [selectedMonth, tab]);
  const history = useMemo(() => createHistory(selectedMonth), [selectedMonth]);
  const stats = useMemo(() => createStats(chartData, history), [chartData, history]);
  const groupedHistory = useMemo(() => groupHistoryByDate(history), [history]);
  const totalKcal = useMemo(() => chartData.reduce((sum, item) => sum + item.kcal, 0), [chartData]);

  const monthTitle = useMemo(() => formatMonthTitle(selectedMonth), [selectedMonth]);

  const openCalendar = () => {
    setPickerYear(selectedMonth.getFullYear());
    setCalendarVisible(true);
  };

  const closeCalendar = () => {
    setCalendarVisible(false);
  };

  const handlePickMonth = (monthIndex: number) => {
    setSelectedMonth(new Date(pickerYear, monthIndex, 1));
    closeCalendar();
  };

  const handlePickCurrentMonth = () => {
    const now = new Date();
    setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setPickerYear(now.getFullYear());
    closeCalendar();
  };

  return (
    <>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>기록</Text>
            <Text style={styles.monthCaption}>{monthTitle}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn} onPress={openCalendar} activeOpacity={0.85}>
            <Ionicons name="calendar-outline" size={20} color={colors.text2} />
          </TouchableOpacity>
        </View>

        <View style={styles.tabRow}>
          {(['weekly', 'monthly'] as const).map((nextTab) => (
            <TouchableOpacity
              key={nextTab}
              style={[styles.tab, tab === nextTab && styles.tabActive]}
              onPress={() => setTab(nextTab)}
              activeOpacity={0.85}>
              <Text style={[styles.tabText, tab === nextTab && styles.tabTextActive]}>
                {nextTab === 'weekly' ? '주간 보기' : '월간 보기'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.statGrid}>
          {stats.map((item) => (
            <View key={item.label} style={styles.statCard}>
              <View style={[styles.statIcon, { backgroundColor: `${item.color}20` }]}>
                <Ionicons name={item.icon} size={18} color={item.color} />
              </View>
              <Text style={styles.statValue}>
                {item.value}
                <Text style={styles.statUnit}>{item.unit}</Text>
              </Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.chartTitle}>{tab === 'weekly' ? '주간 칼로리 소모' : '월간 주차별 소모'}</Text>
              <Text style={styles.chartSub}>{monthTitle}</Text>
            </View>
            <Text style={styles.chartTotal}>총 {totalKcal.toLocaleString()} kcal</Text>
          </View>
          <View style={styles.chartWrap}>
            <BarChart data={chartData} />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>운동 이력</Text>
            <Text style={styles.sectionSub}>{monthTitle}</Text>
          </View>

          {Object.entries(groupedHistory).map(([date, items]) => (
            <View key={date} style={styles.historyGroup}>
              <Text style={styles.dateLabel}>{date}</Text>
              {items.map((item, index) => (
                <View key={`${date}-${index}`} style={styles.historyItem}>
                  <View style={[styles.historyIcon, { backgroundColor: `${item.color}20` }]}>
                    <Text style={styles.historyEmoji}>{item.icon}</Text>
                  </View>

                  <View style={styles.historyBody}>
                    <Text style={styles.historyName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.historyTime}>
                      {item.time} · {item.duration}분
                    </Text>
                  </View>

                  <View style={styles.historyKcal}>
                    <Text style={[styles.kcalValue, { color: item.color }]}>-{item.kcal}</Text>
                    <Text style={styles.kcalUnit}>kcal</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <MonthPickerModal
        visible={calendarVisible}
        selectedMonth={selectedMonth}
        pickerYear={pickerYear}
        onChangeYear={setPickerYear}
        onClose={closeCalendar}
        onPickMonth={handlePickMonth}
        onPickCurrentMonth={handlePickCurrentMonth}
      />
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
  monthCaption: {
    marginTop: 4,
    fontSize: 13,
    color: colors.text2,
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
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.accent,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text2,
  },
  tabTextActive: {
    color: '#fff',
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: 14,
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 2,
  },
  statUnit: {
    fontSize: 14,
    fontWeight: '400',
    color: colors.text2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.text2,
  },
  chartCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 12,
  },
  chartTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
    marginBottom: 4,
  },
  chartSub: {
    fontSize: 13,
    color: colors.text2,
  },
  chartTotal: {
    fontSize: 13,
    color: colors.text2,
    marginTop: 2,
  },
  chartWrap: {
    paddingHorizontal: 4,
  },
  section: {
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text1,
    letterSpacing: 0.5,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.text2,
  },
  historyGroup: {
    marginBottom: 4,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text3,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: 14,
    marginBottom: 8,
  },
  historyIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyEmoji: {
    fontSize: 20,
  },
  historyBody: {
    flex: 1,
  },
  historyName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text1,
    marginBottom: 3,
  },
  historyTime: {
    fontSize: 12,
    color: colors.text2,
  },
  historyKcal: {
    alignItems: 'flex-end',
  },
  kcalValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  kcalUnit: {
    fontSize: 11,
    color: colors.text2,
  },
  bottomSpacer: {
    height: 100,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13, 13, 15, 0.7)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  monthModal: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
  },
  monthModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  monthModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text1,
  },
  monthModalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  yearButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
  },
  yearText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text1,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  monthChip: {
    width: '31%',
    minWidth: '31%',
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  monthChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  monthChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text1,
  },
  monthChipTextActive: {
    color: '#fff',
  },
  todayButton: {
    marginTop: 16,
    height: 46,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
});
