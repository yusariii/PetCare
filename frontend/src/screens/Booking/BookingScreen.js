import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';

export default function BookingScreen() {
    const [selectedService, setSelectedService] = useState(1);

    const services = [
        { id: 1, name: 'Tắm & Vệ sinh tai móng', price: '150.000đ', duration: '45 phút' },
        { id: 2, name: 'Cắt tỉa lông tạo kiểu', price: '250.000đ', duration: '60 phút' },
        { id: 3, name: 'Tiêm phòng vắc xin 7 bệnh', price: '300.000đ', duration: '20 phút' },
    ];

    return (
        <ResponsiveContainer style={styles.container}>
            <Text style={styles.title}>Đặt lịch Dịch vụ 📅</Text>
            <Text style={styles.subtitle}>Chọn gói chăm sóc sức khỏe & sắc đẹp cho bé</Text>

            {services.map((s) => (
                <TouchableOpacity
                    key={s.id}
                    style={[styles.card, selectedService === s.id && styles.cardActive]}
                    onPress={() => setSelectedService(s.id)}
                >
                    <View>
                        <Text style={styles.name}>{s.name}</Text>
                        <Text style={styles.duration}>⏱ {s.duration}</Text>
                    </View>
                    <Text style={styles.price}>{s.price}</Text>
                </TouchableOpacity>
            ))}

            <TouchableOpacity
                style={styles.btnBook}
                onPress={() => Alert.alert('Thành công', 'Đã ghi nhận yêu cầu đặt lịch của bạn!')}
            >
                <Text style={styles.btnText}>Tiếp tục chọn giờ hẹn</Text>
            </TouchableOpacity>
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    title: { fontSize: 24, fontWeight: 'bold', color: COLORS.primaryDark, marginTop: 8 },
    subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
    card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: COLORS.surface, padding: 16, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
    cardActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
    name: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
    duration: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
    price: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
    btnBook: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 16 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});