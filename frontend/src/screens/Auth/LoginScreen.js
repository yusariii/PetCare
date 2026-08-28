import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { loginApi } from '../../api/authApi';

export default function LoginScreen({ navigation, onLoginSuccess }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) return Alert.alert('Thông báo', 'Vui lòng nhập đầy đủ thông tin');
        try {
            setLoading(true);
            const res = await loginApi(email, password);
            if (res.data.success) {
                await AsyncStorage.setItem('token', res.data.token);
                await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
                onLoginSuccess();
            }
        } catch (err) {
            Alert.alert('Lỗi', err.response?.data?.message || 'Đăng nhập thất bại');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ResponsiveContainer style={styles.container}>
            <View style={styles.card}>
                <Text style={styles.title}>🐾 PetCare AI</Text>
                <Text style={styles.subtitle}>Chăm sóc thú cưng thông minh & dễ dàng</Text>

                <TextInput
                    placeholder="Email của bạn"
                    value={email}
                    onChangeText={setEmail}
                    style={styles.input}
                    autoCapitalize="none"
                    keyboardType="email-address"
                />
                <TextInput
                    placeholder="Mật khẩu"
                    value={password}
                    onChangeText={setPassword}
                    style={styles.input}
                    secureTextEntry
                />

                <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Đăng Nhập</Text>}
                </TouchableOpacity>
            </View>
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: { justifyContent: 'center', padding: 20 },
    card: { backgroundColor: COLORS.surface, padding: 24, borderRadius: 20, elevation: 3, shadowColor: COLORS.primary, shadowOpacity: 0.1, shadowRadius: 10 },
    title: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary, textAlign: 'center' },
    subtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 24, marginTop: 4 },
    input: { backgroundColor: COLORS.background, borderWidth: 1, borderColor: COLORS.primaryLight, borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 16 },
    button: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 8 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});