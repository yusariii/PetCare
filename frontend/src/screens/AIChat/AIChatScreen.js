import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { getMyPetsApi } from '../../api/petApi';
import { consultAIApi } from '../../api/aiApi';

export default function AIChatScreen() {
    const [pets, setPets] = useState([]);
    const [selectedPet, setSelectedPet] = useState(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [aiResult, setAiResult] = useState(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await getMyPetsApi();
                if (res.data.success && res.data.data.length > 0) {
                    setPets(res.data.data);
                    setSelectedPet(res.data.data[0]);
                }
            } catch (e) {
                console.error(e);
            }
        })();
    }, []);

    const handleAskAI = async () => {
        if (!selectedPet) return Alert.alert('Lỗi', 'Vui lòng chọn thú cưng trước');
        if (!query.trim()) return Alert.alert('Lỗi', 'Vui lòng nhập triệu chứng');

        try {
            setLoading(true);
            setAiResult(null);
            const res = await consultAIApi(selectedPet.id, query);
            if (res.data.success) {
                setAiResult(res.data.data);
            }
        } catch (e) {
            Alert.alert('Lỗi AI', e.response?.data?.message || 'Không thể lấy phản hồi từ AI');
        } finally {
            setLoading(false);
        }
    };

    const getUrgencyBadge = (level) => {
        switch (level) {
            case 'high': return { text: '🚨 Nguy cấp - Cần đi khám ngay', color: COLORS.danger };
            case 'medium': return { text: '⚠️ Cần theo dõi sát sao', color: COLORS.warning };
            default: return { text: '✅ Mức độ an toàn / Nhẹ', color: COLORS.success };
        }
    };

    return (
        <ResponsiveContainer style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.title}>Trợ lý Thú y AI 🩺</Text>
                <Text style={styles.subtitle}>Nhận tư vấn tức thì về tình trạng sức khỏe của bé</Text>

                {/* Chọn Pet */}
                <Text style={styles.label}>Chọn thú cưng cần khám:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petPicker}>
                    {pets.map((p) => (
                        <TouchableOpacity
                            key={p.id}
                            style={[styles.petChip, selectedPet?.id === p.id && styles.petChipActive]}
                            onPress={() => setSelectedPet(p)}
                        >
                            <Text style={[styles.chipText, selectedPet?.id === p.id && styles.chipTextActive]}>
                                {p.species === 'dog' ? '🐶' : '🐱'} {p.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* Ô nhập triệu chứng */}
                <TextInput
                    style={styles.textArea}
                    placeholder="Mô tả triệu chứng (vd: Bé bỏ ăn 2 hôm nay, nôn ra dịch vàng...)"
                    multiline
                    numberOfLines={4}
                    value={query}
                    onChangeText={setQuery}
                />

                <TouchableOpacity style={styles.btnAsk} onPress={handleAskAI} disabled={loading}>
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Phân tích ngay ✨</Text>}
                </TouchableOpacity>

                {/* Kết quả AI */}
                {aiResult && (
                    <View style={styles.resultBox}>
                        <View style={[styles.badge, { backgroundColor: getUrgencyBadge(aiResult.urgency_level).color }]}>
                            <Text style={styles.badgeText}>{getUrgencyBadge(aiResult.urgency_level).text}</Text>
                        </View>
                        <Text style={styles.adviceTitle}>Lời khuyên từ bác sĩ ảo:</Text>
                        <Text style={styles.adviceBody}>{aiResult.advice}</Text>
                    </View>
                )}
            </ScrollView>
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    title: { fontSize: 24, fontWeight: 'bold', color: COLORS.primaryDark, marginTop: 8 },
    subtitle: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
    label: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
    petPicker: { flexDirection: 'row', marginBottom: 16 },
    petChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, marginRight: 8 },
    petChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    chipText: { fontSize: 14, color: COLORS.textSecondary },
    chipTextActive: { color: '#fff', fontWeight: 'bold' },
    textArea: { backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, fontSize: 15, borderWidth: 1, borderColor: COLORS.primaryLight, textAlignVertical: 'top', minHeight: 100 },
    btnAsk: { backgroundColor: COLORS.secondary, padding: 14, borderRadius: 12, alignItems: 'center', marginTop: 14 },
    btnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    resultBox: { marginTop: 20, padding: 16, backgroundColor: COLORS.surface, borderRadius: 16, borderWidth: 1, borderColor: COLORS.primaryLight, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    badge: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start', marginBottom: 10 },
    badgeText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
    adviceTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 6 },
    adviceBody: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
});