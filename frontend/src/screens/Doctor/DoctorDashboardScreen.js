import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { getAllAppointmentsApi, updateAppointmentStatusApi } from '../../api/appointmentApi';
import { createHealthRecordApi } from '../../api/healthRecordApi';

const STATUS_LABELS = {
  pending: 'Chờ duyệt',
  confirmed: 'Đã xác nhận',
  completed: 'Hoàn thành',
  cancelled: 'Đã hủy',
};

const RECORD_TYPES = [
  ['medical', 'Khám bệnh'],
  ['vaccine', 'Tiêm vaccine'],
  ['deworming', 'Tẩy giun'],
  ['surgery', 'Phẫu thuật'],
];

const today = () => new Date().toISOString().slice(0, 10);

export default function DoctorDashboardScreen() {
  const [appointments, setAppointments] = useState([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [recordVisible, setRecordVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    record_type: 'medical',
    title: '',
    diagnosis: '',
    treatment_plan: '',
    performed_date: today(),
    next_due_date: '',
  });

  const loadAppointments = async (date = selectedDate) => {
    try {
      setLoading(true);
      const response = await getAllAppointmentsApi({ date });
      setAppointments(response.data.success ? response.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải lịch khám');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAppointments(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const counts = useMemo(() => appointments.reduce((result, item) => {
    result[item.status] = (result[item.status] || 0) + 1;
    return result;
  }, {}), [appointments]);

  const updateStatus = async (status) => {
    try {
      setSaving(true);
      await updateAppointmentStatusApi(selectedAppointment.id, { status });
      setSelectedAppointment(null);
      await loadAppointments();
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể cập nhật lịch khám');
    } finally {
      setSaving(false);
    }
  };

  const openRecordForm = () => {
    setForm({
      record_type: 'medical',
      title: `Khám ${selectedAppointment.pet_name}`,
      diagnosis: '',
      treatment_plan: '',
      performed_date: today(),
      next_due_date: '',
    });
    setRecordVisible(true);
  };

  const saveRecord = async () => {
    if (!form.title || !form.diagnosis || !form.performed_date) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề, chẩn đoán và ngày thực hiện.');
      return;
    }
    try {
      setSaving(true);
      await createHealthRecordApi({ ...form, pet_id: selectedAppointment.pet_id });
      setRecordVisible(false);
      setSelectedAppointment(null);
      Alert.alert('Thành công', 'Đã lập hồ sơ bệnh án cho thú cưng.');
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể lập hồ sơ bệnh án');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>BẢNG ĐIỀU KHIỂN</Text>
          <Text style={styles.title}>Xin chào, bác sĩ</Text>
          <Text style={styles.subtitle}>Theo dõi ca khám và chăm sóc hồ sơ thú cưng.</Text>
        </View>

        <View style={styles.statsRow}>
          <Stat label="Tổng ca" value={appointments.length} color={COLORS.primary} />
          <Stat label="Chờ duyệt" value={counts.pending || 0} color={COLORS.warning} />
          <Stat label="Đã xong" value={counts.completed || 0} color={COLORS.success} />
        </View>

        <View style={styles.dateRow}>
          <Text style={styles.sectionTitle}>Lịch khám trong ngày</Text>
          <TextInput
            value={selectedDate}
            onChangeText={setSelectedDate}
            onSubmitEditing={() => loadAppointments(selectedDate)}
            placeholder="YYYY-MM-DD"
            style={styles.dateInput}
            maxLength={10}
          />
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={() => loadAppointments(selectedDate)}>
          <Text style={styles.filterButtonText}>Xem lịch ngày này</Text>
        </TouchableOpacity>

        {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} /> : appointments.length === 0 ? (
          <Text style={styles.empty}>Không có lịch khám trong ngày {selectedDate}.</Text>
        ) : appointments.map((appointment) => (
          <TouchableOpacity
            key={appointment.id}
            style={styles.appointment}
            onPress={() => setSelectedAppointment(appointment)}
          >
            <View style={styles.appointmentTop}>
              <Text style={styles.time}>{new Date(appointment.appointment_datetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={[styles.status, { color: statusColor(appointment.status) }]}>{STATUS_LABELS[appointment.status]}</Text>
            </View>
            <Text style={styles.pet}>{appointment.pet_name} <Text style={styles.species}>({appointment.species})</Text></Text>
            <Text style={styles.detail}>{appointment.service_name || 'Chưa có dịch vụ'} · {appointment.room_name}</Text>
            <Text style={styles.owner}>Chủ nuôi: {appointment.customer_info}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={Boolean(selectedAppointment)} transparent animationType="slide" onRequestClose={() => setSelectedAppointment(null)}>
        <View style={styles.overlay}>
          <View style={styles.modal}>
            {selectedAppointment && <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedAppointment.pet_name}</Text>
                <TouchableOpacity onPress={() => setSelectedAppointment(null)}><Text style={styles.close}>X</Text></TouchableOpacity>
              </View>
              <Text style={styles.detail}>{selectedAppointment.species} · {selectedAppointment.breed || 'Chưa rõ giống'}</Text>
              <Text style={styles.detail}>Chủ nuôi: {selectedAppointment.customer_info}</Text>
              <Text style={styles.detail}>Dịch vụ: {selectedAppointment.service_name}</Text>
              <Text style={styles.detail}>Ghi chú: {selectedAppointment.notes || 'Không có'}</Text>
              <View style={styles.actions}>
                {selectedAppointment.status === 'pending' && <Action label="Xác nhận" color={COLORS.primary} onPress={() => updateStatus('confirmed')} />}
                {selectedAppointment.status === 'confirmed' && <Action label="Hoàn thành" color={COLORS.success} onPress={() => updateStatus('completed')} />}
                {(selectedAppointment.status === 'pending' || selectedAppointment.status === 'confirmed') && <Action label="Hủy lịch" color={COLORS.danger} onPress={() => updateStatus('cancelled')} />}
                {selectedAppointment.status === 'completed' && <Action label="Lập hồ sơ bệnh án" color={COLORS.primaryDark} onPress={openRecordForm} />}
              </View>
              {saving && <ActivityIndicator color={COLORS.primary} />}
            </>}
          </View>
        </View>
      </Modal>

      <Modal visible={recordVisible} transparent animationType="slide" onRequestClose={() => setRecordVisible(false)}>
        <View style={styles.overlay}><View style={styles.modal}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Lập hồ sơ bệnh án</Text><TouchableOpacity onPress={() => setRecordVisible(false)}><Text style={styles.close}>X</Text></TouchableOpacity></View>
          <ScrollView>
            <Text style={styles.fieldLabel}>Loại hồ sơ</Text>
            <View style={styles.typeRow}>{RECORD_TYPES.map(([value, label]) => <TouchableOpacity key={value} onPress={() => setForm({ ...form, record_type: value })} style={[styles.typeButton, form.record_type === value && styles.typeButtonSelected]}><Text style={form.record_type === value ? styles.typeTextSelected : styles.typeText}>{label}</Text></TouchableOpacity>)}</View>
            <Field label="Tiêu đề" value={form.title} onChangeText={(title) => setForm({ ...form, title })} />
            <Field label="Chẩn đoán" value={form.diagnosis} onChangeText={(diagnosis) => setForm({ ...form, diagnosis })} multiline />
            <Field label="Hướng điều trị" value={form.treatment_plan} onChangeText={(treatment_plan) => setForm({ ...form, treatment_plan })} multiline />
            <Field label="Ngày thực hiện (YYYY-MM-DD)" value={form.performed_date} onChangeText={(performed_date) => setForm({ ...form, performed_date })} />
            <Field label="Ngày tái khám (không bắt buộc)" value={form.next_due_date} onChangeText={(next_due_date) => setForm({ ...form, next_due_date })} />
            <TouchableOpacity style={styles.saveButton} onPress={saveRecord} disabled={saving}><Text style={styles.saveText}>{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</Text></TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>
    </ResponsiveContainer>
  );
}

function Stat({ label, value, color }) { return <View style={styles.stat}><Text style={[styles.statValue, { color }]}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }
function Action({ label, color, onPress }) { return <TouchableOpacity style={[styles.action, { backgroundColor: color }]} onPress={onPress}><Text style={styles.actionText}>{label}</Text></TouchableOpacity>; }
function Field({ label, multiline, ...props }) { return <View><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>; }
function statusColor(status) { return ({ pending: COLORS.warning, confirmed: COLORS.secondary, completed: COLORS.success, cancelled: COLORS.danger })[status] || COLORS.textSecondary; }

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: COLORS.text, fontSize: 28, fontWeight: '800', marginTop: 5 },
  subtitle: { color: COLORS.textSecondary, marginTop: 6 },
  statsRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginBottom: 18 },
  stat: { flex: 1, backgroundColor: COLORS.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: COLORS.border },
  statValue: { fontSize: 24, fontWeight: '800' }, statLabel: { color: COLORS.textSecondary, marginTop: 3, fontSize: 12 },
  dateRow: { paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: COLORS.text, fontWeight: '800', fontSize: 18 },
  dateInput: { backgroundColor: COLORS.surface, borderColor: COLORS.border, borderWidth: 1, borderRadius: 8, padding: 8, width: 112, textAlign: 'center' },
  filterButton: { margin: 12, marginTop: 10, backgroundColor: COLORS.primaryLight, padding: 11, borderRadius: 9, alignItems: 'center' },
  filterButtonText: { color: COLORS.primaryDark, fontWeight: '700' },
  loader: { marginTop: 30 }, empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 30 },
  appointment: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: COLORS.primary },
  appointmentTop: { flexDirection: 'row', justifyContent: 'space-between' }, time: { color: COLORS.primaryDark, fontWeight: '800', fontSize: 16 }, status: { fontWeight: '700', fontSize: 12 },
  pet: { color: COLORS.text, fontWeight: '800', fontSize: 18, marginTop: 10 }, species: { color: COLORS.textSecondary, fontWeight: '400', fontSize: 14 }, detail: { color: COLORS.textSecondary, marginTop: 5 }, owner: { color: COLORS.textSecondary, fontSize: 12, marginTop: 10 },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' }, modal: { backgroundColor: COLORS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '90%' }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }, modalTitle: { color: COLORS.text, fontSize: 21, fontWeight: '800' }, close: { color: COLORS.textSecondary, fontWeight: '800', padding: 8 }, actions: { gap: 10, marginTop: 20 }, action: { borderRadius: 10, padding: 13, alignItems: 'center' }, actionText: { color: '#fff', fontWeight: '800' },
  fieldLabel: { color: COLORS.text, fontWeight: '700', marginTop: 12, marginBottom: 6 }, input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, padding: 11, color: COLORS.text, backgroundColor: COLORS.background }, multiline: { minHeight: 72, textAlignVertical: 'top' }, typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, typeButton: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 8 }, typeButtonSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary }, typeText: { color: COLORS.textSecondary, fontSize: 12 }, typeTextSelected: { color: '#fff', fontSize: 12, fontWeight: '700' }, saveButton: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20, marginBottom: 12 }, saveText: { color: '#fff', fontWeight: '800' },
});
