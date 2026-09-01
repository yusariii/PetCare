import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { COLORS } from '../../constants/theme';
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
          <Text style={styles.title}>Tạo Tài Khoản 🐾</Text>
          <Text style={styles.subtitle}>Bắt đầu chăm sóc và theo dõi sức khỏe thú cưng</Text>

          {statusMessage ? (
            <View style={[styles.statusBox, statusType === 'success' ? styles.statusSuccess : styles.statusError]}>
              <Text style={styles.statusText}>{statusMessage}</Text>
            </View>
          ) : null}

          <TextInput
            placeholder="Họ và tên của bạn"
            value={fullName}
            onChangeText={setFullName}
            style={styles.input}
          />

          <TextInput
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <TextInput
            placeholder="Số điện thoại (tùy chọn)"
            value={phone}
            onChangeText={setPhone}
            style={styles.input}
            keyboardType="phone-pad"
          />

          <TextInput
            placeholder="Mật khẩu"
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            secureTextEntry
          />

          <TextInput
            placeholder="Xác nhận mật khẩu"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            style={styles.input}
            secureTextEntry
          />

          <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Đăng Ký</Text>}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Đã có tài khoản? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.linkText}>Đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', padding: 20 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 20,
    elevation: 3,
    shadowColor: COLORS.primary,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    marginVertical: 20,
  },
  title: { fontSize: 26, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center' },
  subtitle: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 20, marginTop: 4 },
  statusBox: {
    borderRadius: 10,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
  },
  statusSuccess: {
    backgroundColor: '#E8F8EE',
    borderColor: '#2E9E5A',
  },
  statusError: {
    backgroundColor: '#FDECEC',
    borderColor: '#D94A4A',
  },
  statusText: {
    color: '#1E1E1E',
    fontSize: 13,
    textAlign: 'center',
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    borderRadius: 12,
    padding: 13,
    marginBottom: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: COLORS.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 18 },
  footerText: { color: COLORS.textSecondary, fontSize: 14 },
  linkText: { color: COLORS.primary, fontWeight: 'bold', fontSize: 14 },
});