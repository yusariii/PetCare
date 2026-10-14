import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
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
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';
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
        { key: 'Booking', icon: 'calendar-outline', type: 'ion', label: 'Đặt lịch khám', description: 'Chọn chuyên khoa & giờ hẹn' },
        { key: 'AIChat', icon: 'robot', type: 'mci', label: 'Bác sĩ AI', description: 'Tư vấn triệu chứng 24/7' },
        { key: 'Hospital', icon: 'hospital', type: 'fa5', label: 'Bản đồ viện', description: 'Sơ đồ phòng khám trực quan' },
        { key: 'Appointments', icon: 'clipboard-outline', type: 'ion', label: 'Lịch hẹn', description: 'Theo dõi ca khám của bé' },
        { key: 'Pharmacy', icon: 'pill', type: 'mci', label: 'Quầy thuốc', description: 'Đơn thuốc & nhận tại viện' },
        { key: 'Profile', icon: 'person-outline', type: 'ion', label: 'Tài khoản', description: 'Thông tin cá nhân & cài đặt' },
    ];

    const getPetAvatarBg = (species) => {
        if (species === 'dog') return '#FEF3C7';
        if (species === 'cat') return '#E0F2FE';
        return '#EDE9FE';
    };

    const renderPetAvatarIcon = (species) => {
        if (species === 'dog') return <FontAwesome5 name="dog" size={22} color="#B45309" />;
        if (species === 'cat') return <FontAwesome5 name="cat" size={22} color="#0369A1" />;
        return <FontAwesome5 name="paw" size={20} color="#6D28D9" />;
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
                            <Ionicons name="sparkles" size={13} color={COLORS.primaryDark} style={{ marginRight: 4 }} />
                            <Text style={styles.heroBadgeText}>Bệnh viện Thú y PetCare</Text>
                        </View>
                        <View style={styles.heroTitleRow}>
                            <Text style={styles.heroTitle}>Chăm sóc tận tâm,{'\n'}yêu thương trọn vẹn </Text>
                            <FontAwesome5 name="paw" size={22} color={COLORS.primary} style={{ marginTop: 4 }} />
                        </View>
                        <Text style={styles.heroSubtitle}>
                            Quản lý hồ sơ sức khỏe, đặt lịch khám thông minh và nhận chẩn đoán y tế có kiểm chứng từ Bác sĩ AI.
                        </Text>
                        <View style={styles.heroActions}>
                            <TouchableOpacity
                                style={styles.heroPrimaryBtn}
                                onPress={() => navigation.navigate('Booking')}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="calendar-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                                <Text style={styles.heroPrimaryBtnText}>Đặt lịch khám ngay</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.heroSecondaryBtn}
                                onPress={() => navigation.navigate('AIChat')}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="robot-outline" size={18} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                                <Text style={styles.heroSecondaryBtnText}>Hỏi bác sĩ AI</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    {isTabletOrDesktop && (
                        <View style={styles.heroDecoration}>
                            <View style={styles.heroBigIconBox}>
                                <FontAwesome5 name="paw" size={48} color={COLORS.primary} />
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.sectionTitle}>Bé cưng của bạn</Text>
                            <FontAwesome5 name="paw" size={16} color={COLORS.primary} />
                        </View>
                        <Text style={styles.sectionSubtitle}>
                            {pets.length > 0 ? `Đang quản lý hồ sơ cho ${pets.length} thú cưng` : 'Chưa có bé cưng nào trong danh bạ'}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => setShowAddPet(true)}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="add" size={16} color="#fff" style={{ marginRight: 4 }} />
                        <Text style={styles.addButtonText}>Thêm bé mới</Text>
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
                                        {renderPetAvatarIcon(item.species)}
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
                                                    <Ionicons
                                                        name={item.gender === 'male' ? 'male' : 'female'}
                                                        size={11}
                                                        color={item.gender === 'female' ? '#BE185D' : '#0369A1'}
                                                        style={{ marginRight: 3 }}
                                                    />
                                                    <Text style={styles.genderBadgeText}>
                                                        {item.gender === 'male' ? 'Đực' : 'Cái'}
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
                                        <Ionicons name="calendar-outline" size={13} color="#fff" style={{ marginRight: 4 }} />
                                        <Text style={styles.cardBookingBtnText}>Đặt lịch khám</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.cardAiBtn}
                                        onPress={() => navigation.navigate('AIChat')}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialCommunityIcons name="robot-outline" size={15} color={COLORS.primaryDark} style={{ marginRight: 4 }} />
                                        <Text style={styles.cardAiBtnText}>Tư vấn AI</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                ) : (
                    <View style={styles.emptyCard}>
                        <FontAwesome5 name="paw" size={42} color={COLORS.textTertiary || '#94A3B8'} style={{ marginBottom: 12 }} />
                        <Text style={styles.emptyTitle}>Chưa có bé cưng nào</Text>
                        <Text style={styles.emptySub}>Thêm bé cưng để theo dõi hồ sơ y tế, lịch tiêm phòng và đặt lịch khám tiện lợi.</Text>
                        <TouchableOpacity style={styles.emptyButton} onPress={() => setShowAddPet(true)}>
                            <Ionicons name="add-circle-outline" size={17} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.emptyButtonText}>Thêm bé cưng đầu tiên</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Shortcuts & Services Section */}
                <View style={styles.shortcutSection}>
                    <Text style={styles.sectionTitle}>Truy cập nhanh dịch vụ viện</Text>
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
                                    {shortcut.type === 'fa5' ? (
                                        <FontAwesome5 name={shortcut.icon} size={20} color={COLORS.primary} />
                                    ) : shortcut.type === 'mci' ? (
                                        <MaterialCommunityIcons name={shortcut.icon} size={22} color={COLORS.primary} />
                                    ) : (
                                        <Ionicons name={shortcut.icon} size={22} color={COLORS.primary} />
                                    )}
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
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={styles.modalTitle}>Thêm bé cưng mới</Text>
                                    <FontAwesome5 name="paw" size={16} color={COLORS.primary} />
                                </View>
                                <Text style={styles.modalSubtitle}>Nhập thông tin để tạo hồ sơ sức khỏe</Text>
                            </View>
                            <TouchableOpacity
                                style={styles.closeBtnBox}
                                onPress={() => setShowAddPet(false)}
                                disabled={submitting}
                            >
                                <Ionicons name="close" size={20} color={COLORS.textSecondary} />
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
                                    { value: 'dog', label: 'Chó', icon: 'dog' },
                                    { value: 'cat', label: 'Mèo', icon: 'cat' },
                                    { value: 'other', label: 'Khác', icon: 'paw' },
                                ].map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[styles.option, petForm.species === option.value && styles.optionActive]}
                                        onPress={() => updatePetForm('species', option.value)}
                                    >
                                        <FontAwesome5
                                            name={option.icon}
                                            size={14}
                                            color={petForm.species === option.value ? COLORS.primaryDark : COLORS.textSecondary}
                                            style={{ marginRight: 6 }}
                                        />
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
                                    { value: 'male', label: 'Đực', icon: 'male' },
                                    { value: 'female', label: 'Cái', icon: 'female' },
                                ].map((option) => (
                                    <TouchableOpacity
                                        key={option.value}
                                        style={[styles.option, petForm.gender === option.value && styles.optionActive]}
                                        onPress={() => updatePetForm('gender', option.value)}
                                    >
                                        <Ionicons
                                            name={option.icon}
                                            size={14}
                                            color={petForm.gender === option.value ? COLORS.primaryDark : COLORS.textSecondary}
                                            style={{ marginRight: 6 }}
                                        />
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
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Ionicons name="save-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                                        <Text style={styles.submitButtonText}>Lưu thông tin bé</Text>
                                    </View>
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
        flexDirection: 'row',
        alignItems: 'center',
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
    heroTitleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
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
        gap: 12,
    },
    heroPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 12,
        ...SHADOWS.sm,
    },
    heroPrimaryBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    heroSecondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primaryLight,
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.primary,
    },
    heroSecondaryBtnText: {
        color: COLORS.primaryDark,
        fontWeight: '700',
        fontSize: 14,
    },
    heroDecoration: {
        marginLeft: 24,
    },
    heroBigIconBox: {
        width: 100,
        height: 100,
        borderRadius: 24,
        backgroundColor: COLORS.surface,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.md,
    },

    // Quick Stats Bar
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
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        ...SHADOWS.sm,
    },
    statNumber: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.primary,
    },
    statLabel: {
        fontSize: 12,
        color: COLORS.textSecondary,
        marginTop: 4,
        textAlign: 'center',
        fontWeight: '500',
    },

    // Section Header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
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
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
        ...SHADOWS.sm,
    },
    addButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },

    // Pets Grid
    petsGrid: {
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
        width: '31.8%',
    },
    petCardTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    petHeaderInfo: {
        flex: 1,
    },
    petName: {
        fontSize: 17,
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
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    speciesBadgeText: {
        fontSize: 11,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    genderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
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
        fontWeight: '700',
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
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 12,
        color: COLORS.text,
        fontWeight: '600',
    },
    petCardActions: {
        flexDirection: 'row',
        gap: 8,
    },
    cardBookingBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primary,
        paddingVertical: 9,
        borderRadius: 8,
    },
    cardBookingBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 12,
    },
    cardAiBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.primaryLight,
        paddingVertical: 9,
        borderRadius: 8,
    },
    cardAiBtnText: {
        color: COLORS.primaryDark,
        fontWeight: '700',
        fontSize: 12,
    },

    // Empty state
    emptyCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 18,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: COLORS.border,
        marginBottom: 28,
        ...SHADOWS.sm,
    },
    emptyTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: COLORS.text,
        marginBottom: 6,
    },
    emptySub: {
        fontSize: 13,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 18,
        maxWidth: 420,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 20,
        paddingVertical: 11,
        borderRadius: 10,
        ...SHADOWS.sm,
    },
    emptyButtonText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },

    // Shortcuts
    shortcutSection: {
        marginBottom: 32,
    },
    shortcutGrid: {
        gap: 12,
        marginTop: 14,
    },
    shortcutGridDesktop: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    shortcutCard: {
        backgroundColor: COLORS.surface,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        flexDirection: 'column',
        ...SHADOWS.sm,
    },
    shortcutCardDesktop: {
        width: '31.8%',
    },
    shortcutIconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
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
        backgroundColor: 'rgba(15, 23, 42, 0.55)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalContent: {
        backgroundColor: COLORS.surface,
        borderRadius: 22,
        padding: 24,
        width: '100%',
        maxHeight: '90%',
        ...SHADOWS.lg,
    },
    modalContentDesktop: {
        maxWidth: 540,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 18,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: COLORS.text,
    },
    modalSubtitle: {
        fontSize: 13,
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
    inputLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.text,
        marginBottom: 6,
        marginTop: 10,
    },
    required: {
        color: COLORS.danger,
    },
    input: {
        backgroundColor: COLORS.surface,
        borderWidth: 1,
        borderColor: COLORS.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 14,
        color: COLORS.text,
    },
    optionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    option: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: COLORS.surfaceSubtle,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    optionActive: {
        backgroundColor: COLORS.primaryLight,
        borderColor: COLORS.primary,
    },
    optionText: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    optionTextActive: {
        color: COLORS.primaryDark,
        fontWeight: 'bold',
    },
    twoColumnRow: {
        flexDirection: 'row',
    },
    submitButton: {
        backgroundColor: COLORS.primary,
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 20,
        marginBottom: 10,
        ...SHADOWS.sm,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});