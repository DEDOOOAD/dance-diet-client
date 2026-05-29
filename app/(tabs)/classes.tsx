import { DanceDetailModal } from '@/components/dance-detail-modal';
import { DanceVisionPracticeModal } from '@/components/dance-vision-practice-modal';
import { colors, radius } from '@/constants/theme';
import { type DanceClass } from '@/data/dances';
import { useGeneralServerDanceClasses } from '@/hooks/use-general-server-dance-classes';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import { ImageBackground, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

function MetaPill({
  icon,
  text,
  tone = 'default',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: 'default' | 'strong';
}) {
  return (
    <View style={[styles.metaPill, tone === 'strong' && styles.metaPillStrong]}>
      <Ionicons name={icon} size={12} color={tone === 'strong' ? colors.text1 : colors.text3} />
      <Text style={[styles.metaPillText, tone === 'strong' && styles.metaPillTextStrong]}>{text}</Text>
    </View>
  );
}

function getInstructorLabel(item: DanceClass) {
  const label = item.instructor?.trim();
  if (!label) {
    return '추천 클래스';
  }

  if (label.toLowerCase() === 'youtube') {
    return 'YouTube 클래스';
  }

  return label;
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
      {item.thumbnailUrl ? (
        <ImageBackground source={{ uri: item.thumbnailUrl }} style={StyleSheet.absoluteFill} imageStyle={styles.heroImage}>
          <View style={styles.heroImageOverlay} />
        </ImageBackground>
      ) : (
        <>
          <View style={[styles.spotlightGlow, { backgroundColor: `${item.color}26` }]} />
          <View style={[styles.spotlightOrb, { backgroundColor: `${item.color}16` }]} />
        </>
      )}

      <View style={[styles.heroTint, { backgroundColor: `${item.color}18` }]} />

      <View style={styles.spotlightHeaderRow}>
        <View style={styles.spotlightEyebrowChip}>
          <Text style={styles.spotlightEyebrowText}>SPOTLIGHT CLASS</Text>
        </View>
      </View>

      <View style={styles.spotlightBody}>
        <View style={styles.spotlightCopy}>
          <Text style={styles.spotlightSource}>{getInstructorLabel(item)}</Text>
          <Text style={styles.spotlightTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <Text style={styles.spotlightSubtitle} numberOfLines={3}>
            {item.subtitle}
          </Text>
        </View>
      </View>

      <View style={styles.spotlightFooter}>
        <View style={styles.spotlightMetaRow}>
          <MetaPill icon="time-outline" text={item.duration} tone="strong" />
          <MetaPill icon="flame-outline" text={`${item.kcal} kcal`} tone="strong" />
          <MetaPill icon="star-outline" text={item.rating} tone="strong" />
        </View>

        <View style={styles.spotlightAction}>
          <Text style={styles.spotlightActionText}>클래스 보기</Text>
          <Ionicons name="arrow-forward" size={15} color="#fff" />
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
      {item.thumbnailUrl ? (
        <ImageBackground source={{ uri: item.thumbnailUrl }} style={styles.recommendationArt} imageStyle={styles.recommendationImage}>
          <View style={styles.recommendationOverlay} />
        </ImageBackground>
      ) : (
        <View style={[styles.recommendationArt, { backgroundColor: `${item.color}1A` }]}>
          <View style={[styles.recommendationFallbackOrb, { backgroundColor: `${item.color}28` }]} />
          <View style={[styles.recommendationIcon, { backgroundColor: item.color }]}>
            <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color="#fff" />
          </View>
        </View>
      )}

      <View style={styles.recommendationContent}>
        <Text style={styles.recommendationSource} numberOfLines={1}>
          {getInstructorLabel(item)}
        </Text>
        <Text style={styles.recommendationTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.recommendationMetaRow}>
          <MetaPill icon="time-outline" text={item.duration} />
          <MetaPill icon="star-outline" text={item.rating} />
        </View>
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
    <TouchableOpacity style={styles.listCard} activeOpacity={0.92} onPress={onPress}>
      {item.thumbnailUrl ? (
        <ImageBackground source={{ uri: item.thumbnailUrl }} style={styles.listThumb} imageStyle={styles.listThumbImage}>
          <View style={styles.listThumbOverlay} />
        </ImageBackground>
      ) : (
        <View style={[styles.listThumb, { backgroundColor: `${item.color}14` }]}>
          <View style={[styles.listThumbGlow, { backgroundColor: `${item.color}20` }]} />
          <View style={[styles.listIcon, { backgroundColor: item.color }]}>
            <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={24} color="#fff" />
          </View>
        </View>
      )}

      <View style={styles.listInfo}>
        <Text style={styles.listStudents}>{`${item.students.toLocaleString()}명 참여`}</Text>
        <Text style={styles.listTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <Text style={styles.listSubtitle} numberOfLines={2}>
          {item.subtitle}
        </Text>
        <Text style={styles.listInstructor} numberOfLines={1}>
          {getInstructorLabel(item)}
        </Text>

        <View style={styles.listBottomRow}>
          <MetaPill icon="time-outline" text={item.duration} />
          <MetaPill icon="flame-outline" text={`${item.kcal} kcal`} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function ClassesScreen() {
  const [search, setSearch] = useState('');
  const [selectedDance, setSelectedDance] = useState<DanceClass | null>(null);
  const [practiceDance, setPracticeDance] = useState<DanceClass | null>(null);
  const { classes: serverDanceClasses, loading, isFallback } = useGeneralServerDanceClasses({ search });

  const filteredClasses = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return serverDanceClasses.filter((dance) => !keyword || dance.title.toLowerCase().includes(keyword));
  }, [search, serverDanceClasses]);

  const spotlight = filteredClasses[0] ?? null;
  const sideRecommendations = useMemo(
    () => filteredClasses.filter((item) => item.id !== spotlight?.id).slice(0, 2),
    [filteredClasses, spotlight]
  );
  const remainingClasses = useMemo(
    () =>
      filteredClasses.filter(
        (item) => item.id !== spotlight?.id && !sideRecommendations.some((recommendation) => recommendation.id === item.id)
      ),
    [filteredClasses, sideRecommendations, spotlight]
  );

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>클래스</Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={colors.text3} />
          <TextInput
            style={styles.searchInput}
            placeholder="클래스 이름을 검색해보세요"
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

        {loading ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>클래스 목록을 불러오는 중이에요.</Text>
          </View>
        ) : null}

        {!loading && isFallback ? (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>서버 연결이 잠시 불안정해서 기본 클래스 목록을 보여주고 있어요.</Text>
          </View>
        ) : null}

        {filteredClasses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="musical-notes-outline" size={32} color={colors.text3} />
            <Text style={styles.emptyTitle}>검색 결과가 없어요</Text>
            <Text style={styles.emptyBody}>다른 클래스 이름으로 다시 검색해보세요.</Text>
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
                  <Text style={styles.sectionCaption}>{`${filteredClasses.length}개 중 추천`}</Text>
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
                <Text style={styles.sectionCaption}>{`${filteredClasses.length}개`}</Text>
              </View>

              {(remainingClasses.length > 0 ? remainingClasses : filteredClasses).map((item) => (
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
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text1,
  },
  searchBar: {
    marginHorizontal: 20,
    marginBottom: 18,
    paddingHorizontal: 14,
    height: 54,
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
  statusBanner: {
    marginHorizontal: 20,
    marginBottom: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBannerText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
    fontWeight: '600',
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
    letterSpacing: 1.6,
    color: colors.text3,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 22,
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
    borderRadius: 28,
    minHeight: 330,
    padding: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    marginBottom: 14,
    justifyContent: 'space-between',
  },
  heroImage: {
    borderRadius: 28,
  },
  heroImageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(7, 7, 10, 0.52)',
  },
  heroTint: {
    ...StyleSheet.absoluteFillObject,
  },
  spotlightGlow: {
    position: 'absolute',
    right: -28,
    top: -28,
    width: 170,
    height: 170,
    borderRadius: 85,
  },
  spotlightOrb: {
    position: 'absolute',
    left: -22,
    bottom: -42,
    width: 126,
    height: 126,
    borderRadius: 63,
  },
  spotlightHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  spotlightEyebrowChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: 'rgba(13, 13, 15, 0.56)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  spotlightEyebrowText: {
    fontSize: 11,
    color: colors.accent2,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  spotlightBody: {
    marginTop: 36,
  },
  spotlightCopy: {
    maxWidth: '86%',
  },
  spotlightSource: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.76)',
    fontWeight: '700',
    marginBottom: 10,
  },
  spotlightTitle: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 12,
  },
  spotlightSubtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
  },
  spotlightFooter: {
    gap: 16,
  },
  spotlightMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  spotlightAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
  },
  spotlightActionText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '800',
  },
  sideRecommendationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  recommendationCard: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  recommendationArt: {
    height: 118,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  recommendationImage: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  recommendationOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 13, 15, 0.28)',
  },
  recommendationFallbackOrb: {
    position: 'absolute',
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  recommendationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationContent: {
    padding: 14,
    gap: 10,
  },
  recommendationSource: {
    fontSize: 11,
    color: colors.text3,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  recommendationTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: colors.text1,
    minHeight: 44,
  },
  recommendationMetaRow: {
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
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaPillStrong: {
    backgroundColor: 'rgba(13, 13, 15, 0.56)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  metaPillText: {
    fontSize: 11,
    color: colors.text2,
    fontWeight: '700',
  },
  metaPillTextStrong: {
    color: colors.text1,
  },
  listCard: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  listThumb: {
    width: 124,
    minHeight: 142,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  listThumbImage: {
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
  },
  listThumbOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 13, 15, 0.22)',
  },
  listThumbGlow: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  listIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listInfo: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  listStudents: {
    fontSize: 11,
    color: colors.text3,
    marginBottom: 8,
  },
  listTitle: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '900',
    color: colors.text1,
    marginBottom: 6,
  },
  listSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
    marginBottom: 10,
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
    padding: 28,
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
