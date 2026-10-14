import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { getMyPetsApi } from '../../api/petApi';
import { consultAIApi } from '../../api/aiApi';
import { getRoomsApi } from '../../api/roomApi';

const QUICK_PROMPTS = [
    { label: 'Nôn ra bọt vàng & bỏ ăn', text: 'Bé bỏ ăn 2 hôm nay, nôn ra dịch vàng và bọt trắng, người mệt mỏi li bì.' },
    { label: 'Gãi tai liên tục & có mùi', text: 'Bé gãi tai liên tục, lắc đầu nhiều, trong tai có mủ đen và mùi hôi khó chịu.' },
    { label: 'Tiêu chảy & mất nước', text: 'Bé bị tiêu chảy phân lỏng nhiều lần trong ngày, mắt trũng, uống ít nước.' },
    { label: 'Khó thở & ho khò khè', text: 'Bé thở gấp, khò khè khi nằm nghỉ, thỉnh thoảng ho khan như bị hóc xương.' },
];

export default function AIChatScreen({ navigation }) {
    const { isTabletOrDesktop } = useResponsive();
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
            case 'high':
                return {
                    text: '🚨 NGUY CẤP — Cần đưa bé đi khám ngay lập tức',
                    bg: '#FEE2E2',
                    textColor: '#B91C1C',
                    borderColor: '#EF4444',
                };
            case 'medium':
                return {
                    text: '⚠️ CẢNH BÁO — Cần theo dõi sát & đặt lịch sớm',
                    bg: '#FEF3C7',
                    textColor: '#B45309',
                    borderColor: '#F59E0B',
                };
            default:
                return {
                    text: '✅ MỨC ĐỘ NHẸ — Có thể tự chăm sóc & theo dõi tại nhà',
                    bg: '#D1FAE5',
                    textColor: '#047857',
                    borderColor: '#10B981',
                };
        }
    };

    const getRecommendedRoom = () => {
        if (!aiResult?.recommended_room_id) return null;
        return rooms.find(r => r.id === aiResult.recommended_room_id);
    };

    const recommendedRoom = getRecommendedRoom();
    const urgencyMeta = aiResult ? getUrgencyBadge(aiResult.urgency_level) : null;

    return (
        <ResponsiveContainer style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>Bác Sĩ Thú Y AI 🩺</Text>
                        <Text style={styles.subtitle}>
                            Tư vấn sơ bộ triệu chứng có kiểm chứng (RAG) dựa trên tài liệu y khoa từ các bác sĩ chuyên khoa
                        </Text>
                    </View>
                </View>

                {/* Main 2-Column Split Layout on Desktop */}
                <View style={[styles.mainLayout, isTabletOrDesktop && styles.mainLayoutDesktop]}>
                    
                    {/* CỘT TRÁI: CHỌN BÉ, THÔNG TIN BÉ, GỢI Ý CÂU HỎI */}
                    <View style={[styles.leftColumn, isTabletOrDesktop && styles.leftColumnDesktop]}>
                        {/* Thẻ Chọn Bé */}
                        <View style={styles.cardSection}>
                            <Text style={styles.cardSectionTitle}>🐾 Chọn bé cưng cần tư vấn</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petPicker}>
                                {pets.map((p) => {
                                    const isSelected = selectedPet?.id === p.id;
                                    return (
                                        <TouchableOpacity
                                            key={p.id}
                                            style={[styles.petChip, isSelected && styles.petChipActive]}
                                            onPress={() => setSelectedPet(p)}
                                            activeOpacity={0.7}
                                        >
                                            <Text style={styles.petChipIcon}>{p.species === 'dog' ? '🐶' : '🐱'}</Text>
                                            <Text style={[styles.petChipName, isSelected && styles.petChipNameActive]}>
                                                {p.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>

                            {/* Tóm tắt thông tin bé đã chọn */}
                            {selectedPet && (
                                <View style={styles.petSummaryBox}>
                                    <View style={styles.petSummaryRow}>
                                        <Text style={styles.summaryLabel}>Loài & Giống:</Text>
                                        <Text style={styles.summaryValue}>
                                            {selectedPet.species === 'dog' ? 'Chó' : 'Mèo'} • {selectedPet.breed || 'Chưa rõ giống'}
                                        </Text>
                                    </View>
                                    <View style={styles.petSummaryRow}>
                                        <Text style={styles.summaryLabel}>Cân nặng:</Text>
                                        <Text style={styles.summaryValue}>
                                            {selectedPet.weight_kg ? `${selectedPet.weight_kg} kg` : 'Chưa cập nhật'}
                                        </Text>
                                    </View>
                                    {selectedPet.birth_date && (
                                        <View style={styles.petSummaryRow}>
                                            <Text style={styles.summaryLabel}>Ngày sinh:</Text>
                                            <Text style={styles.summaryValue}>{selectedPet.birth_date}</Text>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>

                        {/* Thẻ Gợi Ý Triệu Chứng Phổ Biến */}
                        <View style={styles.cardSection}>
                            <Text style={styles.cardSectionTitle}>💡 Triệu chứng gợi ý nhanh</Text>
                            <Text style={styles.cardSectionSubtitle}>Nhấn để tự động điền vào khung mô tả:</Text>
                            <View style={styles.quickPromptsList}>
                                {QUICK_PROMPTS.map((item, idx) => (
                                    <TouchableOpacity
                                        key={idx}
                                        style={styles.promptChip}
                                        onPress={() => setQuery(item.text)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.promptChipText}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </View>

                    {/* CỘT PHẢI: KHUNG NHẬP MÔ TẢ & KẾT QUẢ TƯ VẤN AI */}
                    <View style={[styles.rightColumn, isTabletOrDesktop && styles.rightColumnDesktop]}>
                        {/* Khung Nhập Triệu Chứng */}
                        <View style={styles.cardSection}>
                            <Text style={styles.cardSectionTitle}>💬 Mô tả triệu chứng của bé</Text>
                            <Text style={styles.cardSectionSubtitle}>
                                Càng chi tiết về thời gian xuất hiện, phân, nước tiểu, thói quen ăn uống... AI chẩn đoán càng chính xác:
                            </Text>
                            <TextInput
                                style={styles.textArea}
                                placeholder="Ví dụ: Bé bỏ ăn từ hôm qua, nôn dịch vàng 2 lần, mệt mỏi nằm một chỗ, có uống ít nước..."
                                placeholderTextColor={COLORS.textMuted}
                                multiline
                                numberOfLines={4}
                                value={query}
                                onChangeText={setQuery}
                                editable={!loading}
                            />

                            <TouchableOpacity
                                style={[styles.btnAsk, loading && styles.btnDisabled]}
                                onPress={handleAskAI}
                                disabled={loading}
                                activeOpacity={0.8}
                            >
                                {loading ? (
                                    <View style={styles.loadingRow}>
                                        <ActivityIndicator color="#fff" />
                                        <Text style={styles.btnText}>Đang tra cứu tài liệu & chẩn đoán...</Text>
                                    </View>
                                ) : (
                                    <Text style={styles.btnText}>✨ Phân Tích Bằng Bác Sĩ AI</Text>
                                )}
                            </TouchableOpacity>
                        </View>

                        {/* KẾT QUẢ AI CHẨN ĐOÁN (BẢN ĐÁNH GIÁ Y BẠ) */}
                        {aiResult && (
                            <View style={styles.resultCard}>
                                <View style={styles.resultHeader}>
                                    <Text style={styles.resultHeaderTitle}>📋 Kết Quả Phân Tích Y Khoa</Text>
                                </View>

                                {/* Urgency Banner */}
                                {urgencyMeta && (
                                    <View style={[styles.urgencyBanner, { backgroundColor: urgencyMeta.bg, borderColor: urgencyMeta.borderColor }]}>
                                        <Text style={[styles.urgencyBannerText, { color: urgencyMeta.textColor }]}>
                                            {urgencyMeta.text}
                                        </Text>
                                    </View>
                                )}

                                {/* Lời khuyên chi tiết */}
                                <View style={styles.adviceBox}>
                                    <Text style={styles.boxTitle}>🩺 Lời Khuyên & Hướng Xử Trí:</Text>
                                    <Text style={styles.adviceText}>{aiResult.advice}</Text>
                                </View>

                                {/* Nguồn tài liệu RAG */}
                                {aiResult.sources && aiResult.sources.length > 0 ? (
                                    <View style={styles.sourceBox}>
                                        <Text style={styles.sourceTitle}>📚 Tài liệu y khoa tham khảo:</Text>
                                        {aiResult.sources.map((s) => (
                                            <View key={s.id} style={styles.sourceItemRow}>
                                                <Text style={styles.sourceBullet}>•</Text>
                                                <Text style={styles.sourceText}>
                                                    <Text style={{ fontWeight: 'bold' }}>{s.title}</Text>
                                                    {s.category ? ` (Chuyên khoa: ${s.category})` : ''}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                ) : (
                                    <View style={styles.sourceBoxWarning}>
                                        <Text style={styles.sourceWarningText}>
                                            ⚠️ Không tìm thấy tài liệu đối sánh cụ thể trong kho tri thức. Lời khuyên trên chỉ mang tính tổng quát, vui lòng đặt lịch khám trực tiếp với bác sĩ.
                                        </Text>
                                    </View>
                                )}

                                {aiResult.need_doctor && (
                                    <View style={styles.doctorAlertBox}>
                                        <Text style={styles.doctorAlertIcon}>⚠️</Text>
                                        <Text style={styles.doctorAlertText}>
                                            Khuyến cáo: Tình trạng của bé cần được bác sĩ chuyên khoa thăm khám trực tiếp.
                                        </Text>
                                    </View>
                                )}

                                {/* Gợi ý phòng khám */}
                                {recommendedRoom && (
                                    <View style={styles.roomRecommendationBox}>
                                        <Text style={styles.boxTitle}>🏥 Chuyên Khoa Đề Xuất Thăm Khám:</Text>
                                        <View style={styles.roomCardInner}>
                                            <View style={styles.roomBadge}>
                                                <Text style={styles.roomBadgeCode}>{recommendedRoom.room_code}</Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.roomName}>{recommendedRoom.room_name}</Text>
                                                <Text style={styles.roomFloor}>Vị trí: Tầng {recommendedRoom.floor}</Text>
                                                {aiResult.room_reason && (
                                                    <Text style={styles.roomReasonText}>
                                                        Lý do: {aiResult.room_reason}
                                                    </Text>
                                                )}
                                            </View>
                                        </View>

                                        <TouchableOpacity
                                            style={[styles.bookRoomBtn, bookingLoading && styles.btnDisabled]}
                                            onPress={handleBookAtRoom}
                                            disabled={bookingLoading}
                                            activeOpacity={0.8}
                                        >
                                            {bookingLoading ? (
                                                <ActivityIndicator color="#fff" />
                                            ) : (
                                                <Text style={styles.bookRoomBtnText}>
                                                    📅 Đặt Lịch Tại Phòng {recommendedRoom.room_code} Ngay
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Nút đặt lịch thường */}
                                <TouchableOpacity
                                    style={styles.manualBookBtn}
                                    onPress={() => navigation.navigate('Booking')}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.manualBookBtnText}>📅 Chuyển đến trang Đặt Lịch Tự Chọn</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 24,
    },
    header: {
        marginBottom: 20,
        marginTop: 4,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    subtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 4,
        lineHeight: 20,
    },

    // Main layout
    mainLayout: {
        flexDirection: 'column',
        gap: 16,
    },
    mainLayoutDesktop: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 24,
    },
    leftColumn: {
        flex: 1,
    },
    leftColumnDesktop: {
        flex: 1,
    },
    rightColumn: {
        flex: 1,
    },
    rightColumnDesktop: {
        flex: 1.6,
    },

    // Card section
    cardSection: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 18,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    cardSectionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    cardSectionSubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginBottom: 12,
        lineHeight: 18,
    },

    // Pet picker
    petPicker: {
        flexDirection: 'row',
        marginVertical: 8,
        flexGrow: 0,
    },
    petChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceSubtle,
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginRight: 10,
        borderWidth: 1.5,
        borderColor: COLORS.border,
        gap: 8,
    },
    petChipActive: {
        backgroundColor: COLORS.primaryLight,
        borderColor: COLORS.primary,
    },
    petChipIcon: {
        fontSize: 18,
    },
    petChipName: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    petChipNameActive: {
        color: COLORS.primaryDark,
        fontWeight: 'bold',
    },

    // Pet summary
    petSummaryBox: {
        backgroundColor: COLORS.surfaceSubtle,
        borderRadius: 12,
        padding: 12,
        marginTop: 10,
        gap: 6,
    },
    petSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    summaryLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    summaryValue: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.text,
    },

    // Quick prompts
    quickPromptsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    promptChip: {
        backgroundColor: COLORS.surfaceSubtle,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    promptChipText: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },

    // Text area & Ask button
    textArea: {
        backgroundColor: COLORS.surfaceSubtle,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        padding: 14,
        fontSize: 14,
        color: COLORS.text,
        minHeight: 110,
        textAlignVertical: 'top',
        marginBottom: 14,
        lineHeight: 22,
    },
    btnAsk: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.sm,
    },
    btnDisabled: {
        opacity: 0.6,
    },
    btnText: {
        color: '#FFFFFF',
        fontSize: 15,
        fontWeight: 'bold',
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    // AI Result Card
    resultCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.md,
    },
    resultHeader: {
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingBottom: 12,
        marginBottom: 14,
    },
    resultHeaderTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    urgencyBanner: {
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 10,
        borderWidth: 1.5,
        marginBottom: 16,
    },
    urgencyBannerText: {
        fontSize: 13,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    boxTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 8,
    },
    adviceBox: {
        backgroundColor: COLORS.surfaceSubtle,
        borderRadius: 14,
        padding: 16,
        marginBottom: 16,
    },
    adviceText: {
        fontSize: 14,
        color: COLORS.text,
        lineHeight: 22,
    },
    sourceBox: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        marginBottom: 16,
    },
    sourceTitle: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#1E40AF',
        marginBottom: 6,
    },
    sourceItemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: 4,
    },
    sourceBullet: {
        color: '#1E40AF',
        marginRight: 6,
        fontSize: 14,
    },
    sourceText: {
        fontSize: 12,
        color: '#1E3A8A',
        flex: 1,
        lineHeight: 18,
    },
    sourceBoxWarning: {
        backgroundColor: '#FFFBEB',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#FDE68A',
        marginBottom: 16,
    },
    sourceWarningText: {
        fontSize: 12,
        color: '#92400E',
        lineHeight: 18,
    },
    doctorAlertBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE2E2',
        padding: 12,
        borderRadius: 12,
        marginBottom: 16,
        gap: 8,
    },
    doctorAlertIcon: {
        fontSize: 16,
    },
    doctorAlertText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#991B1B',
        flex: 1,
    },
    roomRecommendationBox: {
        backgroundColor: '#F0FDFA',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#99F6E4',
        marginBottom: 16,
    },
    roomCardInner: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#CCFBF1',
        marginBottom: 12,
        alignItems: 'center',
        gap: 12,
    },
    roomBadge: {
        width: 50,
        height: 50,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    roomBadgeCode: {
        fontSize: 15,
        fontWeight: 'bold',
        color: COLORS.primaryDark,
    },
    roomName: {
        fontSize: 14,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    roomFloor: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    roomReasonText: {
        fontSize: 12,
        color: COLORS.primaryDark,
        marginTop: 4,
        fontStyle: 'italic',
    },
    bookRoomBtn: {
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    bookRoomBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold',
    },
    manualBookBtn: {
        backgroundColor: COLORS.surfaceSubtle,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    manualBookBtnText: {
        color: COLORS.textSecondary,
        fontSize: 13,
        fontWeight: '600',
    },
});