import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Modal, TextInput, ScrollView, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { createPetApi, getMyPetsApi } from '../../api/petApi';

export default function HomeScreen({ navigation }) {
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
        { key: 'Hospital', icon: '🏥', label: 'Bản đồ bệnh viện', description: 'Tìm phòng khám' },
        { key: 'Booking', icon: '📅', label: 'Đặt lịch khám', description: 'Chọn dịch vụ phù hợp' },
        { key: 'AIChat', icon: '🤖', label: 'Bác sĩ AI', description: 'Hỏi đáp sức khỏe' },
        { key: 'Appointments', icon: '📋', label: 'Lịch hẹn', description: 'Theo dõi lịch đã đặt' },
        { key: 'Profile', icon: '👤', label: 'Tài khoản', description: 'Quản lý thông tin' },
    ];

    return (
        <ResponsiveContainer style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerText}>
                    <Text style={styles.welcome}>Xin chào, Sen! 🌿</Text>
                    <Text style={styles.sub}>Danh sách bé cưng của bạn</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={() => setShowAddPet(true)}>
                    <Text style={styles.addButtonText}>＋ Thêm bé</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={pets}
                keyExtractor={(item) => item.id.toString()}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                renderItem={({ item }) => (
                    <View style={styles.petCard}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{item.species === 'dog' ? '🐶' : '🐱'}</Text>
                        </View>
                        <View style={styles.info}>
                            <Text style={styles.petName}>{item.name}</Text>
                            <Text style={styles.petBreed}>{item.breed || 'Chưa cập nhật giống'}</Text>
                            <Text style={styles.petMeta}>⚖️ {item.weight_kg ? `${item.weight_kg} kg` : 'N/A'}</Text>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>Bạn chưa thêm thú cưng nào.</Text>
                        <TouchableOpacity style={styles.emptyButton} onPress={() => setShowAddPet(true)}>
                            <Text style={styles.emptyButtonText}>Thêm bé cưng đầu tiên</Text>
                        </TouchableOpacity>
                    </View>
                }
                ListFooterComponent={<View style={styles.shortcutSection}>
                    <Text style={styles.sectionTitle}>Truy cập nhanh</Text>
                    <View style={styles.shortcutGrid}>
                        {shortcuts.map((shortcut) => (
                            <TouchableOpacity key={shortcut.key} style={styles.shortcutCard} onPress={() => navigation.navigate(shortcut.key)}>
                                <Text style={styles.shortcutIcon}>{shortcut.icon}</Text>
                                <Text style={styles.shortcutLabel}>{shortcut.label}</Text>
                                <Text style={styles.shortcutDescription}>{shortcut.description}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>}
            />

            <Modal visible={showAddPet} transparent animationType="slide" onRequestClose={() => setShowAddPet(false)}>
                <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Thêm bé cưng</Text>
                            <TouchableOpacity onPress={() => setShowAddPet(false)} disabled={submitting}><Text style={styles.closeButton}>✕</Text></TouchableOpacity>
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Text style={styles.inputLabel}>Tên bé <Text style={styles.required}>*</Text></Text>
                            <TextInput style={styles.input} value={petForm.name} onChangeText={(value) => updatePetForm('name', value)} placeholder="Ví dụ: Bông" placeholderTextColor={COLORS.textSecondary} maxLength={50} />
                            <Text style={styles.inputLabel}>Loài <Text style={styles.required}>*</Text></Text>
                            <View style={styles.optionRow}>{[{ value: 'dog', label: '🐶 Chó' }, { value: 'cat', label: '🐱 Mèo' }, { value: 'other', label: '🐾 Khác' }].map((option) => (
                                <TouchableOpacity key={option.value} style={[styles.option, petForm.species === option.value && styles.optionActive]} onPress={() => updatePetForm('species', option.value)}>
                                    <Text style={[styles.optionText, petForm.species === option.value && styles.optionTextActive]}>{option.label}</Text>
                                </TouchableOpacity>
                            ))}</View>
                            <Text style={styles.inputLabel}>Giống</Text>
                            <TextInput style={styles.input} value={petForm.breed} onChangeText={(value) => updatePetForm('breed', value)} placeholder="Ví dụ: Poodle" placeholderTextColor={COLORS.textSecondary} maxLength={50} />
                            <Text style={styles.inputLabel}>Cân nặng (kg)</Text>
                            <TextInput style={styles.input} value={petForm.weight_kg} onChangeText={(value) => updatePetForm('weight_kg', value.replace(',', '.'))} placeholder="Ví dụ: 5.5" placeholderTextColor={COLORS.textSecondary} keyboardType="decimal-pad" />
                            <Text style={styles.inputLabel}>Ngày sinh</Text>
                            <TextInput style={styles.input} value={petForm.birth_date} onChangeText={(value) => updatePetForm('birth_date', value)} placeholder="YYYY-MM-DD" placeholderTextColor={COLORS.textSecondary} maxLength={10} />
                            <Text style={styles.inputLabel}>Giới tính</Text>
                            <View style={styles.optionRow}>{[{ value: 'male', label: 'Đực' }, { value: 'female', label: 'Cái' }].map((option) => (
                                <TouchableOpacity key={option.value} style={[styles.option, petForm.gender === option.value && styles.optionActive]} onPress={() => updatePetForm('gender', option.value)}>
                                    <Text style={[styles.optionText, petForm.gender === option.value && styles.optionTextActive]}>{option.label}</Text>
                                </TouchableOpacity>
                            ))}</View>
                            <TouchableOpacity style={styles.submitButton} onPress={handleAddPet} disabled={submitting}>
                                {submitting ? <ActivityIndicator color={COLORS.surface} /> : <Text style={styles.submitButtonText}>Lưu thông tin</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </ResponsiveContainer>
    );
}

const styles = StyleSheet.create({
    container: { padding: 16 },
    header: { marginBottom: 16, marginTop: 8, flexDirection: 'row', alignItems: 'center' },
    headerText: { flex: 1 },
    welcome: { fontSize: 24, fontWeight: 'bold', color: COLORS.primaryDark },
    sub: { fontSize: 14, color: COLORS.textSecondary },
    addButton: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginLeft: 8 },
    addButtonText: { color: COLORS.surface, fontWeight: 'bold', fontSize: 13 },
    petCard: { flexDirection: 'row', backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 5, elevation: 2 },
    avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    avatarText: { fontSize: 26 },
    info: { flex: 1 },
    petName: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
    petBreed: { fontSize: 14, color: COLORS.textSecondary, marginVertical: 2 },
    petMeta: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
    empty: { alignItems: 'center', marginTop: 40, marginBottom: 28 },
    emptyText: { color: COLORS.textSecondary },
    emptyButton: { marginTop: 14, borderWidth: 1, borderColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
    emptyButtonText: { color: COLORS.primary, fontWeight: 'bold' },
    shortcutSection: { paddingBottom: 24 },
    sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginBottom: 12 },
    shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    shortcutCard: { width: '48.5%', backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
    shortcutIcon: { fontSize: 25, marginBottom: 8 },
    shortcutLabel: { color: COLORS.text, fontWeight: 'bold', fontSize: 14 },
    shortcutDescription: { color: COLORS.textSecondary, fontSize: 12, marginTop: 4 },
    modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15, 23, 42, 0.45)' },
    modalContent: { backgroundColor: COLORS.background, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '92%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    modalTitle: { color: COLORS.primaryDark, fontSize: 21, fontWeight: 'bold' },
    closeButton: { color: COLORS.textSecondary, fontSize: 22, padding: 4 },
    inputLabel: { color: COLORS.text, fontWeight: '600', marginTop: 12, marginBottom: 6 },
    required: { color: COLORS.danger },
    input: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: COLORS.text, fontSize: 15 },
    optionRow: { flexDirection: 'row', gap: 8 },
    option: { flex: 1, alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 11, backgroundColor: COLORS.surface },
    optionActive: { backgroundColor: COLORS.primaryLight, borderColor: COLORS.primary },
    optionText: { color: COLORS.textSecondary, fontWeight: '600' },
    optionTextActive: { color: COLORS.primaryDark },
    submitButton: { minHeight: 48, backgroundColor: COLORS.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginTop: 22, marginBottom: 8 },
    submitButtonText: { color: COLORS.surface, fontWeight: 'bold', fontSize: 16 },
});