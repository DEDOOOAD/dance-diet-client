import { colors, radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

type AnalyzeState = 'idle' | 'captured' | 'checking' | 'done';

const TEXT = {
  title: '\uC2DD\uB2E8 \uCD2C\uC601',
  subtitle:
    '\uCE74\uBA54\uB77C\uB85C \uBC14\uB85C \uCC0D\uAC70\uB098 \uAC24\uB7EC\uB9AC\uC5D0\uC11C \uACE0\uB978 \uB4A4 \uCE7C\uB85C\uB9AC\uB97C \uD3B8\uD558\uAC8C \uD655\uC778\uD574\uBCF4\uC138\uC694.',
  permissionTitle: '\uAD8C\uD55C\uC774 \uD544\uC694\uD574\uC694',
  galleryPermissionBody:
    '\uAC24\uB7EC\uB9AC\uC5D0\uC11C \uC0AC\uC9C4\uC744 \uACE0\uB974\uB824\uBA74 \uC0AC\uC9C4 \uC811\uADFC \uAD8C\uD55C\uC744 \uD5C8\uC6A9\uD574 \uC8FC\uC138\uC694.',
  cameraPermissionBody:
    '\uCE74\uBA54\uB77C\uB85C \uCD2C\uC601\uD558\uB824\uBA74 \uCE74\uBA54\uB77C \uAD8C\uD55C\uC744 \uD5C8\uC6A9\uD574 \uC8FC\uC138\uC694.',
  imageSourceTitle: '\uC0AC\uC9C4 \uAC00\uC838\uC624\uAE30',
  imageSourceBody:
    '\uC5B4\uB5A4 \uBC29\uBC95\uC73C\uB85C \uC74C\uC2DD \uC0AC\uC9C4\uC744 \uC900\uBE44\uD560\uAE4C\uC694?',
  cameraAction: '\uCE74\uBA54\uB77C\uB85C \uCD2C\uC601',
  galleryAction: '\uAC24\uB7EC\uB9AC\uC5D0\uC11C \uC120\uD0DD',
  cancelAction: '\uCDE8\uC18C',
  readyBadge: '\uC0AC\uC9C4 \uC900\uBE44 \uC644\uB8CC',
  emptyTitle: '\uC74C\uC2DD \uC0AC\uC9C4\uC744 \uC900\uBE44\uD574 \uC8FC\uC138\uC694',
  emptyBody:
    '\uCE74\uBA54\uB77C\uB85C \uBC14\uB85C \uCD2C\uC601\uD558\uAC70\uB098 \uAC24\uB7EC\uB9AC\uC5D0\uC11C \uC0AC\uC9C4\uC744 \uACE8\uB77C \uCE7C\uB85C\uB9AC\uB97C \uD655\uC778\uD560 \uC218 \uC788\uC5B4\uC694.',
  changePhoto: '\uC0AC\uC9C4 \uBCC0\uACBD',
  reset: '\uCD08\uAE30\uD654',
  checking: '\uCE7C\uB85C\uB9AC \uD655\uC778 \uC911...',
  analyze: '\uCE7C\uB85C\uB9AC \uD655\uC778\uD558\uAE30',
  resultTitle: '\uBD84\uC11D \uACB0\uACFC',
  foodName: '\uB2ED\uAC00\uC2B4\uC0B4 \uC0D0\uB7EC\uB4DC',
};

export default function FoodScreen() {
  const [state, setState] = useState<AnalyzeState>('idle');
  const [imageUri, setImageUri] = useState<string | null>(null);

  const result = {
    name: TEXT.foodName,
    calories: 428,
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

    setImageUri(pickerResult.assets[0].uri);
    setState('captured');
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

    setImageUri(cameraResult.assets[0].uri);
    setState('captured');
  };

  const chooseImageSource = () => {
    Alert.alert(TEXT.imageSourceTitle, TEXT.imageSourceBody, [
      { text: TEXT.cameraAction, onPress: captureWithCamera },
      { text: TEXT.galleryAction, onPress: pickFromGallery },
      { text: TEXT.cancelAction, style: 'cancel' },
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
          <Text style={styles.title}>{TEXT.title}</Text>
          <Text style={styles.subtitle}>{TEXT.subtitle}</Text>
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
        <TouchableOpacity style={styles.secondaryAction} onPress={imageUri ? chooseImageSource : reset} activeOpacity={0.85}>
          <Ionicons name={imageUri ? 'camera-reverse-outline' : 'refresh-outline'} size={18} color={colors.text1} />
          <Text style={styles.secondaryActionText}>{imageUri ? TEXT.changePhoto : TEXT.reset}</Text>
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

      {state === 'done' && (
        <View style={styles.resultCard}>
          <View style={styles.resultHeader}>
            <Text style={styles.resultTitle}>{TEXT.resultTitle}</Text>
            <View style={styles.kcalBadge}>
              <Ionicons name="flame" size={14} color="#fff" />
              <Text style={styles.kcalBadgeText}>{result.calories} kcal</Text>
            </View>
          </View>

          <Text style={styles.foodName}>{result.name}</Text>
        </View>
      )}
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
  },
});
