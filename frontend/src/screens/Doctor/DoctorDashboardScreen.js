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
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { getAllAppointmentsApi, updateAppointmentStatusApi } from '../../api/appointmentApi';
import { createHealthRecordApi, getPetHealthRecordsApi } from '../../api/healthRecordApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listMedicinesApi } from '../../api/medicineApi';
import {
  createPrescriptionApi,
  getPetPrescriptionsApi,
  getPrescriptionDetailApi,
} from '../../api/prescriptionApi';

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

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const STATUS_FILTERS = [
  ['all', 'Tất cả'],
  ['pending', 'Chờ duyệt'],
  ['confirmed', 'Đã xác nhận'],
  ['completed', 'Hoàn thành'],
  ['cancelled', 'Đã hủy'],
];

const renderRatingStars = (rating) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Ionicons
        key={star}
        name={star <= rating ? 'star' : 'star-outline'}
        size={14}
        color="#F59E0B"
      />
    ))}
  </View>
);

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
  const [isPickingMedicine, setIsPickingMedicine] = useState(false);
  const [medicineSearchQuery, setMedicineSearchQuery] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');

  const [petRecords, setPetRecords] = useState([]);
  const [petPrescriptions, setPetPrescriptions] = useState([]);
  const [loadingPetMedicalInfo, setLoadingPetMedicalInfo] = useState(false);
  const [viewingPrescriptionDetail, setViewingPrescriptionDetail] = useState(null);
  const [viewPrescriptionLoading, setViewPrescriptionLoading] = useState(false);

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

  const prescriptionTotalPrice = useMemo(() => {
    return prescriptionItems.reduce((sum, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.price) || 0;
      return sum + q * p;
    }, 0);
  }, [prescriptionItems]);

  const filteredMedicines = useMemo(() => {
    if (!medicineSearchQuery.trim()) return medicines;
    const q = medicineSearchQuery.toLowerCase();
    return medicines.filter((m) =>
      m.name?.toLowerCase().includes(q) ||
      m.description?.toLowerCase().includes(q) ||
      m.unit?.toLowerCase().includes(q)
    );
  }, [medicines, medicineSearchQuery]);

  const loadPetMedicalInfo = async (petId) => {
    if (!petId) return;
    try {
      setLoadingPetMedicalInfo(true);
      const [recordsRes, prescriptionsRes] = await Promise.all([
        getPetHealthRecordsApi(petId),
        getPetPrescriptionsApi(petId),
      ]);
      setPetRecords(recordsRes.data.success ? recordsRes.data.data || [] : []);
      setPetPrescriptions(prescriptionsRes.data.success ? prescriptionsRes.data.data || [] : []);
    } catch (e) {
      setPetRecords([]);
      setPetPrescriptions([]);
    } finally {
      setLoadingPetMedicalInfo(false);
    }
  };

  useEffect(() => {
    if (selectedAppointment?.pet_id) {
      loadPetMedicalInfo(selectedAppointment.pet_id);
    } else {
      setPetRecords([]);
      setPetPrescriptions([]);
      setViewingPrescriptionDetail(null);
    }
  }, [selectedAppointment]);

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
    if (!selectedAppointment) return;
    setForm({
      record_type: 'medical',
      title: `Khám ${selectedAppointment.service_name || 'tổng quát'} - ${selectedAppointment.pet_name}`,
      diagnosis: '',
      treatment_plan: '',
      performed_date: today(),
      next_due_date: '',
    });
    setRecordVisible(true);
  };

  const saveRecord = async () => {
    if (!form.title.trim() || !form.diagnosis.trim() || !form.performed_date.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tiêu đề, chẩn đoán và ngày thực hiện.');
      return;
    }
    try {
      setSaving(true);
      const response = await createHealthRecordApi({ ...form, pet_id: selectedAppointment.pet_id });
      const recordId = response.data?.data?.record_id;
      const petName = selectedAppointment.pet_name;
      setRecordVisible(false);
      
      if (selectedAppointment?.pet_id) {
        await loadPetMedicalInfo(selectedAppointment.pet_id);
      }
      
      // Tự động mở ngay form kê đơn thuốc
      openPrescriptionForm(recordId, petName);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể lập hồ sơ bệnh án');
    } finally {
      setSaving(false);
    }
  };

  const openPrescriptionForm = (healthRecordId, petName) => {
    setPrescriptionContext({ health_record_id: healthRecordId, pet_name: petName });
    setPrescriptionItems([]);
    setPrescriptionNotes('');
    setIsPickingMedicine(false);
    setMedicineSearchQuery('');
    setPrescriptionVisible(true);
  };

  const prescribeForAppointment = async () => {
    try {
      setSaving(true);
      const user = JSON.parse((await AsyncStorage.getItem('user')) || '{}');
      const response = await getPetHealthRecordsApi(selectedAppointment.pet_id);
      const records = response.data.success ? response.data.data || [] : [];
      
      // Tìm bệnh án do bác sĩ này lập mà chưa có đơn thuốc
      const pendingRecord = records.find(
        (r) => (Number(r.doctor_id) === Number(user.id) || !r.doctor_id) && !r.prescription_id
      ) || records.find((r) => !r.prescription_id);

      if (pendingRecord) {
        openPrescriptionForm(pendingRecord.id, selectedAppointment.pet_name);
        return;
      }

      // Nếu pet chưa có bệnh án nào:
      if (records.length === 0) {
        Alert.alert(
          'Chưa có bệnh án',
          'Vui lòng nhập chẩn đoán bệnh án cho ca khám trước. Hệ thống sẽ mở ngay form kê đơn thuốc sau khi lưu.',
          [
            { text: 'Đóng', style: 'cancel' },
            { text: 'Lập bệnh án ngay', onPress: openRecordForm },
          ]
        );
        openRecordForm();
      } else {
        Alert.alert(
          'Đã có đơn thuốc',
          'Các bệnh án trước đó của bé đều đã được kê đơn thuốc. Bạn có muốn lập bệnh án mới cho ca khám này để kê thêm đơn thuốc không?',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Lập bệnh án mới', onPress: openRecordForm },
          ]
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải hồ sơ bệnh án');
    } finally {
      setSaving(false);
    }
  };

  const openViewPrescription = async (prescriptionId) => {
    try {
      setViewPrescriptionLoading(true);
      const res = await getPrescriptionDetailApi(prescriptionId);
      if (res.data.success) {
        setViewingPrescriptionDetail(res.data.data);
      }
    } catch (e) {
      Alert.alert('Lỗi', 'Không thể tải chi tiết đơn thuốc');
    } finally {
      setViewPrescriptionLoading(false);
    }
  };

  const addMedicineToPrescription = (medicine) => {
    if (prescriptionItems.some((item) => item.medicine_id === medicine.id)) {
      return;
    }
    setPrescriptionItems((prev) => [
      ...prev,
      {
        medicine_id: medicine.id,
        name: medicine.name,
        unit: medicine.unit,
        price: Number(medicine.price),
        dosage: '',
        quantity: '1',
      },
    ]);
  };

  const updatePrescriptionItem = (index, field, value) => {
    setPrescriptionItems(prescriptionItems.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const removePrescriptionItem = (index) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  const submitPrescription = async () => {
    if (prescriptionItems.length === 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng thêm ít nhất 1 loại thuốc vào đơn.');
      return;
    }
    for (const item of prescriptionItems) {
      if (!item.dosage || !item.dosage.trim()) {
        Alert.alert('Thiếu thông tin', `Vui lòng nhập liều dùng cho thuốc "${item.name}".`);
        return;
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        Alert.alert('Thiếu thông tin', `Vui lòng nhập số lượng hợp lệ cho thuốc "${item.name}".`);
        return;
      }
    }
    try {
      setSaving(true);
      await createPrescriptionApi({
        health_record_id: prescriptionContext.health_record_id,
        notes: prescriptionNotes.trim() || undefined,
        items: prescriptionItems.map((item) => ({
          medicine_id: item.medicine_id,
          dosage: item.dosage.trim(),
          quantity: Number(item.quantity),
        })),
      });
      setPrescriptionVisible(false);
      setPrescriptionItems([]);
      setPrescriptionNotes('');
      setIsPickingMedicine(false);
      Alert.alert('Thành công', 'Đã kê đơn thuốc thành công! Khách hàng có thể xem đơn thuốc và thanh toán tại quầy.');
      if (selectedAppointment?.pet_id) {
        await loadPetMedicalInfo(selectedAppointment.pet_id);
      }
      await loadAppointments();
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <Text style={styles.title}>{completedOnly ? 'Ca khám đã hoàn thành' : 'Quản lý ca khám bệnh'}</Text>
            {!completedOnly && <FontAwesome5 name="stethoscope" size={20} color={COLORS.primary} />}
          </View>
          <Text style={styles.subtitle}>
            {completedOnly
              ? 'Chọn ca khám để lập hồ sơ bệnh án số và kê đơn thuốc cho khách hàng.'
              : 'Theo dõi tiếp nhận bệnh nhân, chẩn đoán và điều trị trong ngày.'}
          </Text>
        </View>

        {completedOnly ? (
          <View style={styles.statsRow}>
            <Stat label="Tổng ca đã khám" value={appointments.length} color={COLORS.success} icon={<Ionicons name="checkmark-circle-outline" size={22} color={COLORS.success} />} />
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              <Stat label="Tổng ca khám" value={appointments.length} color={COLORS.primary} icon={<Ionicons name="calendar-outline" size={22} color={COLORS.primary} />} />
              <Stat label="Chờ duyệt" value={counts.pending || 0} color={COLORS.warning} icon={<Ionicons name="hourglass-outline" size={22} color={COLORS.warning} />} />
              <Stat label="Đã hoàn thành" value={counts.completed || 0} color={COLORS.success} icon={<Ionicons name="sparkles-outline" size={22} color={COLORS.success} />} />
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
            <Ionicons name="clipboard-outline" size={40} color={COLORS.textTertiary || '#94A3B8'} style={{ marginBottom: 12 }} />
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
                      <FontAwesome5
                        name={appointment.species === 'cat' ? 'cat' : 'dog'}
                        size={18}
                        color={COLORS.primaryDark}
                      />
                    </View>
                    <View style={styles.petTextWrap}>
                      <Text style={styles.petName}>{appointment.pet_name}</Text>
                      <Text style={styles.petSpecies}>{appointment.species} {appointment.breed ? `· ${appointment.breed}` : ''}</Text>
                    </View>
                  </View>

                  <View style={styles.detailsBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <FontAwesome5 name="hospital" size={12} color={COLORS.primary} />
                      <Text style={styles.detailText} numberOfLines={1}>
                        {appointment.service_name || 'Khám tổng quát'} · {appointment.room_name}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="person-outline" size={13} color={COLORS.textSecondary} />
                      <Text style={styles.ownerText} numberOfLines={1}>
                        Chủ nuôi: {appointment.customer_info}
                      </Text>
                    </View>
                  </View>

                  {appointment.status === 'completed' && (
                    appointment.review_rating ? (
                      <View style={styles.reviewBox}>
                        {renderRatingStars(appointment.review_rating)}
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
                    <Ionicons name="close" size={18} color={COLORS.textSecondary} />
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
                      <View style={styles.infoRow}>
                        <Text style={styles.infoRowLabel}>Đánh giá</Text>
                        <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
                          {renderRatingStars(selectedAppointment.review_rating)}
                          {selectedAppointment.review_comment ? (
                            <Text style={[styles.infoRowValue, { fontStyle: 'italic', fontSize: 12 }]}>
                              "{selectedAppointment.review_comment}"
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </View>

                  {selectedAppointment.status === 'completed' && (
                    <View style={styles.medicalHistorySection}>
                      <View style={styles.sectionHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <FontAwesome5 name="notes-medical" size={15} color={COLORS.primary} />
                          <Text style={styles.sectionTitle}>Hồ sơ & Đơn thuốc của bé</Text>
                        </View>
                        {loadingPetMedicalInfo && <ActivityIndicator size="small" color={COLORS.primary} />}
                      </View>

                      {/* Đơn thuốc đã có của bé */}
                      {petPrescriptions.length > 0 ? (
                        <View style={styles.prescriptionCardsBox}>
                          <Text style={styles.subSectionTitle}>
                            Đơn thuốc đã kê ({petPrescriptions.length}):
                          </Text>
                          {petPrescriptions.map((pres) => (
                            <TouchableOpacity
                              key={pres.id}
                              style={styles.prescriptionCardItem}
                              onPress={() => openViewPrescription(pres.id)}
                            >
                              <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                  <MaterialCommunityIcons name="pill" size={16} color={COLORS.primary} />
                                  <Text style={styles.prescriptionCode}>Đơn thuốc #{pres.id}</Text>
                                </View>
                                <Text style={styles.prescriptionDate}>
                                  {new Date(pres.created_at).toLocaleDateString('vi-VN')} · BS. {pres.doctor_name || 'Phụ trách'}
                                </Text>
                                {pres.health_record_title ? (
                                  <Text style={styles.prescriptionRecordTitle} numberOfLines={1}>
                                    Bệnh án: {pres.health_record_title}
                                  </Text>
                                ) : null}
                              </View>
                              <View style={styles.viewPrescriptionBadge}>
                                <Text style={styles.viewPrescriptionText}>Xem đơn →</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                        </View>
                      ) : (
                        <View style={styles.emptyMedicalBox}>
                          <MaterialCommunityIcons name="clipboard-text-outline" size={22} color={COLORS.textTertiary || '#94A3B8'} />
                          <Text style={styles.emptyMedicalText}>Bé chưa có đơn thuốc nào được kê trước đây.</Text>
                        </View>
                      )}

                      {/* Thông báo nếu có bệnh án chưa kê đơn */}
                      {petRecords.length > 0 && petRecords.some((r) => !r.prescription_id) && (
                        <View style={styles.pendingPrescriptionAlert}>
                          <Ionicons name="information-circle" size={18} color="#D97706" />
                          <Text style={styles.pendingPrescriptionAlertText}>
                            Có bệnh án chưa kê đơn thuốc. Bạn có thể nhấn nút "Kê đơn thuốc điện tử" bên dưới để kê ngay.
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.actions}>
                    {selectedAppointment.status === 'pending' && (
                      <Action label="Xác nhận lịch khám" icon={<Ionicons name="checkmark-circle-outline" size={18} color="#fff" />} color={COLORS.primary} onPress={() => updateStatus('confirmed')} />
                    )}
                    {selectedAppointment.status === 'confirmed' && (
                      <Action label="Hoàn thành khám bệnh" icon={<Ionicons name="checkbox-outline" size={18} color="#fff" />} color={COLORS.success} onPress={() => updateStatus('completed')} />
                    )}
                    {(selectedAppointment.status === 'pending' || selectedAppointment.status === 'confirmed') && (
                      <Action label="Hủy lịch hẹn" icon={<Ionicons name="close-circle-outline" size={18} color="#fff" />} color={COLORS.danger} onPress={() => updateStatus('cancelled')} />
                    )}
                    {selectedAppointment.status === 'completed' && (
                      <>
                        <Action label="Lập hồ sơ bệnh án" icon={<Ionicons name="document-text-outline" size={18} color="#fff" />} color={COLORS.primaryDark} onPress={openRecordForm} />
                        <Action label="Kê đơn thuốc điện tử" icon={<MaterialCommunityIcons name="pill" size={18} color="#fff" />} color={COLORS.primary} onPress={prescribeForAppointment} />
                      </>
                    )}
                  </View>
                  {(saving || viewPrescriptionLoading) && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 16 }} />}
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
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
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
            {isPickingMedicine ? (
              /* MÀN HÌNH CHỌN THUỐC TỪ KHO */
              <>
                <View style={styles.modalHeader}>
                  <TouchableOpacity
                    style={styles.backPickerBtn}
                    onPress={() => setIsPickingMedicine(false)}
                  >
                    <Ionicons name="arrow-back" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.modalTitle}>Chọn thuốc từ kho dược</Text>
                    <Text style={styles.modalSubtitle}>Đã chọn {prescriptionItems.length} loại thuốc vào đơn</Text>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setIsPickingMedicine(false)}>
                    <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                {/* Ô tìm kiếm thuốc */}
                <View style={styles.pickerSearchContainer}>
                  <Ionicons name="search" size={18} color={COLORS.textSecondary} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.pickerSearchInput}
                    placeholder="Tìm tên thuốc, công dụng..."
                    placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
                    value={medicineSearchQuery}
                    onChangeText={setMedicineSearchQuery}
                  />
                  {medicineSearchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setMedicineSearchQuery('')}>
                      <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Danh sách thuốc */}
                <ScrollView style={styles.modalScroll}>
                  {filteredMedicines.length === 0 ? (
                    <View style={styles.emptyPickerContainer}>
                      <Text style={styles.emptyPickerText}>Không tìm thấy thuốc phù hợp</Text>
                    </View>
                  ) : (
                    filteredMedicines.map((medicine) => {
                      const isAdded = prescriptionItems.some((item) => item.medicine_id === medicine.id);
                      return (
                        <View key={medicine.id} style={styles.pickerItemRow}>
                          <View style={{ flex: 1, marginRight: 12 }}>
                            <Text style={styles.pickerItemName}>{medicine.name}</Text>
                            <Text style={styles.pickerItemDetail}>
                              {Number(medicine.price).toLocaleString('vi-VN')} đ / {medicine.unit} · Tồn kho: {medicine.stock_quantity ?? 0}
                            </Text>
                          </View>
                          {isAdded ? (
                            <TouchableOpacity
                              style={styles.pickerAddedBadge}
                              onPress={() => {
                                const idx = prescriptionItems.findIndex((it) => it.medicine_id === medicine.id);
                                if (idx !== -1) removePrescriptionItem(idx);
                              }}
                            >
                              <Ionicons name="checkmark-circle" size={16} color="#16A34A" />
                              <Text style={styles.pickerAddedText}>Đã chọn (Bỏ)</Text>
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              style={styles.pickerSelectBtn}
                              onPress={() => addMedicineToPrescription(medicine)}
                            >
                              <Ionicons name="add" size={16} color="#fff" />
                              <Text style={styles.pickerSelectBtnText}>Thêm</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })
                  )}
                </ScrollView>

                {/* Footer quay lại đơn */}
                <View style={styles.pickerFooter}>
                  <TouchableOpacity
                    style={styles.pickerDoneBtn}
                    onPress={() => setIsPickingMedicine(false)}
                  >
                    <Text style={styles.pickerDoneBtnText}>
                      Xong ({prescriptionItems.length} loại) → Tiếp tục kê đơn
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              /* MÀN HÌNH DANH SÁCH THUỐC TRONG ĐƠN */
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Kê đơn thuốc điện tử</Text>
                    <Text style={styles.modalSubtitle}>
                      {prescriptionContext ? `Bé: ${prescriptionContext.pet_name} · Bệnh án #${prescriptionContext.health_record_id}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setPrescriptionVisible(false)}>
                    <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  {prescriptionItems.length === 0 ? (
                    <View style={styles.emptyPrescription}>
                      <MaterialCommunityIcons name="pill" size={42} color={COLORS.primary} style={{ marginBottom: 10 }} />
                      <Text style={styles.emptyPrescriptionText}>Chưa có loại thuốc nào trong đơn</Text>
                      <Text style={styles.emptyPrescriptionSub}>Bấm "+ Thêm thuốc từ kho dược" bên dưới để chọn thuốc kê cho bé.</Text>
                    </View>
                  ) : (
                    prescriptionItems.map((item, index) => (
                      <View key={item.medicine_id} style={styles.itemRow}>
                        <View style={styles.itemHeader}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.itemName}>
                              {index + 1}. {item.name} <Text style={styles.species}>({item.unit})</Text>
                            </Text>
                            <Text style={styles.itemPriceText}>
                              Đơn giá: {Number(item.price).toLocaleString('vi-VN')} đ / {item.unit}
                            </Text>
                          </View>
                          <TouchableOpacity
                            style={styles.removeBtn}
                            onPress={() => removePrescriptionItem(index)}
                          >
                            <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                            <Text style={styles.removeText}>Xóa</Text>
                          </TouchableOpacity>
                        </View>

                        <Field
                          label="Liều dùng & cách dùng *"
                          value={item.dosage}
                          onChangeText={(value) => updatePrescriptionItem(index, 'dosage', value)}
                          placeholder="VD: Uống 1 viên sau ăn, ngày 2 lần sáng/tối"
                        />
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                          <View style={{ flex: 1 }}>
                            <Field
                              label="Số lượng *"
                              value={String(item.quantity)}
                              onChangeText={(value) => updatePrescriptionItem(index, 'quantity', value.replace(/[^0-9]/g, ''))}
                              keyboardType="numeric"
                              placeholder="Số lượng"
                            />
                          </View>
                          <View style={{ flex: 1, paddingBottom: 12 }}>
                            <Text style={styles.fieldLabel}>Thành tiền</Text>
                            <View style={styles.subtotalBox}>
                              <Text style={styles.subtotalText}>
                                {((Number(item.quantity) || 0) * (Number(item.price) || 0)).toLocaleString('vi-VN')} đ
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))
                  )}

                  <TouchableOpacity style={styles.addMedicineBtn} onPress={() => setIsPickingMedicine(true)}>
                    <Ionicons name="add-circle-outline" size={18} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                    <Text style={styles.addMedicineBtnText}>+ Thêm thuốc từ kho dược</Text>
                  </TouchableOpacity>

                  {/* Ghi chú dặn dò chung */}
                  <Field
                    label="Ghi chú & lời dặn của bác sĩ"
                    value={prescriptionNotes}
                    onChangeText={setPrescriptionNotes}
                    multiline
                    placeholder="VD: Cho bé uống nhiều nước, tái khám sau 3 ngày nếu không đỡ..."
                  />

                  {/* Tổng tiền dự kiến */}
                  {prescriptionItems.length > 0 && (
                    <View style={styles.prescriptionTotalRow}>
                      <Text style={styles.totalPriceLabel}>Tổng tiền thuốc dự kiến:</Text>
                      <Text style={styles.totalPriceValue}>
                        {prescriptionTotalPrice.toLocaleString('vi-VN')} đ
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.saveButton, saving && { opacity: 0.7 }]}
                    onPress={submitPrescription}
                    disabled={saving}
                  >
                    {saving ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                        <Ionicons name="checkmark-done-circle-outline" size={20} color="#fff" />
                        <Text style={styles.saveText}>Hoàn tất & Lưu đơn thuốc</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Modal Xem chi tiết đơn thuốc */}
      <Modal visible={Boolean(viewingPrescriptionDetail)} transparent animationType="fade" onRequestClose={() => setViewingPrescriptionDetail(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            {viewingPrescriptionDetail && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>Chi tiết đơn thuốc #{viewingPrescriptionDetail.id}</Text>
                    <Text style={styles.modalSubtitle}>
                      Bé: {selectedAppointment?.pet_name || ''} · Ngày kê: {new Date(viewingPrescriptionDetail.created_at).toLocaleDateString('vi-VN')}
                    </Text>
                  </View>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setViewingPrescriptionDetail(null)}>
                    <Ionicons name="close" size={18} color={COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalScroll}>
                  {viewingPrescriptionDetail.notes ? (
                    <View style={styles.viewPresNoteBox}>
                      <Text style={styles.viewPresNoteLabel}>Lời dặn của bác sĩ:</Text>
                      <Text style={styles.viewPresNoteValue}>{viewingPrescriptionDetail.notes}</Text>
                    </View>
                  ) : null}

                  <Text style={styles.subSectionTitle}>Danh mục thuốc được kê:</Text>
                  {viewingPrescriptionDetail.items && viewingPrescriptionDetail.items.length > 0 ? (
                    viewingPrescriptionDetail.items.map((it, idx) => (
                      <View key={it.id || idx} style={styles.viewPresItem}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={styles.viewPresItemName}>
                            {idx + 1}. {it.medicine_name}
                          </Text>
                          <Text style={styles.viewPresItemTotal}>
                            {(Number(it.quantity) * Number(it.unit_price)).toLocaleString('vi-VN')} đ
                          </Text>
                        </View>
                        <Text style={styles.viewPresItemDosage}>
                          Liều dùng: {it.dosage}
                        </Text>
                        <Text style={styles.viewPresItemMeta}>
                          Số lượng: {it.quantity} {it.unit} · Đơn giá: {Number(it.unit_price).toLocaleString('vi-VN')} đ
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ color: COLORS.textSecondary, fontStyle: 'italic', marginVertical: 8 }}>
                      Không có thông tin chi tiết thuốc.
                    </Text>
                  )}

                  {viewingPrescriptionDetail.items && viewingPrescriptionDetail.items.length > 0 && (
                    <View style={styles.viewPresTotalBox}>
                      <Text style={styles.viewPresTotalLabel}>Tổng chi phí đơn thuốc:</Text>
                      <Text style={styles.viewPresTotalValue}>
                        {viewingPrescriptionDetail.items.reduce(
                          (acc, cur) => acc + Number(cur.quantity) * Number(cur.unit_price),
                          0
                        ).toLocaleString('vi-VN')} đ
                      </Text>
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.saveButton, { backgroundColor: COLORS.textSecondary, marginTop: 20 }]}
                    onPress={() => setViewingPrescriptionDetail(null)}
                  >
                    <Text style={styles.saveText}>Đóng</Text>
                  </TouchableOpacity>
                </ScrollView>
              </>
            )}
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
        <View>{icon}</View>
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

function Action({ label, icon, color, onPress }) {
  return (
    <TouchableOpacity style={[styles.action, { backgroundColor: color }]} onPress={onPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {icon}
        <Text style={styles.actionText}>{label}</Text>
      </View>
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
  // Medical history section in appointment modal
  medicalHistorySection: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  prescriptionCardsBox: {
    gap: 8,
  },
  subSectionTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  prescriptionCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  prescriptionCode: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 14,
  },
  prescriptionDate: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  prescriptionRecordTitle: {
    color: COLORS.text,
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
  },
  viewPrescriptionBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  viewPrescriptionText: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 12,
  },
  emptyMedicalBox: {
    alignItems: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  emptyMedicalText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  pendingPrescriptionAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF3C7',
    padding: 10,
    borderRadius: 10,
    marginTop: 10,
  },
  pendingPrescriptionAlertText: {
    flex: 1,
    color: '#92400E',
    fontSize: 12,
    fontWeight: '600',
  },

  // Medicine Picker Inline View
  backPickerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  pickerSearchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    padding: 0,
  },
  emptyPickerContainer: {
    padding: 24,
    alignItems: 'center',
  },
  emptyPickerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  pickerItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
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
  pickerAddedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#DCFCE7',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  pickerAddedText: {
    color: '#16A34A',
    fontWeight: '700',
    fontSize: 12,
  },
  pickerSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primary,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pickerSelectBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  pickerFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    marginTop: 8,
  },
  pickerDoneBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  pickerDoneBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  // Prescription Form
  emptyPrescription: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: 14,
    marginBottom: 14,
  },
  emptyPrescriptionText: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 15,
  },
  emptyPrescriptionSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  itemRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    backgroundColor: COLORS.background,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  itemPriceText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  removeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  removeText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  subtotalBox: {
    height: 42,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  subtotalText: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 14,
  },
  addMedicineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  addMedicineBtnText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 14,
  },
  prescriptionTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 14,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  totalPriceLabel: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  totalPriceValue: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 16,
  },

  // View Prescription Detail Modal
  viewPresNoteBox: {
    backgroundColor: COLORS.background,
    padding: 12,
    borderRadius: 10,
    marginBottom: 14,
  },
  viewPresNoteLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  viewPresNoteValue: {
    color: COLORS.text,
    fontSize: 13,
    fontStyle: 'italic',
  },
  viewPresItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  viewPresItemName: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  viewPresItemTotal: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 14,
  },
  viewPresItemDosage: {
    color: COLORS.text,
    fontSize: 13,
    marginTop: 2,
  },
  viewPresItemMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  viewPresTotalBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 2,
    borderTopColor: COLORS.border,
  },
  viewPresTotalLabel: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 15,
  },
  viewPresTotalValue: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 18,
  },
});
