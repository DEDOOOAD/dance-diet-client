import { DanceDetailModal } from '@/components/dance-detail-modal';
import { DanceVisionPracticeModal } from '@/components/dance-vision-practice-modal';
import { colors, radius } from '@/constants/theme';
import { danceClasses, genreFilters, levelColors, type DanceClass } from '@/data/dances';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const SORT_TABS = ['추천순', '인기순', '짧은 시간'] as const;

function FeaturedCard({
  item,
  onPress,
}: {
  item: DanceClass;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.featuredCard, { backgroundColor: item.color + '18' }]}
      activeOpacity={0.9}
      onPress={onPress}>
      <View style={styles.featuredTopRow}>
        <View style={[styles.genreBadge, { borderColor: item.color + '55' }]}>
          <Text style={[styles.genreBadgeText, { color: item.color }]}>{item.genre}</Text>
        </View>
        <View
          style={[
            styles.levelBadge,
            {
              backgroundColor: levelColors[item.level] + '20',
              borderColor: levelColors[item.level] + '45',
            },
          ]}>
          <Text style={[styles.levelBadgeText, { color: levelColors[item.level] }]}>{item.level}</Text>
        </View>
      </View>

      <View style={styles.featuredContent}>
        <View style={[styles.featuredIcon, { backgroundColor: item.color }]}>
          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={26} color="#fff" />
        </View>
        <View style={styles.featuredTextBlock}>
          <Text style={styles.featuredTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.featuredSubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.featuredMetaRow}>
        <MetaPill icon="time-outline" text={item.duration} />
        <MetaPill icon="flame-outline" text={`${item.kcal} kcal`} />
        <MetaPill icon="star-outline" text={item.rating} />
      </View>
    </TouchableOpacity>
  );
}

function ClassListCard({
  item,
  onPress,
}: {
  item: DanceClass;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.listCard} activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.listThumb, { backgroundColor: item.color + '1A' }]}>
        <View style={[styles.listIcon, { backgroundColor: item.color }]}>
          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={24} color="#fff" />
        </View>
      </View>

      <View style={styles.listInfo}>
        <View style={styles.listHeaderRow}>
          <Text style={[styles.listGenre, { color: item.color }]}>{item.genre}</Text>
          <Text style={styles.listStudents}>{item.students.toLocaleString()}명 참여</Text>
        </View>

        <Text style={styles.listTitle}>{item.title}</Text>
        <Text style={styles.listSubtitle} numberOfLines={2}>
          {item.subtitle}
        </Text>
        <Text style={styles.listInstructor}>강사 {item.instructor}</Text>

        <View style={styles.listBottomRow}>
          <MetaPill icon="time-outline" text={item.duration} />
          <MetaPill icon="flash-outline" text={item.tags[0]} />
          <MetaPill icon="flame-outline" text={`${item.kcal} kcal`} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function MetaPill({
  icon,
  text,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
}) {
  return (
    <View style={styles.metaPill}>
      <Ionicons name={icon} size={12} color={colors.text3} />
      <Text style={styles.metaPillText}>{text}</Text>
    </View>
  );
}

export default function ClassesScreen() {
  const [activeGenre, setActiveGenre] = useState<string>('전체');
  const [activeSort, setActiveSort] = useState<(typeof SORT_TABS)[number]>('추천순');
  const [search, setSearch] = useState('');
  const [selectedDance, setSelectedDance] = useState<DanceClass | null>(null);
  const [practiceDance, setPracticeDance] = useState<DanceClass | null>(null);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const base = danceClasses.filter((dance) => {
      const matchesGenre = activeGenre === '전체' || dance.genre === activeGenre;
      const matchesKeyword =
        !keyword ||
        dance.title.toLowerCase().includes(keyword) ||
        dance.instructor.toLowerCase().includes(keyword) ||
        dance.tags.some((tag) => tag.toLowerCase().includes(keyword));

      return matchesGenre && matchesKeyword;
    });

    if (activeSort === '인기순') {
      return [...base].sort((a, b) => b.students - a.students);
    }

    if (activeSort === '짧은 시간') {
      return [...base].sort((a, b) => parseInt(a.duration, 10) - parseInt(b.duration, 10));
    }

    return base;
  }, [activeGenre, activeSort, search]);

  const featured = filtered.slice(0, 3);
  const recommended = filtered.slice(3);

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>클래스</Text>
            <Text style={styles.subtitle}>원하는 스타일을 고르고 바로 춤을 시작해보세요.</Text>
          </View>
          <TouchableOpacity style={styles.headerButton} activeOpacity={0.85}>
            <Ionicons name="options-outline" size={20} color={colors.text2} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.text3} />
          <TextInput
            style={styles.searchInput}
            placeholder="춤, 강사, 키워드를 검색해보세요"
            placeholderTextColor={colors.text3}
            value={search}
            onChangeText={setSearch}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.85}>
              <Ionicons name="close-circle" size={18} color={colors.text3} />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>장르</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.genreRow}>
            {genreFilters.map((genre) => {
              const focused = activeGenre === genre;
              return (
                <TouchableOpacity
                  key={genre}
                  style={[styles.genreChip, focused && styles.genreChipActive]}
                  onPress={() => setActiveGenre(genre)}
                  activeOpacity={0.85}>
                  <Text style={[styles.genreChipText, focused && styles.genreChipTextActive]}>{genre}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>정렬</Text>
          <View style={styles.sortRow}>
            {SORT_TABS.map((tab) => {
              const focused = activeSort === tab;
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.sortChip, focused && styles.sortChipActive]}
                  onPress={() => setActiveSort(tab)}
                  activeOpacity={0.85}>
                  <Text style={[styles.sortChipText, focused && styles.sortChipTextActive]}>{tab}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.heroBanner}>
          <View style={styles.heroTextBlock}>
            <Text style={styles.heroTitle}>오늘의 추천 클래스</Text>
            <Text style={styles.heroBody}>
              짧게 워밍업하고 바로 따라 출 수 있는 인기 루틴을 모아뒀어요.
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{danceClasses.length}</Text>
                <Text style={styles.heroStatLabel}>전체 클래스</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{featured.length}</Text>
                <Text style={styles.heroStatLabel}>추천 클래스</Text>
              </View>
            </View>
          </View>
          <View style={styles.heroIcon}>
            <Ionicons name="sparkles" size={34} color="#fff" />
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>추천 클래스</Text>
            <Text style={styles.sectionCaption}>{filtered.length}개 결과</Text>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRow}>
            {featured.map((item) => (
              <FeaturedCard key={item.id} item={item} onPress={() => setSelectedDance(item)} />
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>전체 클래스</Text>
            <Text style={styles.sectionCaption}>지금 바로 시작할 수 있어요</Text>
          </View>

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="musical-notes-outline" size={32} color={colors.text3} />
              <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
              <Text style={styles.emptyBody}>다른 장르를 선택하거나 검색어를 바꿔보세요.</Text>
            </View>
          ) : (
            (recommended.length > 0 ? recommended : filtered).map((item) => (
              <ClassListCard key={item.id} item={item} onPress={() => setSelectedDance(item)} />
            ))
          )}
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingTop: 56,
    paddingBottom: 100,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.accent2,
    fontWeight: '700',
    marginBottom: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text2,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    marginHorizontal: 20,
    marginBottom: 16,
    paddingHorizontal: 14,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text1,
  },
  heroBanner: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: radius.xl,
    padding: 20,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    gap: 16,
  },
  heroTextBlock: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 8,
  },
  heroBody: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text2,
    marginBottom: 18,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    gap: 2,
  },
  heroStatValue: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text1,
  },
  heroStatLabel: {
    fontSize: 12,
    color: colors.text3,
  },
  heroDivider: {
    width: 1,
    height: 34,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    paddingHorizontal: 20,
    fontSize: 19,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 12,
  },
  sectionCaption: {
    fontSize: 12,
    color: colors.text3,
  },
  genreRow: {
    paddingHorizontal: 20,
    gap: 10,
  },
  genreChip: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  genreChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  genreChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text2,
  },
  genreChipTextActive: {
    color: '#fff',
  },
  sortRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sortChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sortChipActive: {
    borderColor: colors.teal,
    backgroundColor: colors.teal + '18',
  },
  sortChipText: {
    fontSize: 12,
    color: colors.text2,
    fontWeight: '600',
  },
  sortChipTextActive: {
    color: colors.teal,
  },
  featuredRow: {
    paddingHorizontal: 20,
    gap: 12,
  },
  featuredCard: {
    width: 290,
    borderRadius: radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  featuredTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  genreBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  genreBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  levelBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  levelBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  featuredContent: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 16,
  },
  featuredIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredTextBlock: {
    flex: 1,
  },
  featuredTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 6,
  },
  featuredSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
  },
  featuredMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaPillText: {
    fontSize: 11,
    color: colors.text2,
    fontWeight: '600',
  },
  listCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  listThumb: {
    width: 108,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    flex: 1,
    padding: 14,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  listGenre: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  listStudents: {
    fontSize: 11,
    color: colors.text3,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 5,
  },
  listSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
    marginBottom: 8,
  },
  listInstructor: {
    fontSize: 12,
    color: colors.text3,
    marginBottom: 12,
  },
  listBottomRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptyState: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 24,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text1,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text2,
    textAlign: 'center',
  },
});
