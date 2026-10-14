import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { getAllAppointmentsApi, updateAppointmentStatusApi } from '../../api/appointmentApi';
import { createHealthRecordApi, getPetHealthRecordsApi } from '../../api/healthRecordApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listMedicinesApi } from '../../api/medicineApi';
import { createPrescriptionApi } from '../../api/prescriptionApi';

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

const STATUS_FILTERS = [
  ['all', 'Tất cả'],
  ['pending', 'Chờ duyệt'],
  ['confirmed', 'Đã xác nhận'],
  ['completed', 'Hoàn thành'],
  ['cancelled', 'Đã hủy'],
];

export default function DoctorDashboardScreen({ route }) {
  const { isTabletOrDesktop, isDesktop } = useResponsive();
  const completedOnly = route?.params?.mode === 'completed';
  const [statusFilter, setStatusFilter] = useState('all');
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
  const [medicines, setMedicines] = useState([]);
  const [prescriptionVisible, setPrescriptionVisible] = useState(false);
  const [prescriptionContext, setPrescriptionContext] = useState(null); // { health_record_id, pet_name }
  const [prescriptionItems, setPrescriptionItems] = useState([]);
  const [medicinePickerVisible, setMedicinePickerVisible] = useState(false);

  const loadAppointments = async (date = selectedDate, status = statusFilter) => {
    try {
      setLoading(true);
      const params = completedOnly
        ? { status: 'completed' }
        : { date, ...(status !== 'all' ? { status } : {}) };
      const response = await getAllAppointmentsApi(params);
      setAppointments(response.data.success ? response.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải lịch khám');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => {
    if (completedOnly || /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) loadAppointments();
  }, [selectedDate, statusFilter, completedOnly]));

  useEffect(() => {
    listMedicinesApi().then((response) => {
      setMedicines(response.data.success ? response.data.data || [] : []);
    }).catch(() => setMedicines([]));
  }, []);

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
      const response = await createHealthRecordApi({ ...form, pet_id: selectedAppointment.pet_id });
      const recordId = response.data?.data?.record_id;
      const petName = selectedAppointment.pet_name;
      setRecordVisible(false);
      setSelectedAppointment(null);
      Alert.alert('Thành công', 'Đã lập hồ sơ bệnh án cho thú cưng.', [
        { text: 'Để sau' },
        { text: 'Kê đơn thuốc', onPress: () => openPrescriptionForm(recordId, petName) },
      ]);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể lập hồ sơ bệnh án');
    } finally {
      setSaving(false);
    }
  };

  const openPrescriptionForm = (healthRecordId, petName) => {
    setPrescriptionContext({ health_record_id: healthRecordId, pet_name: petName });
    setPrescriptionItems([]);
    setPrescriptionVisible(true);
  };

  const prescribeForAppointment = async () => {
    try {
      setSaving(true);
      const user = JSON.parse((await AsyncStorage.getItem('user')) || '{}');
      const response = await getPetHealthRecordsApi(selectedAppointment.pet_id);
      const records = response.data.success ? response.data.data || [] : [];
      const record = records.find((r) => r.doctor_id === user.id && !r.prescription_id);
      if (!record) {
        Alert.alert('Chưa có hồ sơ chờ kê đơn', 'Hãy lập hồ sơ bệnh án cho ca khám này trước, sau đó kê đơn thuốc.');
        return;
      }
      const petName = selectedAppointment.pet_name;
      setSelectedAppointment(null);
      openPrescriptionForm(record.id, petName);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải hồ sơ bệnh án');
    } finally {
      setSaving(false);
    }
  };

  const addMedicineToPrescription = (medicine) => {
    if (prescriptionItems.some((item) => item.medicine_id === medicine.id)) {
      setMedicinePickerVisible(false);
      return;
    }
    setPrescriptionItems([...prescriptionItems, {
      medicine_id: medicine.id,
      name: medicine.name,
      unit: medicine.unit,
      dosage: '',
      quantity: '1',
    }]);
    setMedicinePickerVisible(false);
  };

  const updatePrescriptionItem = (index, field, value) => {
    setPrescriptionItems(prescriptionItems.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removePrescriptionItem = (index) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  const submitPrescription = async () => {
    if (prescriptionItems.length === 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng thêm ít nhất 1 loại thuốc.');
      return;
    }
    for (const item of prescriptionItems) {
      if (!item.dosage || !item.quantity || Number(item.quantity) <= 0) {
        Alert.alert('Thiếu thông tin', `Vui lòng nhập liều dùng và số lượng hợp lệ cho thuốc "${item.name}".`);
        return;
      }
    }
    try {
      setSaving(true);
      await createPrescriptionApi({
        health_record_id: prescriptionContext.health_record_id,
        items: prescriptionItems.map((item) => ({
          medicine_id: item.medicine_id,
          dosage: item.dosage,
          quantity: Number(item.quantity),
        })),
      });
      setPrescriptionVisible(false);
      Alert.alert('Thành công', 'Đã kê đơn thuốc. Khách hàng có thể đặt mua và thanh toán tại quầy.');
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể kê đơn thuốc');
    } finally {
      setSaving(false);
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
          <Text style={styles.eyebrow}>{completedOnly ? 'ĐÃ KHÁM XONG' : 'BẢNG ĐIỀU KHIỂN BÁC SĨ'}</Text>
          <Text style={styles.title}>{completedOnly ? 'Ca khám đã hoàn thành' : 'Quản lý ca khám bệnh 🩺'}</Text>
          <Text style={styles.subtitle}>
            {completedOnly
              ? 'Chọn ca khám để lập hồ sơ bệnh án số và kê đơn thuốc cho khách hàng.'
              : 'Theo dõi tiếp nhận bệnh nhân, chẩn đoán và điều trị trong ngày.'}
          </Text>
        </View>

        {completedOnly ? (
          <View style={styles.statsRow}>
            <Stat label="Tổng ca đã khám" value={appointments.length} color={COLORS.success} icon="✅" />
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <Stat label="Tổng ca khám" value={appointments.length} color={COLORS.primary} icon="📅" />
              <Stat label="Chờ duyệt" value={counts.pending || 0} color={COLORS.warning} icon="⏳" />
              <Stat label="Đã hoàn thành" value={counts.completed || 0} color={COLORS.success} icon="✨" />
            </View>

            <View style={styles.filterSection}>
              <View style={styles.filterBar}>
                <View style={styles.datePickerWrap}>
                  <Text style={styles.dateLabel}>Ngày khám:</Text>
                  <TextInput
                    value={selectedDate}
                    onChangeText={setSelectedDate}
                    onSubmitEditing={() => loadAppointments(selectedDate)}
                    placeholder="YYYY-MM-DD"
                    style={styles.dateInput}
                    maxLength={10}
                  />
                  <TouchableOpacity style={styles.filterButton} onPress={() => loadAppointments(selectedDate)}>
                    <Text style={styles.filterButtonText}>Xem</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                  {STATUS_FILTERS.map(([value, label]) => (
                    <TouchableOpacity
                      key={value}
                      style={[styles.chip, statusFilter === value && styles.chipSelected]}
                      onPress={() => setStatusFilter(value)}
                    >
                      <Text style={statusFilter === value ? styles.chipTextSelected : styles.chipText}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : appointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.empty}>
              {completedOnly ? 'Chưa có ca khám nào hoàn thành.' : `Không có lịch khám phù hợp trong ngày ${selectedDate}.`}
            </Text>
          </View>
        ) : (
          <View style={[styles.appointmentGrid, isTabletOrDesktop && styles.appointmentGridDesktop]}>
            {appointments.map((appointment) => {
              const dateObj = new Date(appointment.appointment_datetime);
              const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              const dateStr = dateObj.toLocaleDateString('vi-VN');
              const statusCfg = statusMeta(appointment.status);

              return (
                <TouchableOpacity
                  key={appointment.id}
                  style={[styles.appointmentCard, isTabletOrDesktop && styles.appointmentCardDesktop]}
                  onPress={() => setSelectedAppointment(appointment)}
                  activeOpacity={0.8}
                >
                  <View style={styles.appointmentHeader}>
                    <View style={styles.timeBadge}>
                      <Text style={styles.timeText}>
                        {completedOnly ? `${dateStr} · ` : ''}{timeStr}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
                    </View>
                  </View>

                  <View style={styles.petInfoRow}>
                    <View style={styles.petAvatar}>
                      <Text style={styles.petAvatarText}>
                        {appointment.species === 'cat' ? '🐱' : '🐶'}
                      </Text>
                    </View>
                    <View style={styles.petTextWrap}>
                      <Text style={styles.petName}>{appointment.pet_name}</Text>
                      <Text style={styles.petSpecies}>{appointment.species} {appointment.breed ? `· ${appointment.breed}` : ''}</Text>
                    </View>
                  </View>

                  <View style={styles.detailsBox}>
                    <Text style={styles.detailText} numberOfLines={1}>
                      🏥 {appointment.service_name || 'Khám tổng quát'} · {appointment.room_name}
                    </Text>
                    <Text style={styles.ownerText} numberOfLines={1}>
                      👤 Chủ nuôi: {appointment.customer_info}
                    </Text>
                  </View>

                  {appointment.status === 'completed' && (
                    appointment.review_rating ? (
                      <View style={styles.reviewBox}>
                        <Text style={styles.reviewStars}>{'⭐'.repeat(appointment.review_rating)}</Text>
                        {appointment.review_comment ? (
                          <Text style={styles.reviewComment} numberOfLines={2}>"{appointment.review_comment}"</Text>
                        ) : null}
                      </View>
                    ) : (
                      <Text style={styles.noReview}>Chưa có đánh giá từ khách</Text>
                    )
                  )}

                  <View style={styles.cardFooter}>
                    <Text style={styles.cardActionHint}>Nhấn để xem chi tiết & xử lý →</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal chi tiết ca khám */}
      <Modal visible={Boolean(selectedAppointment)} transparent animationType="fade" onRequestClose={() => setSelectedAppointment(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            {selectedAppointment && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Chi tiết ca khám</Text>
                    <Text style={styles.modalSubtitle}>Bé: {selectedAppointment.pet_name} ({selectedAppointment.species})</Text>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedAppointment(null)}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  <View style={styles.infoSection}>
                    <InfoRow label="Giống thú cưng" value={selectedAppointment.breed || 'Chưa rõ'} />
                    <InfoRow label="Chủ nuôi" value={selectedAppointment.customer_info} />
                    <InfoRow label="Dịch vụ" value={selectedAppointment.service_name || 'Chưa có'} />
                    <InfoRow label="Phòng khám" value={selectedAppointment.room_name} />
                    <InfoRow label="Thời gian" value={new Date(selectedAppointment.appointment_datetime).toLocaleString('vi-VN')} />
                    <InfoRow label="Ghi chú khách hàng" value={selectedAppointment.notes || 'Không có ghi chú'} />
                    {selectedAppointment.review_rating ? (
                      <InfoRow
                        label="Đánh giá"
                        value={`${'⭐'.repeat(selectedAppointment.review_rating)} ${selectedAppointment.review_comment ? `("${selectedAppointment.review_comment}")` : ''}`}
                      />
                    ) : null}
                  </View>

                  <View style={styles.actions}>
                    {selectedAppointment.status === 'pending' && (
                      <Action label="Xác nhận lịch khám" color={COLORS.primary} onPress={() => updateStatus('confirmed')} />
                    )}
                    {selectedAppointment.status === 'confirmed' && (
                      <Action label="Hoàn thành khám bệnh" color={COLORS.success} onPress={() => updateStatus('completed')} />
                    )}
                    {(selectedAppointment.status === 'pending' || selectedAppointment.status === 'confirmed') && (
                      <Action label="Hủy lịch hẹn" color={COLORS.danger} onPress={() => updateStatus('cancelled')} />
                    )}
                    {selectedAppointment.status === 'completed' && (
                      <>
                        <Action label="📋 Lập hồ sơ bệnh án" color={COLORS.primaryDark} onPress={openRecordForm} />
                        <Action label="💊 Kê đơn thuốc điện tử" color={COLORS.primary} onPress={prescribeForAppointment} />
                      </>
                    )}
                  </View>
                  {saving && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Lập hồ sơ bệnh án */}
      <Modal visible={recordVisible} transparent animationType="fade" onRequestClose={() => setRecordVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Lập hồ sơ bệnh án</Text>
                <Text style={styles.modalSubtitle}>Ghi chép tình trạng và phác đồ điều trị</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setRecordVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Text style={styles.fieldLabel}>Loại hồ sơ</Text>
              <View style={styles.typeRow}>
                {RECORD_TYPES.map(([value, label]) => (
                  <TouchableOpacity
                    key={value}
                    onPress={() => setForm({ ...form, record_type: value })}
                    style={[styles.typeButton, form.record_type === value && styles.typeButtonSelected]}
                  >
                    <Text style={form.record_type === value ? styles.typeTextSelected : styles.typeText}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Field label="Tiêu đề hồ sơ" value={form.title} onChangeText={(title) => setForm({ ...form, title })} placeholder="Ví dụ: Khám tổng quát & xét nghiệm máu" />
              <Field label="Chẩn đoán lâm sàng" value={form.diagnosis} onChangeText={(diagnosis) => setForm({ ...form, diagnosis })} multiline placeholder="Mô tả kết quả khám và chẩn đoán bệnh..." />
              <Field label="Hướng điều trị & dặn dò" value={form.treatment_plan} onChangeText={(treatment_plan) => setForm({ ...form, treatment_plan })} multiline placeholder="Phác đồ điều trị, chăm sóc tại nhà..." />
              <Field label="Ngày thực hiện (YYYY-MM-DD)" value={form.performed_date} onChangeText={(performed_date) => setForm({ ...form, performed_date })} />
              <Field label="Ngày tái khám (YYYY-MM-DD, không bắt buộc)" value={form.next_due_date} onChangeText={(next_due_date) => setForm({ ...form, next_due_date })} placeholder="Để trống nếu không hẹn khám lại" />
              <TouchableOpacity style={styles.saveButton} onPress={saveRecord} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Đang lưu hồ sơ...' : 'Lưu hồ sơ bệnh án'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Kê đơn thuốc */}
      <Modal visible={prescriptionVisible} transparent animationType="fade" onRequestClose={() => setPrescriptionVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Kê đơn thuốc</Text>
                <Text style={styles.modalSubtitle}>{prescriptionContext ? `Bé ${prescriptionContext.pet_name}` : ''}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setPrescriptionVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {prescriptionItems.length === 0 ? (
                <View style={styles.emptyPrescription}>
                  <Text style={styles.emptyPrescriptionText}>Chưa có loại thuốc nào trong đơn.</Text>
                  <Text style={styles.emptyPrescriptionSub}>Bấm "+ Thêm thuốc" để chọn từ danh mục quầy thuốc.</Text>
                </View>
              ) : (
                prescriptionItems.map((item, index) => (
                  <View key={item.medicine_id} style={styles.itemRow}>
                    <View style={styles.itemHeader}>
                      <Text style={styles.itemName}>{item.name} <Text style={styles.species}>({item.unit})</Text></Text>
                      <TouchableOpacity onPress={() => removePrescriptionItem(index)}>
                        <Text style={styles.removeText}>Xóa thuốc</Text>
                      </TouchableOpacity>
                    </View>
                    <Field label="Liều dùng & cách dùng" value={item.dosage} onChangeText={(value) => updatePrescriptionItem(index, 'dosage', value)} placeholder="VD: Uống 1 viên sau ăn, ngày 2 lần" />
                    <Field label="Số lượng" value={String(item.quantity)} onChangeText={(value) => updatePrescriptionItem(index, 'quantity', value.replace(/[^0-9]/g, ''))} keyboardType="numeric" />
                  </View>
                ))
              )}

              <TouchableOpacity style={styles.addMedicineBtn} onPress={() => setMedicinePickerVisible(true)}>
                <Text style={styles.addMedicineBtnText}>+ Thêm thuốc vào đơn</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveButton} onPress={submitPrescription} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Đang lưu đơn thuốc...' : 'Hoàn tất & Lưu đơn thuốc'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Chọn thuốc */}
      <Modal visible={medicinePickerVisible} transparent animationType="fade" onRequestClose={() => setMedicinePickerVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Chọn thuốc từ kho</Text>
                <Text style={styles.modalSubtitle}>Kho thuốc đang có {medicines.length} mặt hàng</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setMedicinePickerVisible(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {medicines.map((medicine) => (
                <TouchableOpacity key={medicine.id} style={styles.pickerItem} onPress={() => addMedicineToPrescription(medicine)}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerItemName}>{medicine.name}</Text>
                    <Text style={styles.pickerItemDetail}>
                      {Number(medicine.price).toLocaleString('vi-VN')}đ / {medicine.unit} · Tồn kho: {medicine.stock_quantity}
                    </Text>
                  </View>
                  <Text style={styles.pickerAddText}>+ Chọn</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ResponsiveContainer>
  );
}

function Stat({ label, value, color, icon }) {
  return (
    <View style={styles.stat}>
      <View style={styles.statTop}>
        <Text style={styles.statIcon}>{icon}</Text>
        <Text style={[styles.statValue, { color }]}>{value}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
  );
}

function Action({ label, color, onPress }) {
  return (
    <TouchableOpacity style={[styles.action, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, multiline, placeholder, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
  );
}

function statusMeta(status) {
  switch (status) {
    case 'pending':
      return { label: 'Chờ duyệt', color: '#D97706', bg: '#FEF3C7' };
    case 'confirmed':
      return { label: 'Đã xác nhận', color: '#0D9488', bg: '#CCFBF1' };
    case 'completed':
      return { label: 'Hoàn thành', color: '#16A34A', bg: '#DCFCE7' };
    case 'cancelled':
      return { label: 'Đã hủy', color: '#DC2626', bg: '#FEE2E2' };
    default:
      return { label: status, color: '#64748B', bg: '#F1F5F9' };
  }
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
    paddingBottom: 16,
    paddingHorizontal: 16,
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
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  stat: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statIcon: {
    fontSize: 20,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '800',
  },
  statLabel: {
    color: COLORS.textSecondary,
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  filterBar: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    ...SHADOWS.sm,
  },
  datePickerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.text,
  },
  dateInput: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: 130,
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  filterButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  filterButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  chipRow: {
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
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
  appointmentGrid: {
    paddingHorizontal: 16,
    gap: 14,
  },
  appointmentGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  appointmentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  appointmentCardDesktop: {
    width: '48.8%',
  },
  appointmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  timeBadge: {
    backgroundColor: COLORS.background,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  timeText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 13,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  petInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  petAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petAvatarText: {
    fontSize: 22,
  },
  petTextWrap: {
    flex: 1,
  },
  petName: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 17,
  },
  petSpecies: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  detailsBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 10,
  },
  detailText: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  ownerText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  reviewBox: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  reviewStars: {
    fontSize: 14,
  },
  reviewComment: {
    color: COLORS.textSecondary,
    fontStyle: 'italic',
    fontSize: 13,
    marginTop: 3,
  },
  noReview: {
    color: COLORS.textTertiary || '#94A3B8',
    fontSize: 12,
    marginTop: 6,
  },
  cardFooter: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  cardActionHint: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 12,
    textAlign: 'right',
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
    maxWidth: 580,
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
  infoSection: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  infoRowLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    minWidth: 120,
  },
  infoRowValue: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
  },
  actions: {
    gap: 10,
  },
  action: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
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
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
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
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 12,
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  emptyPrescription: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    marginBottom: 14,
  },
  emptyPrescriptionText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  emptyPrescriptionSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  itemRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    backgroundColor: COLORS.background,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  itemName: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 15,
  },
  species: {
    color: COLORS.textSecondary,
    fontWeight: '400',
    fontSize: 13,
  },
  removeText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
  },
  addMedicineBtn: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  addMedicineBtnText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 14,
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
