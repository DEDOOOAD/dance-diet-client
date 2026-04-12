import { colors, radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AnalyzeState = 'idle' | 'captured' | 'checking' | 'done';

export default function FoodScreen() {
  const [state, setState] = useState<AnalyzeState>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const result = useMemo(
    () => ({
      name: '닭가슴살',
      calories: 428,
      carbs: '32g',
      protein: '29g',
      fat: '18g',
    }),
    []
  );

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('권한이 필요해요', '갤러리에서 사진을 고르려면 사진 접근 권한을 허용해주세요.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    setImageUri(result.assets[0].uri);
    setState('captured');
  };

  const captureWithCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('권한이 필요해요', '카메라로 촬영하려면 카메라 권한을 허용해주세요.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 5],
      quality: 1,
      cameraType: ImagePicker.CameraType.back,
    });

    if (result.canceled || !result.assets.length) {
      return;
    }

    setImageUri(result.assets[0].uri);
    setState('captured');
  };

  const chooseImageSource = () => {
    Alert.alert('사진 가져오기', '어떤 방법으로 음식 사진을 준비할까요?', [
      { text: '카메라로 촬영', onPress: captureWithCamera },
      { text: '갤러리에서 선택', onPress: pickFromGallery },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const handleAnalyze = () => {
    setState('checking');
    setTimeout(() => {
      setState('done');
    }, 1200);
  };

  const reset = () => {
    setState('idle');
    setImageUri(null);
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>식단 촬영</Text>
          <Text style={styles.subtitle}>
            카메라로 바로 찍거나 갤러리에서 고른 뒤 칼로리를 편하게 확인해보세요.
          </Text>
        </View>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.85}>
          <Ionicons name="sparkles-outline" size={20} color={colors.text2} />
        </TouchableOpacity>
      </View>

      <View style={styles.cameraCard}>
        {imageUri ? (
          <>
            <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.previewOverlay}>
              <View style={styles.previewBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#fff" />
                <Text style={styles.previewBadgeText}>사진 준비 완료</Text>
              </View>
            </View>
          </>
        ) : (
          <View style={styles.capturePlaceholder}>
            <View style={styles.captureIcon}>
              <Ionicons name="camera" size={28} color="#fff" />
            </View>
            <Text style={styles.captureTitle}>음식 사진을 준비해주세요</Text>
            <Text style={styles.captureText}>
              카메라로 바로 촬영하거나 갤러리에서 사진을 골라 칼로리를 확인할 수 있어요.
            </Text>

            <View style={styles.captureActionStack}>
              <TouchableOpacity style={styles.capturePrimaryButton} onPress={captureWithCamera} activeOpacity={0.88}>
                <Ionicons name="camera-outline" size={18} color="#fff" />
                <Text style={styles.capturePrimaryText}>카메라로 찍기</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.captureSecondaryButton} onPress={pickFromGallery} activeOpacity={0.88}>
                <Ionicons name="images-outline" size={18} color={colors.text1} />
                <Text style={styles.captureSecondaryText}>갤러리에서 선택</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.secondaryAction} onPress={imageUri ? chooseImageSource : reset} activeOpacity={0.85}>
          <Ionicons name={imageUri ? 'camera-reverse-outline' : 'refresh-outline'} size={18} color={colors.text1} />
          <Text style={styles.secondaryActionText}>{imageUri ? '재선택' : '초기화'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryAction, state === 'idle' && styles.primaryActionDisabled]}
          onPress={handleAnalyze}
          activeOpacity={0.85}
          disabled={state === 'idle' || state === 'checking'}>
          <Ionicons name="flame-outline" size={18} color="#fff" />
          <Text style={styles.primaryActionText}>
            {state === 'checking' ? '칼로리 확인 중...' : '칼로리 확인하기'}
          </Text>
        </TouchableOpacity>
      </View>

      {state === 'done' && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>분석 결과</Text>
            <View style={styles.kcalBadge}>
              <Ionicons name="flame" size={14} color="#fff" />
              <Text style={styles.kcalBadgeText}>{result.calories} kcal</Text>
            </View>
          </View>

          <Text style={styles.foodName}>{result.name}</Text>

          <View style={styles.nutrientRow}>
            <NutrientCard label="탄수화물" value={result.carbs} color={colors.accent2} />
            <NutrientCard label="단백질" value={result.protein} color={colors.teal} />
            <NutrientCard label="지방" value={result.fat} color={colors.purple} />
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function NutrientCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.nutrientCard}>
      <View style={[styles.nutrientDot, { backgroundColor: color }]} />
      <Text style={styles.nutrientLabel}>{label}</Text>
      <Text style={styles.nutrientValue}>{value}</Text>
    </View>
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
    marginBottom: 12,
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
  foodName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text1,
    marginBottom: 14,
  },
  nutrientRow: {
    flexDirection: 'row',
    gap: 10,
  },
  nutrientCard: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    padding: 14,
  },
  nutrientDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    marginBottom: 10,
  },
  nutrientLabel: {
    fontSize: 12,
    color: colors.text2,
    marginBottom: 6,
  },
  nutrientValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text1,
  },
});
