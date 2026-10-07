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
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { listDoctorsApi, createDoctorApi, setDoctorActiveApi, listPharmacistsApi, createPharmacistApi, setPharmacistActiveApi } from '../../api/adminApi';
import { getRoomsApi, assignDoctorToRoomApi } from '../../api/roomApi';

export default function AdminDoctorsScreen() {
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
      <View style={styles.header}>
        <Text style={styles.eyebrow}>QUẢN TRỊ</Text>
        <Text style={styles.title}>Nhân sự</Text>
        <Text style={styles.subtitle}>
          {isDoctorTab ? 'Tạo tài khoản, phân công phòng khám, khóa/mở tài khoản.' : 'Tạo tài khoản, khóa/mở tài khoản dược sĩ quầy thuốc.'}
        </Text>
      </View>

      <View style={styles.segment}>
        {[['doctor', 'Bác sĩ'], ['pharmacist', 'Dược sĩ']].map(([value, label]) => (
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} /> : doctors.length === 0 ? (
          <Text style={styles.empty}>Chưa có {roleLabel} nào.</Text>
        ) : doctors.map((doctor) => (
          <View key={doctor.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.name}>{doctor.full_name}</Text>
              <Switch value={Boolean(doctor.is_active)} onValueChange={() => toggleActive(doctor)} />
            </View>
            <Text style={styles.detail}>{doctor.email} · {doctor.phone || 'Chưa có SĐT'}</Text>
            <Text style={styles.detail}>
              Trạng thái: {doctor.is_active ? 'Đang hoạt động' : 'Đã khóa'}
            </Text>
            {isDoctorTab && (doctor.room_id ? (
              <View style={styles.roomRow}>
                <Text style={styles.roomText}>Phụ trách: {doctor.room_code} - {doctor.room_name}</Text>
                <TouchableOpacity onPress={() => unassignRoom(doctor.room_id)}>
                  <Text style={styles.unassignText}>Gỡ phòng</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.assignButton} onPress={() => setAssignPickerFor(doctor.id)}>
                <Text style={styles.assignButtonText}>Gán phòng khám</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.overlay}><View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Thêm {roleLabel} mới</Text>
            <TouchableOpacity onPress={() => setCreateVisible(false)}><Text style={styles.close}>X</Text></TouchableOpacity>
          </View>
          <ScrollView>
            <Field label="Họ tên" value={form.full_name} onChangeText={(full_name) => setForm({ ...form, full_name })} />
            <Field label="Email" value={form.email} onChangeText={(email) => setForm({ ...form, email })} keyboardType="email-address" autoCapitalize="none" />
            <Field label="Mật khẩu" value={form.password} onChangeText={(password) => setForm({ ...form, password })} secureTextEntry />
            <Field label="Số điện thoại" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} />
            {isDoctorTab && <Text style={styles.fieldLabel}>Phòng khám phụ trách (không bắt buộc)</Text>}
            {isDoctorTab && <View style={styles.typeRow}>
              {freeRooms.map((room) => (
                <TouchableOpacity
                  key={room.id}
                  style={[styles.typeButton, form.room_id === room.id && styles.typeButtonSelected]}
                  onPress={() => setForm({ ...form, room_id: form.room_id === room.id ? null : room.id })}
                >
                  <Text style={form.room_id === room.id ? styles.typeTextSelected : styles.typeText}>{room.room_code}</Text>
                </TouchableOpacity>
              ))}
            </View>}
            <TouchableOpacity style={styles.saveButton} onPress={submitCreate} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Đang lưu...' : 'Tạo tài khoản'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={Boolean(assignPickerFor)} transparent animationType="fade" onRequestClose={() => setAssignPickerFor(null)}>
        <View style={styles.overlay}><View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Chọn phòng khám</Text>
            <TouchableOpacity onPress={() => setAssignPickerFor(null)}><Text style={styles.close}>X</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {freeRooms.length === 0 ? <Text style={styles.empty}>Không còn phòng trống.</Text> : freeRooms.map((room) => (
              <TouchableOpacity key={room.id} style={styles.pickerItem} onPress={() => assignRoom(assignPickerFor, room.id)}>
                <Text style={styles.pickerItemName}>{room.room_code} - {room.room_name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View></View>
      </Modal>
    </ResponsiveContainer>
  );
}

function Field({ label, ...props }) {
  return <View><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} style={styles.input} /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '800', marginTop: 5 },
  subtitle: { color: COLORS.textSecondary, marginTop: 6 },
  segment: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.primaryLight, borderRadius: 10, padding: 4 },
  segmentButton: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segmentButtonSelected: { backgroundColor: COLORS.primary },
  segmentText: { color: COLORS.primaryDark, fontWeight: '700' },
  segmentTextSelected: { color: '#fff', fontWeight: '800' },
  addButton: { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.primary, padding: 13, borderRadius: 10, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '800' },
  loader: { marginTop: 30 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 30 },
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  detail: { color: COLORS.textSecondary, marginTop: 5 },
  roomRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  roomText: { color: COLORS.primaryDark, fontWeight: '700' },
  unassignText: { color: COLORS.danger, fontWeight: '700' },
  assignButton: { marginTop: 10, backgroundColor: COLORS.primaryLight, padding: 10, borderRadius: 8, alignItems: 'center' },
  assignButtonText: { color: COLORS.primaryDark, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: COLORS.text, fontSize: 21, fontWeight: '800' },
  close: { color: COLORS.textSecondary, fontWeight: '800', padding: 8 },
  fieldLabel: { color: COLORS.text, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, padding: 11, color: COLORS.text, backgroundColor: COLORS.background },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  typeButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 8 },
  typeButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeText: { color: COLORS.textSecondary, fontSize: 12 },
  typeTextSelected: { color: '#fff', fontSize: 12, fontWeight: '700' },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20, marginBottom: 12 },
  saveText: { color: '#fff', fontWeight: '800' },
  pickerItem: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 12 },
  pickerItemName: { color: COLORS.text, fontWeight: '700', fontSize: 15 },
});
