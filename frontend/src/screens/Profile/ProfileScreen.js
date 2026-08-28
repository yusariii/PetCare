import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';

export default function ProfileScreen({ onLogout }) {
    const [user, setUser] = useState(null);

    useEffect(() => {
        AsyncStorage.getItem('user').then((u) => u && setUser(JSON.parse(u)));
    }, []);

    const handleLogout = async () => {
        await AsyncStorage.clear();
        onLogout();
    };

    return (
        <ResponsiveContainer style={styles.container}>
            <View style={styles.profileBox}>
                <View style={styles.avatar}>
                    <Text style={{ fontSize: 32 }}>👤</Text>
                </View>
                <Text style={styles.name}>{user?.full_name || 'Người dùng'}</Text>
                <Text style={styles.email}>{user?.email}</Text>
            </View>

            <TouchableOpacity style={styles.btnLogout} onPress={handleLogout}>
                <Text style={styles.logoutText}>Đăng xuất</Text>
            </TouchableOpacity>
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16, justifyContent: 'space-between' },
    profileBox: { alignItems: 'center', marginTop: 30 },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    name: { fontSize: 20, fontWeight: 'bold', color: COLORS.text },
    email: { fontSize: 14, color: COLORS.textSecondary, marginTop: 4 },
    btnLogout: { backgroundColor: '#FEE2E2', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 20 },
    logoutText: { color: COLORS.danger, fontWeight: 'bold', fontSize: 16 },
});