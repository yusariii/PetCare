import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { getMyPetsApi } from '../../api/petApi';
import { consultAIApi } from '../../api/aiApi';
import { getRoomsApi } from '../../api/roomApi';

export default function AIChatScreen({ navigation }) {
    const [pets, setPets] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [selectedPet, setSelectedPet] = useState(null);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [aiResult, setAiResult] = useState(null);
    const [bookingLoading, setBookingLoading] = useState(false);

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        try {
            const [petsRes, roomsRes] = await Promise.all([
                getMyPetsApi(),
                getRoomsApi()
            ]);

            if (petsRes.data.success && petsRes.data.data.length > 0) {
                setPets(petsRes.data.data);
                setSelectedPet(petsRes.data.data[0]);
            }

            if (roomsRes.data.success) {
                setRooms(roomsRes.data.data || []);
            }
        } catch (e) {
            console.error('LOAD_INITIAL_DATA_ERROR:', e);
        }
    };

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

    const handleBookAtRoom = () => {
        if (!aiResult?.recommended_room_id) {
            Alert.alert('Lỗi', 'AI chưa gợi ý phòng khám');
            return;
        }

        setBookingLoading(true);
        try {
            navigation.navigate('Booking', {
                selectedRoomId: aiResult.recommended_room_id
            });
        } catch (e) {
            Alert.alert('Lỗi', 'Không thể chuyển đến Đặt Lịch');
        } finally {
            setBookingLoading(false);
        }
    };

    const getUrgencyBadge = (level) => {
        switch (level) {
            case 'high': return { text: '🚨 Nguy cấp - Cần đi khám ngay', color: COLORS.danger };
            case 'medium': return { text: '⚠️ Cần theo dõi sát sao', color: COLORS.warning };
            default: return { text: '✅ Mức độ an toàn / Nhẹ', color: COLORS.success };
        }
    };

    const getRecommendedRoom = () => {
        if (!aiResult?.recommended_room_id) return null;
        return rooms.find(r => r.id === aiResult.recommended_room_id);
    };

    const recommendedRoom = getRecommendedRoom();

    return (
        <ResponsiveContainer style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Text style={styles.title}>🩺 Trợ Lý Thú Y AI</Text>
                    <Text style={styles.subtitle}>Nhận tư vấn tức thì về tình trạng sức khỏe của bé</Text>
                </View>

                {/* Chọn Pet */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>🐾 Chọn thú cưng:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petPicker}>
                        {pets.map((p) => (
                            <TouchableOpacity
                                key={p.id}
                                style={[styles.petChip, selectedPet?.id === p.id && styles.petChipActive]}
                                onPress={() => setSelectedPet(p)}
                            >
                                <Text style={[styles.chipText, selectedPet?.id === p.id && styles.chipTextActive]}>
                                    {p.species === 'dog' ? '🐶' : p.species === 'cat' ? '🐱' : '🐾'} {p.name}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Ô nhập triệu chứng */}
                <View style={styles.section}>
                    <Text style={styles.sectionLabel}>💬 Mô tả triệu chứng:</Text>
                    <TextInput
                        style={styles.textArea}
                        placeholder="Vd: Bé bỏ ăn 2 hôm nay, nôn ra dịch vàng, uống nhiều nước..."
                        multiline
                        numberOfLines={4}
                        value={query}
                        onChangeText={setQuery}
                        editable={!loading}
                    />
                </View>

                <TouchableOpacity 
                    style={[styles.btnAsk, loading && styles.btnDisabled]} 
                    onPress={handleAskAI} 
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.btnText}>Phân Tích Ngay ✨</Text>
                    )}
                </TouchableOpacity>

                {/* Kết quả AI */}
                {aiResult && (
                    <View style={styles.resultBox}>
                        <View style={[styles.badge, { backgroundColor: getUrgencyBadge(aiResult.urgency_level).color }]}>
                            <Text style={styles.badgeText}>{getUrgencyBadge(aiResult.urgency_level).text}</Text>
                        </View>

                        <View style={styles.resultSection}>
                            <Text style={styles.resultTitle}>💊 Lời Khuyên:</Text>
                            <Text style={styles.resultText}>{aiResult.advice}</Text>
                        </View>

                        {/* Tài liệu tham khảo dùng để chẩn đoán (RAG) */}
                        {aiResult.sources && aiResult.sources.length > 0 ? (
                            <View style={styles.sourceBox}>
                                <Text style={styles.sourceTitle}>📚 Dựa trên tài liệu bác sĩ cung cấp:</Text>
                                {aiResult.sources.map((s) => (
                                    <Text key={s.id} style={styles.sourceItem}>
                                        • {s.title}{s.category ? ` (${s.category})` : ''}
                                    </Text>
                                ))}
                            </View>
                        ) : (
                            <View style={styles.sourceBoxWarning}>
                                <Text style={styles.sourceWarningText}>
                                    ⚠️ Chưa có tài liệu tham khảo phù hợp trong cơ sở tri thức. Lời khuyên chỉ mang tính tổng quát, vui lòng đặt lịch khám trực tiếp để được chẩn đoán chính xác.
                                </Text>
                            </View>
                        )}

                        {aiResult.need_doctor && (
                            <View style={styles.doctorAlert}>
                                <Text style={styles.doctorAlertIcon}>⚠️</Text>
                                <Text style={styles.doctorAlertText}>AI khuyên nên khám với bác sĩ</Text>
                            </View>
                        )}

                        {/* Gợi Ý Phòng Khám */}
                        {recommendedRoom && (
                            <View style={styles.roomRecommendation}>
                                <Text style={styles.roomLabel}>🏥 Phòng Được Đề Xuất:</Text>
                                <View style={styles.roomCard}>
                                    <View style={styles.roomInfo}>
                                        <Text style={styles.roomCode}>{recommendedRoom.room_code}</Text>
                                        <Text style={styles.roomName}>{recommendedRoom.room_name}</Text>
                                        <Text style={styles.roomFloor}>Tầng {recommendedRoom.floor}</Text>
                                    </View>
                                    {aiResult.room_reason && (
                                        <View style={styles.roomReason}>
                                            <Text style={styles.roomReasonLabel}>Lý do:</Text>
                                            <Text style={styles.roomReasonText}>{aiResult.room_reason}</Text>
                                        </View>
                                    )}
                                </View>

                                <TouchableOpacity 
                                    style={[styles.bookButton, bookingLoading && styles.btnDisabled]}
                                    onPress={handleBookAtRoom}
                                    disabled={bookingLoading}
                                >
                                    {bookingLoading ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.bookButtonText}>📍 Đặt Lịch Tại Phòng Này</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Nút Đặt Lịch Thường */}
                        <TouchableOpacity 
                            style={styles.manualBookButton}
                            onPress={() => navigation.navigate('Booking')}
                        >
                            <Text style={styles.manualBookButtonText}>📅 Đặt Lịch Ở Tab Khác</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={{ height: 20 }} />
            </ScrollView>
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        paddingBottom: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
    },
    section: {
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.text,
        marginBottom: 8,
    },
    petPicker: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    petChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        marginRight: 8,
    },
    petChipActive: {
        backgroundColor: COLORS.primary,
        borderColor: COLORS.primary,
    },
    chipText: {
        fontSize: 14,
        color: COLORS.textSecondary,
    },
    chipTextActive: {
        color: '#fff',
        fontWeight: 'bold',
    },
    textArea: {
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 14,
        fontSize: 13,
        borderWidth: 1,
        borderColor: COLORS.border,
        textAlignVertical: 'top',
        minHeight: 100,
        color: COLORS.text,
    },
    btnAsk: {
        backgroundColor: COLORS.secondary,
        paddingVertical: 14,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 16,
    },
    btnDisabled: {
        opacity: 0.6,
    },
    btnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    resultBox: {
        marginTop: 16,
        padding: 16,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        elevation: 2,
    },
    badge: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        alignSelf: 'flex-start',
        marginBottom: 12,
    },
    badgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
    },
    resultSection: {
        marginBottom: 12,
    },
    resultTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 6,
    },
    resultText: {
        fontSize: 13,
        color: COLORS.text,
        lineHeight: 20,
    },
    sourceBox: {
        backgroundColor: COLORS.primaryLight,
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
    },
    sourceTitle: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.primaryDark,
        marginBottom: 4,
    },
    sourceItem: {
        fontSize: 12,
        color: COLORS.primaryDark,
        marginTop: 2,
    },
    sourceBoxWarning: {
        backgroundColor: '#fff3cd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.warning,
    },
    sourceWarningText: {
        fontSize: 12,
        color: COLORS.text,
        lineHeight: 18,
    },
    doctorAlert: {
        flexDirection: 'row',
        backgroundColor: '#fff3cd',
        borderRadius: 8,
        padding: 12,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderLeftColor: COLORS.warning,
    },
    doctorAlertIcon: {
        fontSize: 18,
        marginRight: 10,
    },
    doctorAlertText: {
        flex: 1,
        fontSize: 13,
        fontWeight: '500',
        color: '#856404',
    },
    roomRecommendation: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
    },
    roomLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: COLORS.primary,
        marginBottom: 10,
    },
    roomCard: {
        backgroundColor: '#f0f8ff',
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: COLORS.primaryLight,
    },
    roomInfo: {
        marginBottom: 10,
    },
    roomCode: {
        fontSize: 16,
        fontWeight: 'bold',
        color: COLORS.primary,
    },
    roomName: {
        fontSize: 13,
        color: COLORS.text,
        marginTop: 4,
    },
    roomFloor: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    roomReason: {
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 10,
        borderLeftWidth: 3,
        borderLeftColor: COLORS.secondary,
    },
    roomReasonLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: COLORS.secondary,
        marginBottom: 4,
    },
    roomReasonText: {
        fontSize: 12,
        color: COLORS.text,
        lineHeight: 18,
    },
    bookButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        marginBottom: 10,
    },
    bookButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    manualBookButton: {
        backgroundColor: COLORS.textSecondary,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    manualBookButtonText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '500',
    },
});