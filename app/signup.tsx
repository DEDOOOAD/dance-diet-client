import { colors, radius } from '@/constants/theme';
import { signUpWithGeneralServer } from '@/services/general-server-auth';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
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

  return '회원가입 중 알 수 없는 오류가 발생했어요.';
}

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSignup = async () => {
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    const ageValue = Number.parseInt(age.trim(), 10);

    if (!trimmedName || !trimmedEmail || !trimmedPassword || !age.trim()) {
      setSuccessMessage(null);
      setErrorMessage('이름, 나이, 이메일, 비밀번호를 모두 입력해 주세요.');
      return;
    }

    if (!Number.isFinite(ageValue) || ageValue <= 0) {
      setSuccessMessage(null);
      setErrorMessage('나이는 1 이상의 숫자로 입력해 주세요.');
      return;
    }

    if (trimmedPassword.length < 8) {
      setSuccessMessage(null);
      setErrorMessage('비밀번호는 8자 이상으로 입력해 주세요.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const result = await signUpWithGeneralServer({
        name: trimmedName,
        age: ageValue,
        email: trimmedEmail,
        password: trimmedPassword,
      });

      setSuccessMessage(`회원가입이 완료됐어요. 서버 사용자 ID: ${result.userId}`);
      setName('');
      setAge('');
      setEmail('');
      setPassword('');
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
              <Ionicons name="person-add-outline" size={16} color={colors.teal} />
              <Text style={styles.badgeText}>Start Your Routine</Text>
            </View>
            <Text style={styles.title}>회원가입</Text>
            <Text style={styles.subtitle}>
              계정을 만들고 춤 기록과 추천 루틴을 한 번에 관리해 보세요.
            </Text>
          </View>

          <View style={styles.card}>
            <Field
              label="이름"
              placeholder="사용할 이름"
              value={name}
              onChangeText={setName}
              icon="person-outline"
            />
            <Field
              label="나이"
              placeholder="예: 24"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              icon="calendar-outline"
            />
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
              placeholder="8자 이상 입력해 주세요"
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

            <View style={styles.policyBox}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.teal} />
              <Text style={styles.policyText}>
                가입 버튼을 누르면 서버에 회원 정보를 저장하고 가입 성공 여부를 바로 확인해요.
              </Text>
            </View>

            {errorMessage ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.successBox}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, isSubmitting && styles.primaryButtonDisabled]}
              activeOpacity={0.88}
              disabled={isSubmitting}
              onPress={() => {
                void handleSignup();
              }}>
              <Text style={styles.primaryButtonText}>
                {isSubmitting ? '회원가입 요청 중...' : '계정 만들기'}
              </Text>
            </TouchableOpacity>

            <View style={styles.inlineRow}>
              <Text style={styles.inlineText}>이미 계정이 있나요?</Text>
              <Link href="/login" style={styles.inlineLink}>
                로그인
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
    backgroundColor: colors.teal + '14',
    borderWidth: 1,
    borderColor: colors.teal + '30',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.teal,
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
  policyBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.teal + '12',
    borderWidth: 1,
    borderColor: colors.teal + '28',
  },
  policyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: colors.text2,
  },
  errorBox: {
    borderRadius: radius.lg,
    padding: 14,
    backgroundColor: '#FDECEC',
    borderWidth: 1,
    borderColor: '#F4B8B8',
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#9F2D2D',
  },
  successBox: {
    borderRadius: radius.lg,
    padding: 14,
    backgroundColor: colors.teal + '14',
    borderWidth: 1,
    borderColor: colors.teal + '35',
  },
  successText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text1,
  },
  primaryButton: {
    marginTop: 4,
    minHeight: 54,
    borderRadius: radius.full,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#05120F',
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
    color: colors.teal,
    fontSize: 13,
    fontWeight: '700',
  },
});
