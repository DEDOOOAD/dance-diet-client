import { colors, radius } from '@/constants/theme';
import { signInWithGeneralServer } from '@/services/general-server-auth';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function toErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return '로그인 중 알 수 없는 오류가 발생했어요.';
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setErrorMessage('이메일과 비밀번호를 모두 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await signInWithGeneralServer({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      router.replace('/(tabs)');
    } catch (error) {
      setErrorMessage(toErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <View style={styles.badge}>
              <Ionicons name="sparkles" size={16} color={colors.accent} />
              <Text style={styles.badgeText}>Welcome Back</Text>
            </View>
            <Text style={styles.title}>로그인</Text>
            <Text style={styles.subtitle}>등록된 계정으로 로그인하고 오늘의 루틴을 바로 시작해보세요.</Text>
          </View>

          <View style={styles.card}>
            <Field
              label="이메일"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              icon="mail-outline"
            />
            <Field
              label="비밀번호"
              placeholder="비밀번호를 입력해 주세요"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={secure}
              icon="lock-closed-outline"
              rightElement={
                <TouchableOpacity onPress={() => setSecure((prev) => !prev)} activeOpacity={0.85}>
                  <Ionicons
                    name={secure ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.text3}
                  />
                </TouchableOpacity>
              }
            />

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              activeOpacity={0.88}
              disabled={isSubmitting}
              onPress={() => {
                void handleLogin();
              }}>
              <Text style={styles.primaryButtonText}>{isSubmitting ? '로그인 확인 중...' : '로그인하기'}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.ghostButton} activeOpacity={0.88}>
              <Ionicons name="logo-google" size={16} color={colors.text1} />
              <Text style={styles.ghostButtonText}>Google로 계속하기</Text>
            </TouchableOpacity>

            <View style={styles.inlineRow}>
              <Text style={styles.inlineText}>아직 계정이 없나요?</Text>
              <Link href="/signup" style={styles.inlineLink}>
                회원가입
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  icon,
  rightElement,
  ...props
}: React.ComponentProps<typeof TextInput> & {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  rightElement?: React.ReactNode;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Ionicons name={icon} size={18} color={colors.text3} />
        <TextInput
          {...props}
          placeholderTextColor={colors.text3}
          style={styles.input}
          autoCapitalize="none"
        />
        {rightElement}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 42,
    paddingBottom: 36,
  },
  hero: {
    marginBottom: 22,
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.full,
    backgroundColor: colors.accent + '16',
    borderWidth: 1,
    borderColor: colors.accent + '35',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accent,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.text1,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text2,
  },
  card: {
    padding: 20,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    color: colors.text2,
    fontWeight: '600',
  },
  inputShell: {
    minHeight: 54,
    borderRadius: radius.lg,
    backgroundColor: colors.surface2,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  input: {
    flex: 1,
    color: colors.text1,
    fontSize: 15,
    paddingVertical: 14,
  },
  errorBox: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    backgroundColor: colors.accent + '14',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  errorText: {
    color: colors.text1,
    fontSize: 13,
    lineHeight: 18,
  },
  primaryButton: {
    marginTop: 4,
    minHeight: 54,
    borderRadius: radius.full,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  ghostButton: {
    minHeight: 52,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ghostButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text1,
  },
  inlineRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  inlineText: {
    color: colors.text2,
    fontSize: 13,
  },
  inlineLink: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
});
