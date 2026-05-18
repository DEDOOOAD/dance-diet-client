import { colors, radius } from '@/constants/theme';
import { getGeneralServerFoodIntakeEndpoint } from '@/services/server-config/general-server';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AnalyzeState = 'idle' | 'captured' | 'checking' | 'done';

type SelectedImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

type FoodItem = {
  label: string;
  calories: number;
  confidence: number;
};

type FoodIntakeAnalysisResponse = {
  foods: FoodItem[];
  total_calories: number;
  image_filename?: string | null;
  source: string;
  analyzed_at: string;
  note?: string | null;
};

const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_USER_UUID = 'user-lee';

const TEXT = {
  title: '식단 촬영',
  subtitle: '카메라로 바로 찍거나 갤러리에서 고른 뒤 칼로리를 편하게 확인해보세요.',
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
  emptyBody: '카메라로 바로 촬영하거나 갤러리에서 사진을 골라 칼로리를 확인할 수 있어요.',
  changePhoto: '사진 변경',
  reset: '초기화',
  checking: '칼로리 확인 중...',
  analyze: '칼로리 확인하기',
  resultTitle: '분석 결과',
  resultFoodsTitle: '인식된 음식',
  resultMetaTitle: '분석 정보',
  sourceLabel: '분석 소스',
  analyzedAtLabel: '분석 시각',
  noteLabel: '메모',
  errorTitle: '분석에 실패했어요',
  errorBody: '잠시 후 다시 시도하거나 다른 사진으로 다시 확인해 주세요.',
};

function getFoodUserUuid() {
  const configuredUuid = process.env.EXPO_PUBLIC_USER_UUID?.trim();
  if (configuredUuid) {
    return configuredUuid;
  }

  return DEFAULT_USER_UUID;
}

function normalizeFileName(candidate: string | null | undefined, uri: string) {
  if (candidate?.trim()) {
    return candidate.trim();
  }

  const fromUri = uri.split('/').pop()?.split('?')[0]?.trim();
  if (fromUri) {
    return fromUri;
  }

  return `food-${Date.now()}.jpg`;
}

function inferMimeType(uri: string, candidate?: string | null) {
  if (candidate?.trim()) {
    return candidate.trim();
  }

  const normalizedUri = uri.toLowerCase();
  if (normalizedUri.endsWith('.png')) {
    return 'image/png';
  }

  if (normalizedUri.endsWith('.webp')) {
    return 'image/webp';
  }

  if (normalizedUri.endsWith('.bmp')) {
    return 'image/bmp';
  }

  return 'image/jpeg';
}

async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function toSelectedImage(asset: ImagePicker.ImagePickerAsset): SelectedImage {
  return {
    uri: asset.uri,
    fileName: normalizeFileName(asset.fileName, asset.uri),
    mimeType: inferMimeType(asset.uri, asset.mimeType),
  };
}

function formatAnalyzedAt(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FoodScreen() {
  const [state, setState] = useState<AnalyzeState>('idle');
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null);
  const [result, setResult] = useState<FoodIntakeAnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateSelectedImage = (asset: ImagePicker.ImagePickerAsset) => {
    setSelectedImage(toSelectedImage(asset));
    setResult(null);
    setErrorMessage(null);
    setState('captured');
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(TEXT.permissionTitle, TEXT.galleryPermissionBody);
      return;
    }

    const pickerResult = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1,
    });

    if (pickerResult.canceled || !pickerResult.assets.length) {
      return;
    }

    updateSelectedImage(pickerResult.assets[0]);
  };

  const captureWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert(TEXT.permissionTitle, TEXT.cameraPermissionBody);
      return;
    }

    const cameraResult = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1,
      cameraType: ImagePicker.CameraType.back,
    });

    if (cameraResult.canceled || !cameraResult.assets.length) {
      return;
    }

    updateSelectedImage(cameraResult.assets[0]);
  };

  const chooseImageSource = () => {
    Alert.alert(TEXT.imageSourceTitle, TEXT.imageSourceBody, [
      { text: TEXT.cameraAction, onPress: captureWithCamera },
      { text: TEXT.galleryAction, onPress: pickFromGallery },
      { text: TEXT.cancelAction, style: 'cancel' },
    ]);
  };

  const handleAnalyze = async () => {
    if (!selectedImage) {
      return;
    }

    setState('checking');
    setErrorMessage(null);

    try {
      const formData = new FormData();
      formData.append('uuid', getFoodUserUuid());
      formData.append('day', new Date().toISOString());
      formData.append('image', {
        uri: selectedImage.uri,
        name: selectedImage.fileName,
        type: selectedImage.mimeType,
      } as unknown as Blob);

      const response = await fetchWithTimeout(getGeneralServerFoodIntakeEndpoint(), {
        method: 'POST',
        body: formData,
      });

      const payloadText = await response.text();
      const payload = payloadText ? (JSON.parse(payloadText) as FoodIntakeAnalysisResponse | { detail?: string }) : null;

      if (!response.ok) {
        const detail =
          payload && typeof payload === 'object' && 'detail' in payload && typeof payload.detail === 'string'
            ? payload.detail
            : TEXT.errorBody;
        throw new Error(detail);
      }

      const nextResult = payload as FoodIntakeAnalysisResponse;
      setResult(nextResult);
      setState('done');
    } catch (error) {
      const message = error instanceof Error ? error.message : TEXT.errorBody;
      setErrorMessage(message);
      setResult(null);
      setState('captured');
      Alert.alert(TEXT.errorTitle, message);
    }
  };

  const reset = () => {
    setState('idle');
    setSelectedImage(null);
    setResult(null);
    setErrorMessage(null);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{TEXT.title}</Text>
          <Text style={styles.subtitle}>{TEXT.subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.85}>
          <Ionicons name="sparkles-outline" size={20} color={colors.text2} />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraCard}>
        {selectedImage ? (
          <>
            <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} resizeMode="cover" />
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
          onPress={selectedImage ? chooseImageSource : reset}
          activeOpacity={0.85}>
          <Ionicons name={selectedImage ? 'camera-reverse-outline' : 'refresh-outline'} size={18} color={colors.text1} />
          <Text style={styles.secondaryActionText}>{selectedImage ? TEXT.changePhoto : TEXT.reset}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryAction, state === 'idle' && styles.primaryActionDisabled]}
          onPress={handleAnalyze}
          activeOpacity={0.85}
          disabled={state === 'idle' || state === 'checking'}>
          <Ionicons name="flame-outline" size={18} color="#fff" />
          <Text style={styles.primaryActionText}>{state === 'checking' ? TEXT.checking : TEXT.analyze}</Text>
        </TouchableOpacity>
      </View>

      {errorMessage ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>{TEXT.errorTitle}</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {result ? (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>{TEXT.resultTitle}</Text>
            <View style={styles.kcalBadge}>
              <Ionicons name="flame" size={14} color="#fff" />
              <Text style={styles.kcalBadgeText}>{Math.round(result.total_calories)} kcal</Text>
            </View>
          </View>

          <View style={styles.foodListSection}>
            <Text style={styles.resultSectionTitle}>{TEXT.resultFoodsTitle}</Text>
            <View style={styles.foodList}>
              {result.foods.map((food, index) => (
                <View key={`${food.label}-${index}`} style={styles.foodRow}>
                  <View style={styles.foodRowMain}>
                    <Text style={styles.foodLabel}>{food.label}</Text>
                    <Text style={styles.foodConfidence}>정확도 {Math.round(food.confidence * 100)}%</Text>
                  </View>
                  <Text style={styles.foodCalories}>{Math.round(food.calories)} kcal</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.metaSection}>
            <Text style={styles.resultSectionTitle}>{TEXT.resultMetaTitle}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{TEXT.sourceLabel}</Text>
              <Text style={styles.metaValue}>{result.source}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>{TEXT.analyzedAtLabel}</Text>
              <Text style={styles.metaValue}>{formatAnalyzedAt(result.analyzed_at)}</Text>
            </View>
            {result.note ? (
              <View style={styles.metaNote}>
                <Text style={styles.metaNoteLabel}>{TEXT.noteLabel}</Text>
                <Text style={styles.metaNoteText}>{result.note}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}
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
  errorCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: '#351A1E',
    borderWidth: 1,
    borderColor: '#5A2A31',
    borderRadius: radius.xl,
    padding: 16,
  },
  errorTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFD5DA',
    marginBottom: 6,
  },
  errorText: {
    fontSize: 13,
    lineHeight: 19,
    color: '#F0B8C0',
  },
  resultCard: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 110,
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
    marginBottom: 16,
    gap: 10,
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
  foodListSection: {
    marginBottom: 18,
  },
  resultSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text2,
    marginBottom: 10,
    letterSpacing: 0.4,
  },
  foodList: {
    gap: 10,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  foodRowMain: {
    flex: 1,
  },
  foodLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text1,
    marginBottom: 4,
    textTransform: 'capitalize',
  },
  foodConfidence: {
    fontSize: 12,
    color: colors.text3,
  },
  foodCalories: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.accent2,
  },
  metaSection: {
    paddingTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  metaLabel: {
    fontSize: 12,
    color: colors.text3,
  },
  metaValue: {
    flex: 1,
    fontSize: 12,
    color: colors.text1,
    textAlign: 'right',
  },
  metaNote: {
    marginTop: 8,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaNoteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text2,
    marginBottom: 6,
  },
  metaNoteText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
  },
});
