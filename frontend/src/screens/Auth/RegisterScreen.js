import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { registerApi } from '../../api/authApi';

export default function RegisterScreen({ navigation }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState('');

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      return Alert.alert('Thông báo', 'Họ tên, email và mật khẩu là bắt buộc');
    }

    if (password !== confirmPassword) {
      return Alert.alert('Thông báo', 'Mật khẩu xác nhận không khớp');
    }

    try {
      setLoading(true);
      const res = await registerApi({
        full_name: fullName,
        email: email.trim(),
        phone: phone.trim() || null,
        password: password,
      });

      if (res?.data?.success) {
        const successText = res?.data?.message || 'Đăng ký tài khoản thành công! Vui lòng đăng nhập.';
        setStatusType('success');
        setStatusMessage(successText);

        Alert.alert('Thành công', successText, [
          {
            text: 'Đăng nhập ngay',
            onPress: () => setTimeout(() => navigation.navigate('Login'), 300),
          }
        ]);
        return;
      }

      const errorText = res?.data?.message || 'Đăng ký không thành công, vui lòng thử lại';
      setStatusType('error');
      setStatusMessage(errorText);
      Alert.alert('Thông báo', errorText);
    } catch (err) {
      const errorText = err.response?.data?.message || 'Có lỗi xảy ra, vui lòng thử lại';
      setStatusType('error');
      setStatusMessage(errorText);
      Alert.alert('Lỗi đăng ký', errorText);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.brandBadge}>
            <Text style={styles.brandIcon}>🐾</Text>
          </View>
          <Text style={styles.title}>Tạo Tài Khoản Mới</Text>
          <Text style={styles.subtitle}>Bắt đầu chăm sóc và theo dõi sức khỏe thú cưng cùng PetCare</Text>

          {statusMessage ? (
            <View style={[styles.statusBox, statusType === 'success' ? styles.statusSuccess : styles.statusError]}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          ) : null}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Họ và tên của bạn <Text style={styles.required}>*</Text></Text>
            <TextInput
              placeholder="Nguyễn Văn A"
              placeholderTextColor={COLORS.textMuted}
              value={fullName}
              onChangeText={setFullName}
              style={styles.input}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Email <Text style={styles.required}>*</Text></Text>
            <TextInput
              placeholder="name@example.com"
              placeholderTextColor={COLORS.textMuted}
              value={email}
              onChangeText={setEmail}
              style={styles.input}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Số điện thoại</Text>
            <TextInput
              placeholder="0912 345 678"
              placeholderTextColor={COLORS.textMuted}
              value={phone}
              onChangeText={setPhone}
              style={styles.input}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Mật khẩu <Text style={styles.required}>*</Text></Text>
            <TextInput
              placeholder="Tối thiểu 6 ký tự"
              placeholderTextColor={COLORS.textMuted}
              value={password}
              onChangeText={setPassword}
              style={styles.input}
              secureTextEntry
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Xác nhận mật khẩu <Text style={styles.required}>*</Text></Text>
            <TextInput
              placeholder="Nhập lại mật khẩu"
              placeholderTextColor={COLORS.textMuted}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              style={styles.input}
              secureTextEntry
            />
          </View>

          <TouchableOpacity
            style={[styles.button, loading && styles.btnDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Đăng Ký Tài Khoản</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
              <Text style={styles.linkText}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    padding: 16,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: 32,
    borderRadius: 24,
    width: '100%',
    maxWidth: 480,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    ...SHADOWS.lg,
  },
  brandBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  brandIcon: {
    fontSize: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
    marginTop: 6,
    lineHeight: 18,
  },
  statusBox: {
    width: '100%',
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  statusSuccess: {
    backgroundColor: '#D1FAE5',
  },
  statusError: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  formGroup: {
    width: '100%',
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 6,
  },
  required: {
    color: COLORS.danger,
  },
  input: {
    backgroundColor: COLORS.surfaceSubtle,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  button: {
    width: '100%',
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    ...SHADOWS.sm,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  linkText: {
    color: COLORS.primaryDark,
    fontWeight: 'bold',
    fontSize: 13,
  },
});