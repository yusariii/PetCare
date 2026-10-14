import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    RefreshControl,
    Modal,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { createPetApi, getMyPetsApi } from '../../api/petApi';

export default function HomeScreen({ navigation }) {
    const { isTabletOrDesktop, isWideScreen } = useResponsive();
    const [pets, setPets] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [showAddPet, setShowAddPet] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [petForm, setPetForm] = useState({ name: '', species: 'dog', breed: '', weight_kg: '', birth_date: '', gender: '' });

    const fetchPets = async () => {
        try {
            const res = await getMyPetsApi();
            if (res.data.success) setPets(res.data.data);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => { fetchPets(); }, []);

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchPets();
        setRefreshing(false);
    };

    const updatePetForm = (field, value) => setPetForm((current) => ({ ...current, [field]: value }));

    const resetPetForm = () => setPetForm({ name: '', species: 'dog', breed: '', weight_kg: '', birth_date: '', gender: '' });

    const handleAddPet = async () => {
        const name = petForm.name.trim();
        const weight = petForm.weight_kg.trim();
        if (!name) return Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thú cưng.');
        if (weight && (Number.isNaN(Number(weight)) || Number(weight) <= 0)) {
            return Alert.alert('Thông tin chưa hợp lệ', 'Cân nặng phải là số lớn hơn 0.');
        }
        try {
            setSubmitting(true);
            const response = await createPetApi({
                name,
                species: petForm.species,
                breed: petForm.breed.trim() || null,
                weight_kg: weight ? Number(weight) : null,
                birth_date: petForm.birth_date.trim() || null,
                gender: petForm.gender || null,
            });
            if (response.data.success) {
                setShowAddPet(false);
                resetPetForm();
                await fetchPets();
                Alert.alert('Thành công', 'Đã thêm thú cưng vào danh sách.');
            }
        } catch (error) {
            Alert.alert('Không thể thêm thú cưng', error.response?.data?.message || 'Vui lòng thử lại sau.');
        } finally {
            setSubmitting(false);
        }
    };

    const shortcuts = [
        { key: 'Booking', icon: '📅', label: 'Đặt lịch khám', description: 'Chọn chuyên khoa & giờ hẹn' },
        { key: 'AIChat', icon: '🤖', label: 'Bác sĩ AI', description: 'Tư vấn triệu chứng 24/7' },
        { key: 'Hospital', icon: '🏥', label: 'Bản đồ viện', description: 'Sơ đồ phòng khám trực quan' },
        { key: 'Appointments', icon: '📋', label: 'Lịch hẹn', description: 'Theo dõi ca khám của bé' },
        { key: 'Pharmacy', icon: '💊', label: 'Quầy thuốc', description: 'Đơn thuốc & nhận tại viện' },
        { key: 'Profile', icon: '👤', label: 'Tài khoản', description: 'Thông tin cá nhân & cài đặt' },
    ];

    const getPetAvatarBg = (species) => {
        if (species === 'dog') return '#FEF3C7';
        if (species === 'cat') return '#E0F2FE';
        return '#EDE9FE';
    };

    return (
        <ResponsiveContainer style={styles.container}>
            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
            >
                {/* Hero Welcome Banner */}
                <View style={[styles.heroBanner, isTabletOrDesktop && styles.heroBannerDesktop]}>
                    <View style={styles.heroTextContent}>
                        <View style={styles.heroBadge}>
                            <Text style={styles.heroBadgeText}>✨ Bệnh viện Thú y PetCare</Text>
                        </View>
                        <Text style={styles.heroTitle}>Chăm sóc tận tâm,{'\n'}yêu thương trọn vẹn 🐾</Text>
                        <Text style={styles.heroSubtitle}>
                            Quản lý hồ sơ sức khỏe, đặt lịch khám thông minh và nhận chẩn đoán y tế có kiểm chứng từ Bác sĩ AI.
                        </Text>
                        <View style={styles.heroActions}>
                            <TouchableOpacity
                                style={styles.heroPrimaryBtn}
                                onPress={() => navigation.navigate('Booking')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.heroPrimaryBtnText}>📅 Đặt lịch khám ngay</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.heroSecondaryBtn}
                                onPress={() => navigation.navigate('AIChat')}
                                activeOpacity={0.8}
                            >
                                <Text style={styles.heroSecondaryBtnText}>🤖 Hỏi bác sĩ AI</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    {isTabletOrDesktop && (
                        <View style={styles.heroDecoration}>
                            <View style={styles.heroBigIconBox}>
                                <Text style={styles.heroBigIcon}>🐕🐈</Text>
                            </View>
                        </View>
                    )}
                </View>

                {/* Quick Stats Bar */}
                <View style={styles.statsRow}>
                    <View style={styles.statCard}>
                        <Text style={styles.statNumber}>{pets.length}</Text>
                        <Text style={styles.statLabel}>Bé cưng của bạn</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statNumber, { color: COLORS.secondary }]}>6</Text>
                        <Text style={styles.statLabel}>Phòng chuyên khoa</Text>
                    </View>
                    <View style={styles.statCard}>
                        <Text style={[styles.statNumber, { color: COLORS.accent }]}>24/7</Text>
                        <Text style={styles.statLabel}>Trợ lý AI sẵn sàng</Text>
                    </View>
                </View>

                {/* Pets Section */}
                <View style={styles.sectionHeader}>
                    <View>
                        <Text style={styles.sectionTitle}>Bé cưng của bạn 🐾</Text>
                        <Text style={styles.sectionSubtitle}>
                            {pets.length > 0 ? `Đang quản lý hồ sơ cho ${pets.length} thú cưng` : 'Chưa có bé cưng nào trong danh bạ'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => setShowAddPet(true)}
                        activeOpacity={0.8}
                    >
                        <Text style={styles.addButtonText}>＋ Thêm bé mới</Text>
                    </TouchableOpacity>
                </View>

                {/* Pet Cards Grid */}
                {pets.length > 0 ? (
                    <View style={[styles.petsGrid, isWideScreen && styles.petsGridWide, isTabletOrDesktop && !isWideScreen && styles.petsGridTablet]}>
                        {pets.map((item) => (
                            <View
                                key={item.id.toString()}
                                style={[
                                    styles.petCard,
                                    isWideScreen && styles.petCardWide,
                                    isTabletOrDesktop && !isWideScreen && styles.petCardTablet,
                                ]}
                            >
                                <View style={styles.petCardTop}>
                                    <View style={[styles.avatar, { backgroundColor: getPetAvatarBg(item.species) }]}>
                                        <Text style={styles.avatarText}>
                                            {item.species === 'dog' ? '🐶' : item.species === 'cat' ? '🐱' : '🐾'}
                                        </Text>
                                    </View>
                                    <View style={styles.petHeaderInfo}>
                                        <Text style={styles.petName} numberOfLines={1}>{item.name}</Text>
                                        <View style={styles.badgeRow}>
                                            <View style={styles.speciesBadge}>
                                                <Text style={styles.speciesBadgeText}>
                                                    {item.species === 'dog' ? 'Chó' : item.species === 'cat' ? 'Mèo' : 'Khác'}
                                                </Text>
                                            </View>
                                            {item.gender && (
                                                <View style={[styles.genderBadge, item.gender === 'female' ? styles.genderFemale : styles.genderMale]}>
                                                    <Text style={styles.genderBadgeText}>
                                                        {item.gender === 'male' ? '♂️ Đực' : '♀️ Cái'}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                </View>

                                <View style={styles.petDetailsBox}>
                                    <View style={styles.petDetailItem}>
                                        <Text style={styles.detailLabel}>Giống:</Text>
                                        <Text style={styles.detailValue} numberOfLines={1}>{item.breed || 'Chưa cập nhật'}</Text>
                                    </View>
                                    <View style={styles.petDetailItem}>
                                        <Text style={styles.detailLabel}>Cân nặng:</Text>
                                        <Text style={styles.detailValue}>{item.weight_kg ? `${item.weight_kg} kg` : 'N/A'}</Text>
                                    </View>
                                    {item.birth_date && (
                                        <View style={styles.petDetailItem}>
                                            <Text style={styles.detailLabel}>Ngày sinh:</Text>
                                            <Text style={styles.detailValue}>{item.birth_date}</Text>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.petCardActions}>
                                    <TouchableOpacity
                                        style={styles.cardBookingBtn}
                                        onPress={() => navigation.navigate('Booking')}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.cardBookingBtnText}>📅 Đặt lịch khám</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cardAiBtn}
                                        onPress={() => navigation.navigate('AIChat')}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={styles.cardAiBtnText}>🤖 Tư vấn AI</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyIcon}>🐾</Text>
                        <Text style={styles.emptyTitle}>Chưa có bé cưng nào</Text>
                        <Text style={styles.emptySub}>Thêm bé cưng để theo dõi hồ sơ y tế, lịch tiêm phòng và đặt lịch khám tiện lợi.</Text>
                        <TouchableOpacity style={styles.emptyButton} onPress={() => setShowAddPet(true)}>
                            <Text style={styles.emptyButtonText}>＋ Thêm bé cưng đầu tiên</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Shortcuts & Services Section */}
                <View style={styles.shortcutSection}>
                    <Text style={styles.sectionTitle}>Truy cập nhanh dịch vụ viện 🏥</Text>
                    <Text style={styles.sectionSubtitle}>Các tiện ích chăm sóc và quản lý sức khỏe thú cưng</Text>
                    <View style={[styles.shortcutGrid, isTabletOrDesktop && styles.shortcutGridDesktop]}>
                        {shortcuts.map((shortcut) => (
                            <TouchableOpacity
                                key={shortcut.key}
                                style={[styles.shortcutCard, isTabletOrDesktop && styles.shortcutCardDesktop]}
                                onPress={() => navigation.navigate(shortcut.key)}
                                activeOpacity={0.8}
                            >
                                <View style={styles.shortcutIconContainer}>
                                    <Text style={styles.shortcutIcon}>{shortcut.icon}</Text>
                                </View>
                                <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
                                <Text style={styles.shortcutDescription} numberOfLines={2}>{shortcut.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>

            {/* Modal Thêm Thú Cưng */}
            <Modal visible={showAddPet} transparent animationType="fade" onRequestClose={() => setShowAddPet(false)}>
                <KeyboardAvoidingView
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                >
                    <View style={[styles.modalContent, isTabletOrDesktop && styles.modalContentDesktop]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>Thêm bé cưng mới 🐾</Text>
                                <Text style={styles.modalSubtitle}>Nhập thông tin để tạo hồ sơ sức khỏe</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.closeBtnBox}
                                onPress={() => setShowAddPet(false)}
                                disabled={submitting}
                            >
                                <Text style={styles.closeButton}>✕</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={styles.inputLabel}>Tên bé cưng <Text style={styles.required}>*</Text></Text>
                            <TextInput
                                style={styles.input}
                                value={petForm.name}
                                onChangeText={(value) => updatePetForm('name', value)}
                                placeholder="Ví dụ: Bông, Milu, Miu Miu..."
                                placeholderTextColor={COLORS.textMuted}
                                maxLength={50}
                            />

                            <Text style={styles.inputLabel}>Loài <Text style={styles.required}>*</Text></Text>
                            <View style={styles.optionRow}>
                                {[
                                    { value: 'dog', label: '🐶 Chó' },
                                    { value: 'cat', label: '🐱 Mèo' },
                                    { value: 'other', label: '🐾 Khác' },
                                ].map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[styles.option, petForm.species === option.value && styles.optionActive]}
                                        onPress={() => updatePetForm('species', option.value)}
                                    >
                                        <Text style={[styles.optionText, petForm.species === option.value && styles.optionTextActive]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.inputLabel}>Giống</Text>
                            <TextInput
                                style={styles.input}
                                value={petForm.breed}
                                onChangeText={(value) => updatePetForm('breed', value)}
                                placeholder="Ví dụ: Poodle, Corgi, Mèo Anh lông ngắn..."
                                placeholderTextColor={COLORS.textMuted}
                                maxLength={50}
                            />

                            <View style={styles.twoColumnRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.inputLabel}>Cân nặng (kg)</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={petForm.weight_kg}
                                        onChangeText={(value) => updatePetForm('weight_kg', value.replace(',', '.'))}
                                        placeholder="Ví dụ: 4.5"
                                        placeholderTextColor={COLORS.textMuted}
                                        keyboardType="decimal-pad"
                                    />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={styles.inputLabel}>Ngày sinh</Text>
                                    <TextInput
                                        style={styles.input}
                                        value={petForm.birth_date}
                                        onChangeText={(value) => updatePetForm('birth_date', value)}
                                        placeholder="YYYY-MM-DD"
                                        placeholderTextColor={COLORS.textMuted}
                                        maxLength={10}
                                    />
                                </View>
                            </View>

                            <Text style={styles.inputLabel}>Giới tính</Text>
                            <View style={styles.optionRow}>
                                {[
                                    { value: 'male', label: '♂️ Đực' },
                                    { value: 'female', label: '♀️ Cái' },
                                ].map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[styles.option, petForm.gender === option.value && styles.optionActive]}
                                        onPress={() => updatePetForm('gender', option.value)}
                                    >
                                        <Text style={[styles.optionText, petForm.gender === option.value && styles.optionTextActive]}>
                                            {option.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={styles.submitButton}
                                onPress={handleAddPet}
                                disabled={submitting}
                                activeOpacity={0.8}
                            >
                                {submitting ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Text style={styles.submitButtonText}>💾 Lưu thông tin bé</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 24,
    },

    // Hero Banner
    heroBanner: {
        backgroundColor: COLORS.surface,
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.md,
    },
    heroBannerDesktop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 32,
        backgroundColor: '#F0FDFA',
        borderColor: '#CCFBF1',
    },
    heroTextContent: {
        flex: 1,
        maxWidth: 700,
    },
    heroBadge: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
        marginBottom: 10,
    },
    heroBadgeText: {
        fontSize: 12,
        fontWeight: '700',
        color: COLORS.primaryDark,
    },
    heroTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.text,
        lineHeight: 32,
        marginBottom: 8,
    },
    heroSubtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        lineHeight: 22,
        marginBottom: 18,
    },
    heroActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    heroPrimaryBtn: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 12,
        ...SHADOWS.sm,
    },
    heroPrimaryBtnText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    heroSecondaryBtn: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.primary,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 12,
    },
    heroSecondaryBtnText: {
        color: COLORS.primaryDark,
        fontWeight: 'bold',
        fontSize: 14,
    },
    heroDecoration: {
        marginLeft: 24,
    },
    heroBigIconBox: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#CCFBF1',
        ...SHADOWS.md,
    },
    heroBigIcon: {
        fontSize: 48,
    },

    // Stats Row
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        ...SHADOWS.sm,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        fontWeight: '600',
        textAlign: 'center',
    },

    // Section Header
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    sectionSubtitle: {
        fontSize: 13,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    addButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        ...SHADOWS.sm,
    },
    addButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 13,
    },

    // Pets Grid & Cards
    petsGrid: {
        flexDirection: 'column',
        gap: 14,
        marginBottom: 28,
    },
    petsGridTablet: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    petsGridWide: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    petCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    petCardTablet: {
        width: '48.5%',
    },
    petCardWide: {
        width: '32%',
    },
    petCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    avatar: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
    },
    avatarText: {
        fontSize: 26,
    },
    petHeaderInfo: {
        flex: 1,
    },
    petName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    badgeRow: {
        flexDirection: 'row',
        gap: 6,
    },
    speciesBadge: {
        backgroundColor: COLORS.surfaceSubtle,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    speciesBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    genderBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    genderMale: {
        backgroundColor: '#E0F2FE',
    },
    genderFemale: {
        backgroundColor: '#FCE7F3',
    },
    genderBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.text,
    },
    petDetailsBox: {
        backgroundColor: COLORS.surfaceSubtle,
        borderRadius: 12,
        padding: 12,
        gap: 6,
        marginBottom: 14,
    },
    petDetailItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
    },
    detailValue: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.text,
    },
    petCardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    cardBookingBtn: {
        flex: 1,
        backgroundColor: COLORS.primaryLight,
        paddingVertical: 9,
        borderRadius: 10,
        alignItems: 'center',
    },
    cardBookingBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: COLORS.primaryDark,
    },
    cardAiBtn: {
        flex: 1,
        backgroundColor: COLORS.surfaceSubtle,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingVertical: 9,
        borderRadius: 10,
        alignItems: 'center',
    },
    cardAiBtnText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },

    // Empty state
    emptyCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 36,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 28,
        ...SHADOWS.sm,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 6,
    },
    emptySub: {
        fontSize: 13,
        color: COLORS.textSecondary,
        textAlign: 'center',
        maxWidth: 360,
        marginBottom: 18,
        lineHeight: 20,
    },
    emptyButton: {
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 14,
    },

    // Shortcut section
    shortcutSection: {
        paddingBottom: 28,
    },
    shortcutGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 14,
    },
    shortcutGridDesktop: {
        gap: 16,
    },
    shortcutCard: {
        width: '48%',
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    shortcutCardDesktop: {
        width: '31.8%',
    },
    shortcutIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceSubtle,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    shortcutIcon: {
        fontSize: 22,
    },
    shortcutLabel: {
        fontSize: 15,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 4,
    },
    shortcutDescription: {
        fontSize: 12,
        color: COLORS.textSecondary,
        lineHeight: 16,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderRadius: 24,
        padding: 24,
        width: '100%',
        maxWidth: 540,
        maxHeight: '90%',
        ...SHADOWS.lg,
    },
    modalContentDesktop: {
        maxWidth: 560,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 18,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingBottom: 12,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    modalSubtitle: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    closeBtnBox: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.surfaceSubtle,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButton: {
        fontSize: 14,
        color: COLORS.textSecondary,
        fontWeight: 'bold',
    },
    inputLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.text,
        marginTop: 12,
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
        color: COLORS.text,
        fontSize: 14,
    },
    optionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    twoColumnRow: {
        flexDirection: 'row',
    },
    option: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 12,
        paddingVertical: 12,
        backgroundColor: COLORS.surfaceSubtle,
    },
    optionActive: {
        backgroundColor: COLORS.primaryLight,
        borderColor: COLORS.primary,
    },
    optionText: {
        fontSize: 13,
        color: COLORS.textSecondary,
        fontWeight: '600',
    },
    optionTextActive: {
        color: COLORS.primaryDark,
        fontWeight: 'bold',
    },
    submitButton: {
        backgroundColor: COLORS.primary,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 24,
        marginBottom: 8,
        ...SHADOWS.sm,
    },
    submitButtonText: {
        color: '#FFFFFF',
        fontWeight: 'bold',
        fontSize: 15,
    },
});