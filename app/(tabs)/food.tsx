import { colors, radius } from '@/constants/theme';
import { getCurrentUserUuid, loadCurrentUserUuid } from '@/services/current-user';
import { type FoodIntakeAnalysisResult, uploadFoodIntake } from '@/services/food-intake';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AnalyzeState = 'idle' | 'captured' | 'checking' | 'done';

const TEXT = {
  title: '식단 촬영',
  subtitle: '카메라나 갤러리에서 음식 사진을 준비하고 서버 분석으로 칼로리를 확인해보세요.',
  permissionTitle: '권한이 필요해요',
  galleryPermissionBody: '갤러리에서 사진을 고르려면 사진 접근 권한을 허용해 주세요.',
  cameraPermissionBody: '카메라로 촬영하려면 카메라 권한을 허용해 주세요.',
  imageSourceTitle: '사진 가져오기',
  imageSourceBody: '어떤 방법으로 음식 사진을 준비할까요?',
  cameraAction: '카메라로 촬영',
  galleryAction: '갤러리에서 선택',
  cancelAction: '취소',
  readyBadge: '사진 준비 완료',
  emptyTitle: '음식 사진을 준비해 주세요',
  emptyBody: '사진을 찍거나 고른 뒤 서버에 업로드해서 칼로리를 분석할 수 있어요.',
  changePhoto: '사진 변경',
  reset: '초기화',
  checking: '칼로리 확인 중...',
  analyze: '칼로리 확인하기',
  resultTitle: '분석 결과',
  uploadFailed: '식단 분석에 실패했어요.',
  emptyResult: '인식된 음식이 없어요',
  emptyResultBody: '조금 더 선명한 음식 사진으로 다시 시도해보세요.',
  foodsTitle: '인식한 음식',
  sourceTitle: '분석 출처',
};

function buildImagePickerOptions() {
  return {
    mediaTypes: ['images'] as ImagePicker.MediaType[],
    allowsEditing: true,
    aspect: [4, 5] as [number, number],
    quality: 0.9,
  };
}

export default function FoodScreen() {
  const [state, setState] = useState<AnalyzeState>('idle');
  const [currentUserId, setCurrentUserId] = useState(() => getCurrentUserUuid());
  const [imageAsset, setImageAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [analysisResult, setAnalysisResult] = useState<FoodIntakeAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    void loadCurrentUserUuid()
      .then((userId) => {
        setCurrentUserId(userId);
      })
      .catch(() => {
        setCurrentUserId(getCurrentUserUuid());
      });
  }, []);

  const totalCaloriesLabel = useMemo(() => {
    if (!analysisResult) {
      return '0 kcal';
    }

    return `${analysisResult.totalCalories.toLocaleString()} kcal`;
  }, [analysisResult]);

  const applyPickedAsset = (asset: ImagePicker.ImagePickerAsset) => {
    setImageAsset(asset);
    setAnalysisResult(null);
    setAnalysisError(null);
    setState('captured');
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(TEXT.permissionTitle, TEXT.galleryPermissionBody);
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync(buildImagePickerOptions());

    if (pickerResult.canceled || !pickerResult.assets.length) {
      return;
    }

    applyPickedAsset(pickerResult.assets[0]);
  };

  const captureWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(TEXT.permissionTitle, TEXT.cameraPermissionBody);
      return;
    }

    const cameraResult = await ImagePicker.launchCameraAsync({
      ...buildImagePickerOptions(),
      cameraType: ImagePicker.CameraType.back,
    });

    if (cameraResult.canceled || !cameraResult.assets.length) {
      return;
    }

    applyPickedAsset(cameraResult.assets[0]);
  };

  const chooseImageSource = () => {
    Alert.alert(TEXT.imageSourceTitle, TEXT.imageSourceBody, [
      { text: TEXT.cameraAction, onPress: captureWithCamera },
      { text: TEXT.galleryAction, onPress: pickFromGallery },
      { text: TEXT.cancelAction, style: 'cancel' },
    ]);
  };

  const handleAnalyze = async () => {
    if (!imageAsset?.uri) {
      return;
    }

    setState('checking');
    setAnalysisError(null);

    try {
      const result = await uploadFoodIntake({
        userId: currentUserId,
        day: new Date(),
        imageUri: imageAsset.uri,
        fileName: imageAsset.fileName,
        mimeType: imageAsset.mimeType,
      });

      setAnalysisResult(result);
      setState('done');

      if (result.note && result.note.toLowerCase() === 'failed') {
        setAnalysisError(TEXT.uploadFailed);
      }
    } catch (error) {
      setAnalysisResult(null);
      setState('captured');
      setAnalysisError(error instanceof Error ? error.message : TEXT.uploadFailed);
    }
  };

  const reset = () => {
    setState('idle');
    setImageAsset(null);
    setAnalysisResult(null);
    setAnalysisError(null);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{TEXT.title}</Text>
          <Text style={styles.subtitle}>{TEXT.subtitle}</Text>
        </View>
        <View style={styles.iconButton}>
          <Ionicons name="sparkles-outline" size={20} color={colors.text2} />
        </View>
      </View>

      <View style={styles.cameraCard}>
        {imageAsset?.uri ? (
          <>
            <Image source={{ uri: imageAsset.uri }} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.previewOverlay}>
              <View style={styles.previewBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#fff" />
                <Text style={styles.previewBadgeText}>{TEXT.readyBadge}</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.capturePlaceholder}>
            <View style={styles.captureIcon}>
              <Ionicons name="camera" size={28} color="#fff" />
            </View>
            <Text style={styles.captureTitle}>{TEXT.emptyTitle}</Text>
            <Text style={styles.captureText}>{TEXT.emptyBody}</Text>

            <View style={styles.captureActionStack}>
              <TouchableOpacity style={styles.capturePrimaryButton} onPress={captureWithCamera} activeOpacity={0.88}>
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={styles.capturePrimaryText}>{TEXT.cameraAction}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.captureSecondaryButton} onPress={pickFromGallery} activeOpacity={0.88}>
                <Ionicons name="images-outline" size={18} color={colors.text1} />
                <Text style={styles.captureSecondaryText}>{TEXT.galleryAction}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.secondaryAction}
          onPress={imageAsset ? chooseImageSource : reset}
          activeOpacity={0.85}>
          <Ionicons name={imageAsset ? 'camera-reverse-outline' : 'refresh-outline'} size={18} color={colors.text1} />
          <Text style={styles.secondaryActionText}>{imageAsset ? TEXT.changePhoto : TEXT.reset}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryAction, (!imageAsset || state === 'checking') && styles.primaryActionDisabled]}
          onPress={handleAnalyze}
          activeOpacity={0.85}
          disabled={!imageAsset || state === 'checking'}>
          <Ionicons name="flame-outline" size={18} color="#fff" />
          <Text style={styles.primaryActionText}>{state === 'checking' ? TEXT.checking : TEXT.analyze}</Text>
        </TouchableOpacity>
      </View>

      {analysisError ? (
        <View style={styles.noticeCard}>
          <Ionicons name="alert-circle-outline" size={18} color={colors.accent2} />
          <Text style={styles.noticeText}>{analysisError}</Text>
        </View>
      ) : null}

      {analysisResult ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>{TEXT.resultTitle}</Text>
            <View style={styles.kcalBadge}>
              <Ionicons name="flame" size={14} color="#fff" />
              <Text style={styles.kcalBadgeText}>{totalCaloriesLabel}</Text>
            </View>
          </View>

          <View style={styles.resultMetaRow}>
            <View style={styles.resultMetaCard}>
              <Text style={styles.resultMetaLabel}>{TEXT.sourceTitle}</Text>
              <Text style={styles.resultMetaValue}>{analysisResult.source}</Text>
            </View>
            <View style={styles.resultMetaCard}>
              <Text style={styles.resultMetaLabel}>분석 시각</Text>
              <Text style={styles.resultMetaValue} numberOfLines={1}>
                {new Date(analysisResult.analyzedAt).toLocaleTimeString('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
          </View>

          {analysisResult.foods.length > 0 ? (
            <>
              <Text style={styles.foodSectionTitle}>{TEXT.foodsTitle}</Text>
              <View style={styles.foodList}>
                {analysisResult.foods.map((food, index) => (
                  <View key={`${food.label}-${index}`} style={styles.foodRow}>
                    <View style={styles.foodRowLeft}>
                      <View style={styles.foodDot} />
                      <Text style={styles.foodName}>{food.label}</Text>
                    </View>
                    <Text style={styles.foodCalories}>{`${food.calories.toLocaleString()} kcal`}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <View style={styles.emptyResultCard}>
              <Text style={styles.emptyResultTitle}>{TEXT.emptyResult}</Text>
              <Text style={styles.emptyResultBody}>{TEXT.emptyResultBody}</Text>
            </View>
          )}
        </View>
      ) : null}

      <View style={{ height: 110 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 56,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: colors.text2,
    lineHeight: 19,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraCard: {
    marginHorizontal: 20,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 320,
  },
  capturePlaceholder: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 28,
  },
  captureIcon: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  captureTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 8,
    textAlign: 'center',
  },
  captureText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text2,
    textAlign: 'center',
    marginBottom: 22,
  },
  captureActionStack: {
    width: '100%',
    gap: 10,
  },
  capturePrimaryButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  capturePrimaryText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  captureSecondaryButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  captureSecondaryText: {
    color: colors.text1,
    fontSize: 14,
    fontWeight: '700',
  },
  previewImage: {
    width: '100%',
    height: 360,
  },
  previewOverlay: {
    position: 'absolute',
    top: 14,
    right: 14,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13, 13, 15, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  previewBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingHorizontal: 20,
  },
  secondaryAction: {
    flex: 0.38,
    height: 52,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryActionText: {
    color: colors.text1,
    fontSize: 14,
    fontWeight: '700',
  },
  primaryAction: {
    flex: 0.62,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  primaryActionDisabled: {
    opacity: 0.45,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  noticeCard: {
    marginHorizontal: 20,
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
    fontWeight: '600',
  },
  resultCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: 18,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text1,
  },
  kcalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: radius.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  kcalBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  resultMetaRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  resultMetaCard: {
    flex: 1,
    minHeight: 74,
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 14,
    justifyContent: 'space-between',
  },
  resultMetaLabel: {
    fontSize: 11,
    color: colors.text3,
    fontWeight: '700',
  },
  resultMetaValue: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text1,
    fontWeight: '700',
  },
  foodSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text1,
    marginBottom: 10,
  },
  foodList: {
    gap: 10,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  foodRowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  foodDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent2,
  },
  foodName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
  },
  foodCalories: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text2,
  },
  emptyResultCard: {
    backgroundColor: colors.surface2,
    borderRadius: radius.lg,
    padding: 16,
    gap: 6,
  },
  emptyResultTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text1,
  },
  emptyResultBody: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
  },
});
