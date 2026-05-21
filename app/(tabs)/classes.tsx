import { DanceDetailModal } from '@/components/dance-detail-modal';
import { DanceVisionPracticeModal } from '@/components/dance-vision-practice-modal';
import { colors, radius } from '@/constants/theme';
import {
  danceClasses,
  featuredDanceIds,
  genreFilters,
  levelColors,
  type DanceClass,
} from '@/data/dances';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

const SORT_TABS = ['추천순', '인기순', '짧은 시간'] as const;

function getDurationMinutes(duration: string) {
  return Number.parseInt(duration, 10) || 0;
}

function getRecommendationScore(item: DanceClass) {
  const featuredBoost = featuredDanceIds.includes(item.id as (typeof featuredDanceIds)[number]) ? 2000 : 0;
  const ratingScore = Number.parseFloat(item.rating) * 100;
  const studentScore = Math.round(item.students / 20);
  return featuredBoost + ratingScore + studentScore;
}

function MetaPill({
  icon,
  text,
  tone = 'default',
  size = 'default',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: 'default' | 'strong';
  size?: 'default' | 'compact';
}) {
  return (
    <View
      style={[
        styles.metaPill,
        size === 'compact' && styles.metaPillCompact,
        tone === 'strong' && styles.metaPillStrong,
      ]}>
      <Ionicons
        name={icon}
        size={size === 'compact' ? 11 : 12}
        color={tone === 'strong' ? colors.text1 : colors.text3}
      />
      <Text
        style={[
          styles.metaPillText,
          size === 'compact' && styles.metaPillTextCompact,
          tone === 'strong' && styles.metaPillTextStrong,
        ]}>
        {text}
      </Text>
    </View>
  );
}

function SpotlightCard({
  item,
  onPress,
}: {
  item: DanceClass;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.spotlightCard, { borderColor: `${item.color}55` }]}
      activeOpacity={0.92}
      onPress={onPress}>
      <View style={[styles.spotlightGlow, { backgroundColor: `${item.color}24` }]} />
      <View style={[styles.spotlightOrb, { backgroundColor: `${item.color}18` }]} />

      <View style={styles.spotlightTopRow}>
        <View style={[styles.spotlightGenreBadge, { borderColor: `${item.color}55` }]}>
          <Text style={[styles.spotlightGenreText, { color: item.color }]}>{item.genre}</Text>
        </View>
        <View
          style={[
            styles.spotlightLevelBadge,
            {
              backgroundColor: `${levelColors[item.level]}20`,
              borderColor: `${levelColors[item.level]}44`,
            },
          ]}>
          <Text style={[styles.spotlightLevelText, { color: levelColors[item.level] }]}>{item.level}</Text>
        </View>
      </View>

      <View style={styles.spotlightBody}>
        <View style={[styles.spotlightIcon, { backgroundColor: item.color }]}>
          <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={28} color="#fff" />
        </View>

        <View style={styles.spotlightCopy}>
          <Text style={styles.spotlightEyebrow}>SPOTLIGHT CLASS</Text>
          <Text style={styles.spotlightTitle}>{item.title}</Text>
          <Text style={styles.spotlightSubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
          <Text style={styles.spotlightInstructor}>with {item.instructor}</Text>
        </View>
      </View>

      <View style={styles.spotlightMetaRow}>
        <MetaPill icon="time-outline" text={item.duration} tone="strong" />
        <MetaPill icon="flame-outline" text={`${item.kcal} kcal`} tone="strong" />
        <MetaPill icon="star-outline" text={item.rating} tone="strong" />
      </View>

      <View style={styles.spotlightFooter}>
        <View style={styles.spotlightTagRow}>
          {item.tags.slice(0, 2).map((tag) => (
            <View key={tag} style={styles.spotlightTag}>
              <Text style={styles.spotlightTagText}>#{tag}</Text>
            </View>
          ))}
        </View>
        <View style={styles.spotlightAction}>
          <Text style={styles.spotlightActionText}>클래스 보기</Text>
          <Ionicons name="arrow-forward" size={14} color="#fff" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

function RecommendationCard({
  item,
  onPress,
}: {
  item: DanceClass;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.recommendationCard} activeOpacity={0.9} onPress={onPress}>
      <View style={styles.recommendationHeader}>
        <View style={[styles.recommendationIconWrap, { backgroundColor: `${item.color}1F` }]}>
          <View style={[styles.recommendationIcon, { backgroundColor: item.color }]}>
            <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={16} color="#fff" />
          </View>
        </View>
        <View style={styles.recommendationHeaderText}>
          <Text style={[styles.recommendationGenre, { color: item.color }]}>{item.genre}</Text>
          <Text style={styles.recommendationTitle} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
      </View>

      <Text style={styles.recommendationSubtitle} numberOfLines={1}>
        {item.subtitle}
      </Text>

      <Text style={styles.recommendationMetaText}>
        {item.duration} · {item.students.toLocaleString()}명
      </Text>
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
      <View style={[styles.listThumb, { backgroundColor: `${item.color}16` }]}>
        <View style={[styles.listThumbGlow, { backgroundColor: `${item.color}18` }]} />
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
          <MetaPill icon="time-outline" text={item.duration} size="compact" />
          <MetaPill icon="flash-outline" text={item.tags[0]} size="compact" />
          <MetaPill icon="flame-outline" text={`${item.kcal} kcal`} size="compact" />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ClassesScreen() {
  const [activeGenre, setActiveGenre] = useState<string>('전체');
  const [activeSort, setActiveSort] = useState<(typeof SORT_TABS)[number]>('추천순');
  const [search, setSearch] = useState('');
  const [showSearchTools, setShowSearchTools] = useState(false);
  const [selectedDance, setSelectedDance] = useState<DanceClass | null>(null);
  const [practiceDance, setPracticeDance] = useState<DanceClass | null>(null);

  const sortedClasses = useMemo(() => {
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
      return [...base].sort((a, b) => getDurationMinutes(a.duration) - getDurationMinutes(b.duration));
    }

    return [...base].sort((a, b) => getRecommendationScore(b) - getRecommendationScore(a));
  }, [activeGenre, activeSort, search]);

  const spotlight = sortedClasses[0] ?? null;
  const sideRecommendations = useMemo(
    () => sortedClasses.filter((item) => item.id !== spotlight?.id).slice(0, 2),
    [sortedClasses, spotlight]
  );
  const remainingClasses = useMemo(
    () =>
      sortedClasses.filter(
        (item) => item.id !== spotlight?.id && !sideRecommendations.some((recommendation) => recommendation.id === item.id)
      ),
    [sideRecommendations, sortedClasses, spotlight]
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{showSearchTools ? '클래스 검색' : '클래스'}</Text>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.text3} />
          <TextInput
            style={styles.searchInput}
            placeholder="춤, 강사, 태그를 검색해보세요"
            placeholderTextColor={colors.text3}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setShowSearchTools(true)}
          />
          <TouchableOpacity
            style={[styles.searchToolButton, showSearchTools && styles.searchToolButtonActive]}
            onPress={() => setShowSearchTools((prev) => !prev)}
            activeOpacity={0.85}>
            <Ionicons name="options-outline" size={16} color={showSearchTools ? colors.teal : colors.text3} />
          </TouchableOpacity>
          {showSearchTools ? (
            <TouchableOpacity onPress={() => setShowSearchTools(false)} activeOpacity={0.85}>
              <Text style={styles.searchCancel}>닫기</Text>
            </TouchableOpacity>
          ) : null}
          {!!search && (
            <TouchableOpacity onPress={() => setSearch('')} activeOpacity={0.85}>
              <Ionicons name="close-circle" size={18} color={colors.text3} />
            </TouchableOpacity>
          )}
        </View>

        {showSearchTools ? (
          <View style={styles.searchToolsPanel}>
            <View style={styles.searchToolsHeader}>
              <View>
                <Text style={styles.searchToolsTitle}>검색 필터</Text>
              </View>
              <TouchableOpacity
                style={styles.searchResetButton}
                onPress={() => {
                  setActiveGenre('전체');
                  setActiveSort('추천순');
                  setSearch('');
                }}
                activeOpacity={0.85}>
                <Text style={styles.searchResetText}>초기화</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>장르</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genreRow}>
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

            <View style={styles.filterSectionLast}>
              <Text style={styles.filterLabel}>정렬</Text>
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
          </View>
        ) : null}

        {sortedClasses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes-outline" size={32} color={colors.text3} />
            <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
            <Text style={styles.emptyBody}>다른 장르를 선택하거나 검색어를 조금 더 넓게 바꿔보세요.</Text>
          </View>
        ) : (
          <>
            {spotlight ? (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>FOR YOU</Text>
                  <Text style={styles.sectionTitle}>추천 클래스</Text>
                </View>
                <Text style={styles.sectionCaption}>{sortedClasses.length}개 중 추천</Text>
              </View>

                <View style={styles.recommendationStack}>
                  <SpotlightCard item={spotlight} onPress={() => setSelectedDance(spotlight)} />

                  {sideRecommendations.length > 0 ? (
                    <View style={styles.sideRecommendationRow}>
                      {sideRecommendations.map((item) => (
                        <RecommendationCard key={item.id} item={item} onPress={() => setSelectedDance(item)} />
                      ))}
                    </View>
                  ) : null}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionEyebrow}>BROWSE ALL</Text>
                  <Text style={styles.sectionTitle}>전체 클래스</Text>
                </View>
                <Text style={styles.sectionCaption}>{sortedClasses.length}개</Text>
              </View>

              {(remainingClasses.length > 0 ? remainingClasses : sortedClasses).map((item) => (
                <ClassListCard key={item.id} item={item} onPress={() => setSelectedDance(item)} />
              ))}
            </View>
          </>
        )}
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
    paddingBottom: 110,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  headerCopy: {
    maxWidth: '92%',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text1,
  },
  searchBar: {
    marginHorizontal: 20,
    marginBottom: 18,
    paddingHorizontal: 14,
    height: 50,
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
  searchCancel: {
    fontSize: 13,
    color: colors.teal,
    fontWeight: '700',
  },
  searchToolButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchToolButtonActive: {
    borderColor: colors.teal,
    backgroundColor: `${colors.teal}18`,
  },
  searchToolsPanel: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 26,
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchToolsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  searchToolsTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text1,
  },
  searchResetButton: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: radius.full,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResetText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text1,
  },
  filterSection: {
    marginBottom: 18,
  },
  filterSectionLast: {
    marginBottom: 0,
  },
  filterLabel: {
    paddingHorizontal: 2,
    marginBottom: 12,
    fontSize: 12,
    color: colors.text3,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  genreRow: {
    gap: 10,
  },
  genreChip: {
    height: 40,
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
    fontWeight: '700',
    color: colors.text2,
  },
  genreChipTextActive: {
    color: '#fff',
  },
  sortRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  sortChip: {
    height: 36,
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
    backgroundColor: `${colors.teal}18`,
  },
  sortChipText: {
    fontSize: 12,
    color: colors.text2,
    fontWeight: '700',
  },
  sortChipTextActive: {
    color: colors.teal,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    marginBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
  },
  sectionEyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: colors.text3,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: colors.text1,
  },
  sectionCaption: {
    fontSize: 12,
    color: colors.text3,
    fontWeight: '600',
  },
  recommendationStack: {
    paddingHorizontal: 20,
  },
  spotlightCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 24,
    padding: 15,
    backgroundColor: colors.surface,
    borderWidth: 1,
    marginBottom: 12,
  },
  spotlightGlow: {
    position: 'absolute',
    right: -18,
    top: -18,
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  spotlightOrb: {
    position: 'absolute',
    left: -16,
    bottom: -26,
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  spotlightTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  spotlightGenreBadge: {
    borderRadius: radius.full,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderWidth: 1,
    backgroundColor: `${colors.bg}55`,
  },
  spotlightGenreText: {
    fontSize: 11,
    fontWeight: '800',
  },
  spotlightLevelBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  spotlightLevelText: {
    fontSize: 11,
    fontWeight: '800',
  },
  spotlightBody: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 14,
  },
  spotlightIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotlightCopy: {
    flex: 1,
  },
  spotlightEyebrow: {
    fontSize: 10,
    color: colors.accent2,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  spotlightTitle: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '900',
    color: colors.text1,
    marginBottom: 4,
  },
  spotlightSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
    marginBottom: 8,
  },
  spotlightInstructor: {
    fontSize: 11,
    color: colors.text3,
    fontWeight: '600',
  },
  spotlightMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  spotlightFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  spotlightTagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  spotlightTag: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: `${colors.surface2}D8`,
    borderWidth: 1,
    borderColor: colors.border,
  },
  spotlightTagText: {
    fontSize: 10,
    color: colors.text2,
    fontWeight: '700',
  },
  spotlightAction: {
    minWidth: 98,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  spotlightActionText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '800',
  },
  sideRecommendationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  recommendationCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 11,
  },
  recommendationHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  recommendationIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationIcon: {
    width: 26,
    height: 26,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  recommendationGenre: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  recommendationTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text1,
  },
  recommendationSubtitle: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.text2,
    marginBottom: 8,
  },
  recommendationMetaText: {
    fontSize: 10,
    color: colors.text3,
    fontWeight: '700',
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
  metaPillCompact: {
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metaPillStrong: {
    backgroundColor: `${colors.bg}66`,
  },
  metaPillText: {
    fontSize: 11,
    color: colors.text2,
    fontWeight: '700',
  },
  metaPillTextCompact: {
    fontSize: 10,
  },
  metaPillTextStrong: {
    color: colors.text1,
  },
  listCard: {
    marginHorizontal: 20,
    marginBottom: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  listThumb: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  listThumbGlow: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  listIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    flex: 1,
    padding: 12,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
    gap: 8,
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
    fontSize: 15,
    fontWeight: '900',
    color: colors.text1,
    marginBottom: 4,
  },
  listSubtitle: {
    fontSize: 11,
    lineHeight: 16,
    color: colors.text2,
    marginBottom: 6,
  },
  listInstructor: {
    fontSize: 11,
    color: colors.text3,
    marginBottom: 10,
  },
  listBottomRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 6,
  },
  emptyState: {
    marginHorizontal: 20,
    marginTop: 12,
    padding: 26,
    borderRadius: 28,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
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
