import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { colors, radius } from '@/constants/theme';

const WEEKLY = [
  { day: '월', kcal: 320  },
  { day: '화', kcal: 580  },
  { day: '수', kcal: 410  },
  { day: '목', kcal: 1250, active: true },
  { day: '금', kcal: 0   },
  { day: '토', kcal: 0   },
  { day: '일', kcal: 0   },
];

const HISTORY = [
  { date: '오늘', time: '18:30', name: '최신 K-POP 챌린지',    kcal: 150, duration: 15, icon: '🎤', color: colors.accent  },
  { date: '오늘', time: '10:00', name: '힙합 유산소 파티',      kcal: 300, duration: 30, icon: '🎧', color: colors.purple  },
  { date: '어제', time: '20:00', name: '살사 & 레게톤 믹스',    kcal: 200, duration: 20, icon: '💃', color: colors.teal    },
  { date: '어제', time: '09:15', name: 'HYBE 안무 마스터클래스',kcal: 320, duration: 45, icon: '🎤', color: colors.accent  },
  { date: '화',   time: '21:00', name: '올드스쿨 비트 파티',    kcal: 280, duration: 30, icon: '🎧', color: colors.purple  },
];

const STATS = [
  { label: '이번 주 소모', value: '2,560', unit: 'kcal', icon: 'flame',            color: colors.accent  },
  { label: '총 댄스 시간', value: '95',    unit: '분',   icon: 'time',             color: colors.purple  },
  { label: '완료 세션',    value: '7',     unit: '회',   icon: 'checkmark-circle', color: colors.teal    },
  { label: '연속 달성',    value: '12',    unit: '일',   icon: 'trending-up',      color: '#F59E0B'      },
];

function BarChart() {
  const maxKcal = Math.max(...WEEKLY.map(d => d.kcal), 1);
  const chartW = 300, chartH = 100, barW = 28;
  const gap = (chartW - barW * 7) / 6;

  return (
    <Svg width="100%" height={chartH + 24} viewBox={`0 0 ${chartW} ${chartH + 24}`}>
      {WEEKLY.map((d, i) => {
        const barH = Math.max((d.kcal / maxKcal) * chartH, d.kcal > 0 ? 4 : 0);
        const x = i * (barW + gap);
        const y = chartH - barH;
        const fill = d.active ? colors.accent : d.kcal > 0 ? colors.purple : colors.border;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={Math.max(barH, 4)} rx={6} fill={fill} fillOpacity={d.active ? 1 : 0.7} />
            <SvgText x={x + barW / 2} y={chartH + 18} fontSize={11} fill={d.active ? colors.accent : colors.text3} textAnchor="middle" fontWeight={d.active ? '700' : '400'}>
              {d.day}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

export default function RecordScreen() {
  const [tab, setTab] = useState<'weekly' | 'monthly'>('weekly');

  const grouped = HISTORY.reduce<Record<string, typeof HISTORY>>((acc, item) => {
    if (!acc[item.date]) acc[item.date] = [];
    acc[item.date].push(item);
    return acc;
  }, {});

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>기록</Text>
        <TouchableOpacity style={styles.iconBtn}>
          <Ionicons name="calendar-outline" size={20} color={colors.text2} />
        </TouchableOpacity>
      </View>

      {/* 탭 */}
      <View style={styles.tabRow}>
        {(['weekly', 'monthly'] as const).map(t => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'weekly' ? '이번 주' : '이번 달'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 통계 */}
      <View style={styles.statGrid}>
        {STATS.map((s, i) => (
          <View key={i} style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: s.color + '20' }]}>
              <Ionicons name={s.icon as any} size={18} color={s.color} />
            </View>
            <Text style={styles.statValue}>
              {s.value}<Text style={styles.statUnit}>{s.unit}</Text>
            </Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* 바 차트 */}
      <View style={styles.chartCard}>
        <View style={styles.chartHeader}>
          <Text style={styles.chartTitle}>주간 칼로리 소모</Text>
          <Text style={styles.chartSub}>총 2,560 kcal</Text>
        </View>
        <View style={{ paddingHorizontal: 4 }}>
          <BarChart />
        </View>
      </View>

      {/* 활동 내역 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>활동 내역</Text>
        {Object.entries(grouped).map(([date, items]) => (
          <View key={date} style={{ marginBottom: 4 }}>
            <Text style={styles.dateLabel}>{date}</Text>
            {items.map((item, i) => (
              <View key={i} style={styles.historyItem}>
                <View style={[styles.historyIcon, { backgroundColor: item.color + '20' }]}>
                  <Text style={{ fontSize: 20 }}>{item.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyName} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.historyTime}>{item.time} · {item.duration}분</Text>
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

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: colors.text1, letterSpacing: 0.5 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },

  tabRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.md },
  tabActive: { backgroundColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.text2 },
  tabTextActive: { color: '#fff' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10, marginBottom: 16 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: 14 },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '800', color: colors.text1, marginBottom: 2 },
  statUnit: { fontSize: 14, fontWeight: '400', color: colors.text2 },
  statLabel: { fontSize: 12, color: colors.text2 },

  chartCard: { marginHorizontal: 20, marginBottom: 20, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: 18 },
  chartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  chartTitle: { fontSize: 15, fontWeight: '700', color: colors.text1 },
  chartSub: { fontSize: 13, color: colors.text2 },

  section: { paddingHorizontal: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: colors.text1, letterSpacing: 0.5, marginBottom: 14 },
  dateLabel: { fontSize: 12, fontWeight: '700', color: colors.text3, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 },
  historyItem: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: 14, marginBottom: 8 },
  historyIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  historyName: { fontSize: 14, fontWeight: '600', color: colors.text1, marginBottom: 3 },
  historyTime: { fontSize: 12, color: colors.text2 },
  historyKcal: { alignItems: 'flex-end' },
  kcalValue: { fontSize: 16, fontWeight: '800' },
  kcalUnit: { fontSize: 11, color: colors.text2 },
});
