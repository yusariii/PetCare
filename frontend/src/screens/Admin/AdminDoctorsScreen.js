import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import {
  listDoctorsApi,
  createDoctorApi,
  setDoctorActiveApi,
  listPharmacistsApi,
  createPharmacistApi,
  setPharmacistActiveApi,
} from '../../api/adminApi';
import { getRoomsApi, assignDoctorToRoomApi } from '../../api/roomApi';

export default function AdminDoctorsScreen() {
  const { isTabletOrDesktop } = useResponsive();
  const [staffRole, setStaffRole] = useState('doctor');
  const isDoctorTab = staffRole === 'doctor';
  const roleLabel = isDoctorTab ? 'bác sĩ' : 'dược sĩ';
  const [doctors, setDoctors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ full_name: '', email: '', password: '', phone: '', room_id: null });
  const [assignPickerFor, setAssignPickerFor] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [staffRes, roomsRes] = await Promise.all([
        isDoctorTab ? listDoctorsApi() : listPharmacistsApi(),
        getRoomsApi(),
      ]);
      setDoctors(staffRes.data.success ? staffRes.data.data || [] : []);
      setRooms(roomsRes.data.success ? roomsRes.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [staffRole]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const freeRooms = rooms.filter((room) => !room.doctor_id);

  const submitCreate = async () => {
    if (!form.full_name || !form.email || !form.password) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên, email và mật khẩu.');
      return;
    }
    try {
      setSaving(true);
      if (isDoctorTab) await createDoctorApi(form);
      else await createPharmacistApi({ full_name: form.full_name, email: form.email, password: form.password, phone: form.phone });
      setCreateVisible(false);
      setForm({ full_name: '', email: '', password: '', phone: '', room_id: null });
      await loadData();
      Alert.alert('Thành công', `Đã tạo tài khoản ${roleLabel}.`);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || `Không thể tạo tài khoản ${roleLabel}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (doctor) => {
    try {
      await (isDoctorTab ? setDoctorActiveApi : setPharmacistActiveApi)(doctor.id, !doctor.is_active);
      await loadData();
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể cập nhật trạng thái tài khoản');
    }
  };

  const assignRoom = async (doctorId, roomId) => {
    try {
      await assignDoctorToRoomApi(roomId, doctorId);
      setAssignPickerFor(null);
      await loadData();
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể gán phòng khám');
    }
  };

  const unassignRoom = async (roomId) => {
    try {
      await assignDoctorToRoomApi(roomId, null);
      await loadData();
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể gỡ phòng khám');
    }
  };

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.eyebrow}>QUẢN TRỊ BỆNH VIỆN</Text>
            <Text style={styles.title}>Đội Ngũ Y Tế 👨‍⚕️👩‍⚕️</Text>
            <Text style={styles.subtitle}>
              {isDoctorTab
                ? 'Quản lý tài khoản bác sĩ, phân công phòng chuyên khoa và trạng thái hoạt động.'
                : 'Quản lý tài khoản dược sĩ phụ trách quầy thuốc bệnh viện.'}
            </Text>
          </View>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.segment}>
            {[['doctor', '🩺 Bác sĩ'], ['pharmacist', '💊 Dược sĩ']].map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={[styles.segmentButton, staffRole === value && styles.segmentButtonSelected]}
                onPress={() => setStaffRole(value)}
              >
                <Text style={staffRole === value ? styles.segmentTextSelected : styles.segmentText}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.addButton} onPress={() => setCreateVisible(true)}>
            <Text style={styles.addButtonText}>+ Thêm {roleLabel} mới</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : doctors.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.empty}>Chưa có {roleLabel} nào trong hệ thống.</Text>
          </View>
        ) : (
          <View style={[styles.staffGrid, isTabletOrDesktop && styles.staffGridDesktop]}>
            {doctors.map((doctor) => {
              const initials = (doctor.full_name || 'BS')
                .split(' ')
                .map((w) => w[0])
                .slice(-2)
                .join('')
                .toUpperCase();

              return (
                <View key={doctor.id} style={[styles.card, isTabletOrDesktop && styles.cardDesktop]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.avatarWrap}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>{initials}</Text>
                      </View>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.name} numberOfLines={1}>{doctor.full_name}</Text>
                        <Text style={styles.roleSub}>{isDoctorTab ? 'Bác sĩ chuyên khoa' : 'Dược sĩ quầy thuốc'}</Text>
                      </View>
                    </View>

                    <View style={styles.switchCol}>
                      <Switch
                        value={Boolean(doctor.is_active)}
                        onValueChange={() => toggleActive(doctor)}
                        trackColor={{ true: COLORS.primary }}
                      />
                      <Text style={[styles.activeStatus, { color: doctor.is_active ? COLORS.success : COLORS.textTertiary || '#94A3B8' }]}>
                        {doctor.is_active ? 'Hoạt động' : 'Tạm khóa'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.contactBox}>
                    <Text style={styles.detail}>📧 {doctor.email}</Text>
                    <Text style={styles.detail}>📞 {doctor.phone || 'Chưa cập nhật số điện thoại'}</Text>
                  </View>

                  {isDoctorTab && (
                    <View style={styles.roomBox}>
                      {doctor.room_id ? (
                        <View style={styles.roomRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.roomLabel}>Phòng khám phụ trách:</Text>
                            <Text style={styles.roomText}>🏥 {doctor.room_code} - {doctor.room_name}</Text>
                          </View>
                          <TouchableOpacity style={styles.unassignButton} onPress={() => unassignRoom(doctor.room_id)}>
                            <Text style={styles.unassignText}>Gỡ phòng</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View style={styles.unassignedWrap}>
                          <Text style={styles.unassignedWarning}>⚠️ Chưa được gán phòng khám</Text>
                          <TouchableOpacity style={styles.assignButton} onPress={() => setAssignPickerFor(doctor.id)}>
                            <Text style={styles.assignButtonText}>+ Phân công phòng</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Thêm Bác sĩ / Dược sĩ */}
      <Modal visible={createVisible} transparent animationType="fade" onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Thêm {roleLabel} mới</Text>
                <Text style={styles.modalSubtitle}>Cấp tài khoản đăng nhập hệ thống</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setCreateVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Field label="Họ và tên" value={form.full_name} onChangeText={(full_name) => setForm({ ...form, full_name })} placeholder="VD: BS. Nguyễn Văn A" />
              <Field label="Email đăng nhập" value={form.email} onChangeText={(email) => setForm({ ...form, email })} keyboardType="email-address" autoCapitalize="none" placeholder="bacsi@petcare.vn" />
              <Field label="Mật khẩu" value={form.password} onChangeText={(password) => setForm({ ...form, password })} secureTextEntry placeholder="Tối thiểu 6 ký tự" />
              <Field label="Số điện thoại" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} keyboardType="phone-pad" placeholder="0901234567" />

              {isDoctorTab && (
                <>
                  <Text style={styles.fieldLabel}>Phòng khám phụ trách (không bắt buộc)</Text>
                  <View style={styles.typeRow}>
                    {freeRooms.length === 0 ? (
                      <Text style={styles.emptyRoomHint}>Không còn phòng trống chưa có bác sĩ</Text>
                    ) : (
                      freeRooms.map((room) => (
                        <TouchableOpacity
                          key={room.id}
                          style={[styles.typeButton, form.room_id === room.id && styles.typeButtonSelected]}
                          onPress={() => setForm({ ...form, room_id: form.room_id === room.id ? null : room.id })}
                        >
                          <Text style={form.room_id === room.id ? styles.typeTextSelected : styles.typeText}>
                            {room.room_code} ({room.room_name})
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}
                  </View>
                </>
              )}

              <TouchableOpacity style={styles.saveButton} onPress={submitCreate} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Đang tạo...' : 'Tạo tài khoản'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Phân công phòng khám */}
      <Modal visible={Boolean(assignPickerFor)} transparent animationType="fade" onRequestClose={() => setAssignPickerFor(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Phân công phòng khám</Text>
                <Text style={styles.modalSubtitle}>Chọn phòng khám đang còn trống cho bác sĩ</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setAssignPickerFor(null)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {freeRooms.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.empty}>Tất cả phòng khám hiện đều đã có bác sĩ phụ trách.</Text>
                </View>
              ) : (
                freeRooms.map((room) => (
                  <TouchableOpacity
                    key={room.id}
                    style={styles.pickerItem}
                    onPress={() => assignRoom(assignPickerFor, room.id)}
                  >
                    <View>
                      <Text style={styles.pickerItemName}>{room.room_code} - {room.room_name}</Text>
                      <Text style={styles.pickerItemDetail}>Tầng {room.floor_number} · Loại: {room.room_type}</Text>
                    </View>
                    <Text style={styles.pickerAddText}>Gán →</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ResponsiveContainer>
  );
}

function Field({ label, placeholder, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingBottom: 36,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTitleWrap: {
    marginBottom: 4,
  },
  eyebrow: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
    flexWrap: 'wrap',
    gap: 12,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    minWidth: 240,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentButtonSelected: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  segmentTextSelected: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  empty: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  staffGrid: {
    paddingHorizontal: 16,
    gap: 14,
  },
  staffGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardDesktop: {
    width: '48.8%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 15,
  },
  name: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 16,
  },
  roleSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  switchCol: {
    alignItems: 'center',
  },
  activeStatus: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  contactBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 12,
  },
  detail: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '500',
  },
  roomBox: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  roomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  roomLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  roomText: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 2,
  },
  unassignButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  unassignText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  unassignedWrap: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  unassignedWarning: {
    color: COLORS.warning,
    fontSize: 12,
    fontWeight: '600',
  },
  assignButton: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  assignButtonText: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 12,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '90%',
    ...SHADOWS.lg,
  },
  modalCentered: {
    maxWidth: 540,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 15,
  },
  modalScroll: {
    maxHeight: 520,
  },
  fieldLabel: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    fontSize: 14,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  typeButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: COLORS.background,
  },
  typeButtonSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  typeText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  typeTextSelected: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyRoomHint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  pickerItemName: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 15,
  },
  pickerItemDetail: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 3,
  },
  pickerAddText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 14,
  },
});
