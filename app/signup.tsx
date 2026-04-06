import { colors, radius } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from 'react-native';

export default function SignupScreen() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);

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
              계정을 만들고 춤 기록, 추천 클래스, 주간 목표를 한 번에 관리해보세요.
            </Text>
          </View>

          <View style={styles.card}>
            <Field
              label="이름"
              placeholder="닉네임 또는 이름"
              value={name}
              onChangeText={setName}
              icon="person-outline"
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
              placeholder="8자 이상 입력하세요"
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
              <Text style={styles.policyText}>가입하면 서비스 이용약관과 개인정보 처리방침에 동의한 것으로 봅니다.</Text>
            </View>

            <TouchableOpacity style={styles.primaryButton} activeOpacity={0.88}>
              <Text style={styles.primaryButtonText}>계정 만들기</Text>
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
  primaryButton: {
    marginTop: 4,
    minHeight: 54,
    borderRadius: radius.full,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
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
