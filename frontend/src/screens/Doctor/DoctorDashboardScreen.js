import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import DateTimeFilterBar, { matchesDateTimeFilter } from '../../components/DateTimeFilterBar';
import { useResponsive } from '../../utils/responsive';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  getAllAppointmentsApi,
  updateAppointmentStatusApi,
  updateAppointmentServicesApi,
  createWalkInAppointmentApi,
} from '../../api/appointmentApi';
import { createHealthRecordApi, getPetHealthRecordsApi } from '../../api/healthRecordApi';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { listMedicinesApi } from '../../api/medicineApi';
import {
  createPrescriptionApi,
  getPetPrescriptionsApi,
  getPrescriptionDetailApi,
} from '../../api/prescriptionApi';
import { getMyRoomServicesApi, lookupCustomerByPhoneApi } from '../../api/invoiceApi';

const SPECIES_OPTIONS = [
  { value: 'dog', label: 'Chó', icon: 'dog' },
  { value: 'cat', label: 'Mèo', icon: 'cat' },
  { value: 'other', label: 'Khác', icon: 'paw' },
];

const formatSpeciesLabel = (species) => {
  if (!species) return 'Khác';
  const s = String(species).toLowerCase();
  if (s === 'dog' || s.includes('chó')) return 'Chó';
  if (s === 'cat' || s.includes('mèo')) return 'Mèo';
  return 'Khác';
};

const getSpeciesIconName = (species) => {
  if (!species) return 'paw';
  const s = String(species).toLowerCase();
  if (s === 'dog' || s.includes('chó')) return 'dog';
  if (s === 'cat' || s.includes('mèo')) return 'cat';
  return 'paw';
};

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
  const [selectedTime, setSelectedTime] = useState('');
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

  // State cho Chỉ định Dịch vụ Khám (Đa phòng - Tự động đồng bộ sang Thu ngân) & Tiếp nhận vãng lai
  const [doctorRoom, setDoctorRoom] = useState(null);
  const [allRooms, setAllRooms] = useState([]);
  const [roomServices, setRoomServices] = useState([]);
  const [serviceRoomFilter, setServiceRoomFilter] = useState('all'); // 'all' | room_id
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceModalMode, setInvoiceModalMode] = useState('appointment'); // 'appointment' | 'walk_in'
  const [invoiceTargetAppointment, setInvoiceTargetAppointment] = useState(null);
  const [bookedServiceIds, setBookedServiceIds] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  // State cho Tiếp nhận ca khám vãng lai
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [walkInCustomerPhone, setWalkInCustomerPhone] = useState('');
  const [walkInPetName, setWalkInPetName] = useState('');
  const [walkInPetSpecies, setWalkInPetSpecies] = useState('dog');
  const [walkInNotes, setWalkInNotes] = useState('');
  const [walkInFoundUser, setWalkInFoundUser] = useState(null);
  const [walkInFoundPets, setWalkInFoundPets] = useState([]);
  const [walkInSelectedPetId, setWalkInSelectedPetId] = useState(null);
  const [walkInSearchingPhone, setWalkInSearchingPhone] = useState(false);
  const [walkInLookupMessage, setWalkInLookupMessage] = useState('');

  const loadDoctorRoomAndServices = async (roomId) => {
    try {
      setInvoiceLoading(true);
      const res = await getMyRoomServicesApi(roomId);
      if (res.data.success && res.data.data) {
        setDoctorRoom(res.data.data.room || null);
        setAllRooms(res.data.data.rooms || []);
        setRoomServices(res.data.data.services || []);
        return res.data.data;
      }
    } catch (e) {
      // Bỏ qua nếu chưa có phòng
    } finally {
      setInvoiceLoading(false);
    }
    return null;
  };

  const loadAppointments = async (date = selectedDate, status = statusFilter) => {
    try {
      setLoading(true);
      const params = completedOnly
        ? { status: 'completed', ...(date ? { date } : {}) }
        : { ...(date ? { date } : {}), ...(status !== 'all' ? { status } : {}) };
      const response = await getAllAppointmentsApi(params);
      setAppointments(response.data.success ? response.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải lịch khám');
    } finally {
      setLoading(false);
    }
  };

  const displayedAppointments = useMemo(() => {
    return appointments.filter((a) =>
      matchesDateTimeFilter(a.appointment_datetime, selectedDate, selectedTime)
    );
  }, [appointments, selectedDate, selectedTime]);

  useFocusEffect(useCallback(() => {
    loadAppointments(selectedDate, statusFilter);
    loadDoctorRoomAndServices();
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

  const invoiceCalculatedTotal = useMemo(() => {
    return roomServices
      .filter((s) => selectedServiceIds.includes(Number(s.id)))
      .reduce((sum, s) => sum + Number(s.price || 0), 0);
  }, [roomServices, selectedServiceIds]);

  const displayedServicesForModal = useMemo(() => {
    if (serviceRoomFilter === 'all') return roomServices;
    return roomServices.filter((s) => Number(s.room_id) === Number(serviceRoomFilter));
  }, [roomServices, serviceRoomFilter]);

  const toggleInvoiceService = (serviceId) => {
    const numId = Number(serviceId);
    setSelectedServiceIds((prev) =>
      prev.includes(numId) ? prev.filter((id) => id !== numId) : [...prev, numId]
    );
  };

  const openAppointmentServiceModal = async (appointment) => {
    if (!appointment) return;
    if (appointment.invoice_id && appointment.invoice_payment_status !== 'pending') {
      Alert.alert('Đã thanh toán', 'Ca khám này đã được Thu ngân thu tiền nên không thể thay đổi dịch vụ.');
      return;
    }
    setInvoiceModalMode('appointment');
    setInvoiceTargetAppointment(appointment);
    const defaultIds = Array.isArray(appointment.service_ids) && appointment.service_ids.length > 0
      ? appointment.service_ids.map(Number)
      : appointment.service_id
      ? [Number(appointment.service_id)]
      : [];
    setBookedServiceIds(defaultIds);
    setSelectedServiceIds(defaultIds);
    setServiceRoomFilter('all');
    setInvoiceModalVisible(true);
    await loadDoctorRoomAndServices(appointment.room_id);
  };

  const openWalkInAppointmentModal = async () => {
    setInvoiceModalMode('walk_in');
    setInvoiceTargetAppointment(null);
    setWalkInCustomerName('');
    setWalkInCustomerPhone('');
    setWalkInPetName('');
    setWalkInPetSpecies('dog');
    setWalkInNotes('');
    setWalkInFoundUser(null);
    setWalkInFoundPets([]);
    setWalkInSelectedPetId(null);
    setWalkInLookupMessage('');
    setBookedServiceIds([]);
    setSelectedServiceIds([]);
    setInvoiceModalVisible(true);

    const data = await loadDoctorRoomAndServices();
    const myRoom = data?.room || doctorRoom;
    const allSvcs = data?.services || roomServices;
    if (myRoom?.id) {
      setServiceRoomFilter(myRoom.id);
      const firstOwnService = allSvcs.find((s) => Number(s.room_id) === Number(myRoom.id));
      if (firstOwnService) {
        setSelectedServiceIds([Number(firstOwnService.id)]);
      }
    } else {
      setServiceRoomFilter('all');
      if (allSvcs.length > 0) {
        setSelectedServiceIds([Number(allSvcs[0].id)]);
      }
    }
  };

  const handleLookupWalkInCustomerByPhone = async () => {
    const phone = walkInCustomerPhone.trim();
    if (!phone) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số điện thoại khách hàng để tra cứu.');
      return;
    }
    try {
      setWalkInSearchingPhone(true);
      setWalkInLookupMessage('');
      const res = await lookupCustomerByPhoneApi(phone);
      if (res.data?.success && res.data?.data?.user) {
        const { user: foundUser, pets: foundPets = [] } = res.data.data;
        setWalkInFoundUser(foundUser);
        setWalkInFoundPets(foundPets);
        setWalkInCustomerName(foundUser.full_name || '');
        if (foundPets.length > 0) {
          const firstPet = foundPets[0];
          setWalkInSelectedPetId(firstPet.id);
          setWalkInPetName(firstPet.name || '');
          setWalkInPetSpecies(
            ['dog', 'cat', 'other'].includes(firstPet.species) ? firstPet.species : 'dog'
          );
        } else {
          setWalkInSelectedPetId(null);
        }
        setWalkInLookupMessage(`Đã tìm thấy khách hàng: ${foundUser.full_name}`);
      }
    } catch (error) {
      setWalkInFoundUser(null);
      setWalkInFoundPets([]);
      setWalkInSelectedPetId(null);
      setWalkInLookupMessage(
        'Khách mới chưa có tài khoản — bạn có thể nhập trực tiếp tên chủ nuôi & thú cưng bên dưới.'
      );
    } finally {
      setWalkInSearchingPhone(false);
    }
  };

  const handleSelectWalkInPet = (pet) => {
    if (!pet) {
      setWalkInSelectedPetId(null);
      setWalkInPetName('');
      setWalkInPetSpecies('dog');
      return;
    }
    setWalkInSelectedPetId(pet.id);
    setWalkInPetName(pet.name || '');
    setWalkInPetSpecies(['dog', 'cat', 'other'].includes(pet.species) ? pet.species : 'dog');
  };

  const submitWalkInAppointment = async () => {
    if (!walkInCustomerName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ tên chủ nuôi.');
      return;
    }
    if (!walkInPetName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thú cưng.');
      return;
    }
    if (selectedServiceIds.length === 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ít nhất 1 dịch vụ khám ban đầu.');
      return;
    }
    try {
      setInvoiceSaving(true);
      const res = await createWalkInAppointmentApi({
        customer_name: walkInCustomerName.trim(),
        customer_phone: walkInCustomerPhone.trim() || undefined,
        user_id: walkInFoundUser?.id || undefined,
        pet_id: walkInSelectedPetId || undefined,
        pet_name: walkInPetName.trim(),
        pet_species: walkInPetSpecies,
        service_ids: selectedServiceIds,
        notes: walkInNotes.trim() || undefined,
      });
      if (res.data?.success) {
        setInvoiceModalVisible(false);
        const todayStr = today();
        setSelectedDate(todayStr);
        await loadAppointments(todayStr, statusFilter);
        Alert.alert(
          'Đã tiếp nhận khách vãng lai',
          'Ca khám đã được tạo ở trạng thái "Đã xác nhận" (Đang khám). Bạn có thể chỉ định thêm dịch vụ đa phòng, lập bệnh án, kê đơn thuốc và hoàn thành ca khám để tự động chuyển sang Quầy Thu Ngân.'
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tiếp nhận ca khám vãng lai');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const submitAssignedServices = async () => {
    if (!invoiceTargetAppointment) return;
    if (selectedServiceIds.length === 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ít nhất 1 dịch vụ khám thực tế cho thú cưng.');
      return;
    }
    try {
      setInvoiceSaving(true);
      const res = await updateAppointmentServicesApi(
        invoiceTargetAppointment.id,
        selectedServiceIds
      );
      if (res.data?.success) {
        const updatedServices = roomServices.filter((s) =>
          selectedServiceIds.includes(Number(s.id))
        );
        const updatedServiceName =
          res.data.data?.service_name ||
          updatedServices
            .map((s) => `${s.service_name}${s.room_code ? ` (${s.room_code})` : ''}`)
            .join(', ');
        const updatedTotal = res.data.data?.price ?? res.data.data?.total_amount ?? invoiceCalculatedTotal;

        await loadAppointments();
        if (selectedAppointment && selectedAppointment.id === invoiceTargetAppointment.id) {
          setSelectedAppointment((prev) =>
            prev
              ? {
                  ...prev,
                  service_ids: selectedServiceIds,
                  service_name: updatedServiceName || prev.service_name,
                  price: updatedTotal,
                  invoice_total: prev.invoice_id ? updatedTotal : prev.invoice_total,
                }
              : null
          );
        }
        setInvoiceModalVisible(false);
        Alert.alert(
          'Đã cập nhật dịch vụ khám',
          'Danh sách dịch vụ thực tế đã được lưu và tự động đẩy sang hóa đơn chờ tại Quầy Thu Ngân.'
        );
      }
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể cập nhật dịch vụ khám');
    } finally {
      setInvoiceSaving(false);
    }
  };

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

  const updateStatus = async (status, extraPayload = {}) => {
    try {
      setSaving(true);
      const res = await updateAppointmentStatusApi(selectedAppointment.id, { status, ...extraPayload });
      setSelectedAppointment(null);
      await loadAppointments();
      if ((status === 'completed' || extraPayload.is_no_show) && res.data?.message) {
        Alert.alert('Thông báo', res.data.message);
      }
    } catch (error) {
      Alert.alert('Chưa thể hoàn thành', error.response?.data?.message || 'Không thể cập nhật lịch khám');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkNoShow = () => {
    if (!selectedAppointment) return;
    Alert.alert(
      'Xác nhận khách vắng mặt (No-Show)',
      `Đánh dấu chủ nuôi của bé "${selectedAppointment.pet_name}" không đến khám theo lịch đã xác nhận?\n\n• Giải phóng ngay slot phòng khám\n• Ghi nhận 1 lượt bỏ lịch (2 điểm vi phạm) vào hệ thống chống spam`,
      [
        { text: 'Quay lại', style: 'cancel' },
        {
          text: 'Xác nhận vắng mặt',
          style: 'destructive',
          onPress: () => updateStatus('cancelled', { is_no_show: true }),
        },
      ]
    );
  };

  const openRecordForm = () => {
    if (!selectedAppointment) return;
    const defaultTitle = selectedAppointment.is_referred_case
      ? `Kết quả chuyên khoa (${doctorRoom?.room_code || 'Phòng phối hợp'}) - ${selectedAppointment.pet_name}`
      : `Khám ${selectedAppointment.service_name || 'tổng quát'} - ${selectedAppointment.pet_name}`;
    setForm({
      record_type: 'medical',
      title: defaultTitle,
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
      const isReferredCase = Boolean(selectedAppointment?.is_referred_case);
      setRecordVisible(false);
      
      if (selectedAppointment?.pet_id) {
        await loadPetMedicalInfo(selectedAppointment.pet_id);
      }
      
      if (isReferredCase) {
        Alert.alert(
          'Đã lưu kết quả chuyên khoa',
          `Kết quả khám và đề xuất thuốc đã được lưu vào hồ sơ của bé. Bác sĩ phòng tiếp nhận chính (${selectedAppointment?.room_code || 'phòng gốc'}) sẽ tổng hợp kết quả này để kê đơn thuốc cuối cùng.`
        );
      } else {
        // Phòng tiếp nhận chính: tự động mở ngay form kê đơn thuốc tổng hợp
        openPrescriptionForm(recordId, petName);
      }
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
    if (selectedAppointment?.is_referred_case) {
      Alert.alert(
        'Ca khám phối hợp liên phòng',
        `Theo quy tắc phối hợp liên phòng, phòng chuyên khoa chỉ lập Hồ sơ kết quả khám và ghi đề xuất thuốc. Bác sĩ phòng tiếp nhận chính (${selectedAppointment?.room_code || 'phòng gốc'}) sẽ tổng hợp và kê 1 đơn thuốc duy nhất cho bé.`
      );
      return;
    }
    try {
      setSaving(true);
      const user = JSON.parse((await AsyncStorage.getItem('user')) || '{}');
      const response = await getPetHealthRecordsApi(selectedAppointment.pet_id);
      const records = response.data.success ? response.data.data || [] : [];
      
      // Ưu tiên bệnh án do bác sĩ phòng gốc lập, hoặc hồ sơ chuyên khoa chuyển về chưa kê đơn
      const pendingRecord =
        records.find((r) => Number(r.doctor_id) === Number(user.id) && !r.prescription_id) ||
        records.find((r) => !r.prescription_id);

      if (pendingRecord) {
        openPrescriptionForm(pendingRecord.id, selectedAppointment.pet_name);
        return;
      }

      // Nếu bác sĩ phòng chính chưa lập bệnh án kết luận cho ca khám:
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
          'Lập bệnh án tổng hợp để kê đơn',
          'Vui lòng lập bệnh án kết luận tại phòng chính (tổng hợp kết quả từ các phòng chuyên khoa nếu có). Hệ thống sẽ tự động mở form kê đơn thuốc ngay sau khi lưu.',
          [
            { text: 'Để sau', style: 'cancel' },
            { text: 'Lập bệnh án kết luận', onPress: openRecordForm },
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
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>{completedOnly ? 'ĐÃ KHÁM XONG' : 'BẢNG ĐIỀU KHIỂN BÁC SĨ'}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Text style={styles.title}>{completedOnly ? 'Ca khám đã hoàn thành' : 'Quản lý ca khám bệnh'}</Text>
                {!completedOnly && <FontAwesome5 name="stethoscope" size={20} color={COLORS.primary} />}
              </View>
              <Text style={styles.subtitle}>
                {completedOnly
                  ? 'Chọn ca khám để lập hồ sơ bệnh án, kê đơn thuốc hoặc cập nhật dịch vụ khám chuyển sang Quầy Thu Ngân.'
                  : 'Theo dõi tiếp nhận bệnh nhân, chỉ định dịch vụ đa phòng, chẩn đoán và điều trị trong ngày.'}
              </Text>
            </View>
            {!completedOnly && (
              <TouchableOpacity
                style={styles.walkInHeaderBtn}
                onPress={openWalkInAppointmentModal}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add-outline" size={18} color="#fff" />
                <Text style={styles.walkInHeaderBtnText}>+ Tiếp nhận khám vãng lai</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {completedOnly ? (
          <>
            <View style={styles.statsRow}>
              <Stat label="Tổng ca đã khám" value={displayedAppointments.length} color={COLORS.success} icon={<Ionicons name="checkmark-circle-outline" size={22} color={COLORS.success} />} />
              <Stat
                label="Chờ Thu ngân thu"
                value={displayedAppointments.filter((a) => !a.invoice_id || a.invoice_payment_status === 'pending').length}
                color={COLORS.warning}
                icon={<Ionicons name="time-outline" size={22} color={COLORS.warning} />}
              />
              <Stat
                label="Đã thanh toán"
                value={displayedAppointments.filter((a) => a.invoice_id && a.invoice_payment_status !== 'pending').length}
                color={COLORS.primary}
                icon={<Ionicons name="checkmark-done-circle-outline" size={22} color={COLORS.primary} />}
              />
            </View>

            <View style={styles.filterSection}>
              <View style={styles.filterBar}>
                <DateTimeFilterBar
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  selectedTime={selectedTime}
                  onTimeChange={setSelectedTime}
                  showTimeFilter={true}
                  allowAllDates={true}
                  dateLabel="Ngày khám:"
                  timeLabel="Giờ khám:"
                />
              </View>
            </View>
          </>
        ) : (
          <>
            <View style={styles.statsRow}>
              <Stat label="Tổng ca khám" value={displayedAppointments.length} color={COLORS.primary} icon={<Ionicons name="calendar-outline" size={22} color={COLORS.primary} />} />
              <Stat label="Chờ duyệt" value={counts.pending || 0} color={COLORS.warning} icon={<Ionicons name="hourglass-outline" size={22} color={COLORS.warning} />} />
              <Stat label="Đã hoàn thành" value={counts.completed || 0} color={COLORS.success} icon={<Ionicons name="sparkles-outline" size={22} color={COLORS.success} />} />
            </View>

            <View style={styles.filterSection}>
              <View style={styles.filterBar}>
                <DateTimeFilterBar
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  selectedTime={selectedTime}
                  onTimeChange={setSelectedTime}
                  showTimeFilter={true}
                  allowAllDates={true}
                  dateLabel="Ngày khám:"
                  timeLabel="Giờ khám:"
                  statusOptions={STATUS_FILTERS}
                  statusFilter={statusFilter}
                  onStatusChange={setStatusFilter}
                />
              </View>
            </View>
          </>
        )}

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : displayedAppointments.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={40} color={COLORS.textTertiary || '#94A3B8'} style={{ marginBottom: 12 }} />
            <Text style={styles.empty}>
              {completedOnly
                ? 'Không có ca khám hoàn thành nào khớp bộ lọc ngày/giờ.'
                : 'Không có lịch khám phù hợp với bộ lọc ngày/giờ đã chọn.'}
            </Text>
          </View>
        ) : (
          <View style={[styles.appointmentGrid, isTabletOrDesktop && styles.appointmentGridDesktop]}>
            {displayedAppointments.map((appointment) => {
              const dateObj = new Date(appointment.appointment_datetime);
              const timeStr = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
              const dateStr = dateObj.toLocaleDateString('vi-VN');
              const statusCfg = statusMeta(appointment.status);
              const hasInvoice = Boolean(appointment.invoice_id);
              const isInvoicePaid = hasInvoice && appointment.invoice_payment_status !== 'pending';

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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {String(appointment.notes || '').includes('[Khách vãng lai]') && (
                        <View
                          style={[
                            styles.invoiceCreatedBadge,
                            { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' },
                          ]}
                        >
                          <Ionicons name="walk-outline" size={12} color="#B45309" />
                          <Text style={[styles.invoiceCreatedBadgeText, { color: '#B45309' }]}>
                            Khách vãng lai
                          </Text>
                        </View>
                      )}
                      {appointment.is_referred_case && (
                        <View
                          style={[
                            styles.invoiceCreatedBadge,
                            { backgroundColor: '#EDE9FE', borderColor: '#DDD6FE' },
                          ]}
                        >
                          <Ionicons name="swap-horizontal-outline" size={12} color="#6D28D9" />
                          <Text style={[styles.invoiceCreatedBadgeText, { color: '#6D28D9' }]}>
                            Chuyển từ {appointment.referred_by_room_code || appointment.room_code}
                          </Text>
                        </View>
                      )}
                      {hasInvoice && (
                        <View
                          style={[
                            styles.invoiceCreatedBadge,
                            isInvoicePaid && { backgroundColor: '#DCFCE7', borderColor: '#BBF7D0' },
                          ]}
                        >
                          <Ionicons
                            name={isInvoicePaid ? 'checkmark-circle' : 'qr-code-outline'}
                            size={12}
                            color={isInvoicePaid ? '#16A34A' : '#0369A1'}
                          />
                          <Text
                            style={[
                              styles.invoiceCreatedBadgeText,
                              isInvoicePaid && { color: '#16A34A' },
                            ]}
                          >
                            {isInvoicePaid ? 'Đã thanh toán' : 'Chờ thanh toán'}
                          </Text>
                        </View>
                      )}
                      <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                        <Text style={[styles.statusBadgeText, { color: statusCfg.color }]}>
                          {String(appointment.notes || '').includes('[VẮNG MẶT')
                            ? 'Vắng mặt (No-Show)'
                            : statusCfg.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.petInfoRow}>
                    <View style={styles.petAvatar}>
                      <FontAwesome5
                        name={getSpeciesIconName(appointment.species)}
                        size={18}
                        color={COLORS.primaryDark}
                      />
                    </View>
                    <View style={styles.petTextWrap}>
                      <Text style={styles.petName}>{appointment.pet_name}</Text>
                      <Text style={styles.petSpecies}>
                        {formatSpeciesLabel(appointment.species)} {appointment.breed ? `· ${appointment.breed}` : ''}
                      </Text>
                    </View>
                    {appointment.status === 'completed' && (
                      <View style={styles.cardAmountPill}>
                        <Text style={styles.cardAmountLabel}>
                          {isInvoicePaid ? 'Đã thanh toán' : hasInvoice ? 'Chờ thanh toán' : 'Tạm tính'}
                        </Text>
                        <Text style={styles.cardAmountValue}>
                          {Number(hasInvoice ? appointment.invoice_total : appointment.price || 0).toLocaleString('vi-VN')} đ
                        </Text>
                      </View>
                    )}
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
                    {Array.isArray(appointment.room_steps) && appointment.room_steps.length > 1 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        <Ionicons name="git-network-outline" size={13} color="#0284C7" />
                        {appointment.room_steps.map((step, idx) => {
                          const done = step.status === 'completed';
                          return (
                            <View
                              key={step.room_id}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: done ? '#DCFCE7' : '#FEF3C7',
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                                borderRadius: 6,
                                gap: 3,
                              }}
                            >
                              <Ionicons
                                name={done ? 'checkmark-circle' : 'time-outline'}
                                size={11}
                                color={done ? '#16A34A' : '#D97706'}
                              />
                              <Text style={{ fontSize: 10, fontWeight: '700', color: done ? '#16A34A' : '#B45309' }}>
                                {idx === 0 ? `${step.room_code} (Gốc)` : step.room_code}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    )}
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

                  <View style={styles.cardFooterRow}>
                    {(appointment.status === 'confirmed' || appointment.status === 'completed') && !isInvoicePaid ? (
                      <View style={styles.cardInvoiceActions}>
                        <TouchableOpacity
                          style={[styles.cardInvoiceBtn, styles.cardInvoiceBtnView]}
                          onPress={(e) => {
                            e?.stopPropagation?.();
                            openAppointmentServiceModal(appointment);
                          }}
                        >
                          <Ionicons
                            name="medkit-outline"
                            size={15}
                            color={COLORS.primaryDark}
                          />
                          <Text style={[styles.cardInvoiceBtnText, styles.cardInvoiceBtnTextView]}>
                            Chỉ định dịch vụ khám
                          </Text>
                        </TouchableOpacity>
                      </View>
                    ) : <View />}
                    <Text style={styles.cardActionHint}>Chi tiết & xử lý →</Text>
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
                    <Text style={styles.modalSubtitle}>
                      Bé: {selectedAppointment.pet_name} ({formatSpeciesLabel(selectedAppointment.species)})
                    </Text>
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
                    <InfoRow
                      label={selectedAppointment.invoice_id ? 'Số tiền hóa đơn' : 'Chi phí dự kiến'}
                      value={`${Number(selectedAppointment.invoice_id ? selectedAppointment.invoice_total : selectedAppointment.price || 0).toLocaleString('vi-VN')} đ`}
                    />
                    {selectedAppointment.invoice_id && (
                      <InfoRow
                        label="Trạng thái viện phí"
                        value={
                          selectedAppointment.invoice_payment_status !== 'pending'
                            ? `Đã thanh toán tại Thu ngân (${selectedAppointment.invoice_code})`
                            : `Đã chuyển sang Quầy Thu Ngân (${selectedAppointment.invoice_code})`
                        }
                      />
                    )}
                    <InfoRow label="Ghi chú khách hàng" value={selectedAppointment.notes || 'Không có ghi chú'} />
                    {Array.isArray(selectedAppointment.room_steps) && selectedAppointment.room_steps.length > 1 && (
                      <View
                        style={{
                          marginTop: 10,
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: '#F0F9FF',
                          borderWidth: 1,
                          borderColor: '#BAE6FD',
                          gap: 6,
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#0369A1' }}>
                          Tiến trình phối hợp liên phòng:
                        </Text>
                        {selectedAppointment.room_steps.map((step, idx) => {
                          const done = step.status === 'completed';
                          return (
                            <View
                              key={step.room_id}
                              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.text }}>
                                {idx + 1}. {step.room_code} - {step.room_name}
                                {step.referred_by_room_code ? ` (từ ${step.referred_by_room_code})` : ' (Phòng tiếp nhận gốc)'}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 11,
                                  fontWeight: '800',
                                  color: done ? '#16A34A' : '#D97706',
                                }}
                              >
                                {done ? '✓ Đã xong' : '⏳ Đang khám'}
                              </Text>
                            </View>
                          );
                        })}
                        {Array.isArray(selectedAppointment.waiting_for_rooms) &&
                          selectedAppointment.waiting_for_rooms.length > 0 && (
                            <Text style={{ fontSize: 11, color: '#B45309', fontWeight: '700', marginTop: 4 }}>
                              ⚠️ Phòng bạn đang chờ kết quả từ: {selectedAppointment.waiting_for_rooms.join(', ')}
                            </Text>
                          )}
                      </View>
                    )}
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

                  {(selectedAppointment.status === 'confirmed' || selectedAppointment.status === 'completed') && (
                    <View style={styles.medicalHistorySection}>
                      <View style={styles.sectionHeaderRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <FontAwesome5 name="notes-medical" size={15} color={COLORS.primary} />
                          <Text style={styles.sectionTitle}>Hồ sơ & Đơn thuốc của bé</Text>
                        </View>
                        {loadingPetMedicalInfo && <ActivityIndicator size="small" color={COLORS.primary} />}
                      </View>

                      {/* Danh sách Hồ sơ bệnh án / Kết quả khám chuyên khoa từ các phòng */}
                      {petRecords.length > 0 && (
                        <View style={[styles.prescriptionCardsBox, { marginBottom: 10 }]}>
                          <Text style={styles.subSectionTitle}>
                            Hồ sơ bệnh án & Kết quả chuyên khoa ({petRecords.length}):
                          </Text>
                          {petRecords.map((rec) => (
                            <View
                              key={`rec-${rec.id}`}
                              style={[
                                styles.prescriptionCardItem,
                                { flexDirection: 'column', alignItems: 'stretch', gap: 6 },
                              ]}
                            >
                              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                  <Ionicons name="document-text" size={16} color="#0284C7" />
                                  <Text style={[styles.prescriptionCode, { flex: 1 }]} numberOfLines={2}>
                                    {rec.title}
                                  </Text>
                                </View>
                                {rec.doctor_room_code ? (
                                  <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                                    <Text style={{ color: '#0369A1', fontSize: 11, fontWeight: '800' }}>
                                      {rec.doctor_room_code}
                                    </Text>
                                  </View>
                                ) : null}
                              </View>
                              <Text style={styles.prescriptionDate}>
                                {rec.performed_date ? new Date(rec.performed_date).toLocaleDateString('vi-VN') : ''} · BS. {rec.doctor_name || rec.doctor_info || 'Phụ trách'}
                              </Text>
                              {rec.diagnosis ? (
                                <Text style={{ color: COLORS.text, fontSize: 12, lineHeight: 17 }}>
                                  <Text style={{ fontWeight: '700', color: COLORS.textSecondary }}>Chẩn đoán: </Text>
                                  {rec.diagnosis}
                                </Text>
                              ) : null}
                              {rec.treatment_plan ? (
                                <Text style={{ color: '#0F766E', fontSize: 12, lineHeight: 17, backgroundColor: '#F0FDFA', padding: 6, borderRadius: 6 }}>
                                  <Text style={{ fontWeight: '800' }}>Hướng điều trị / Đề xuất thuốc: </Text>
                                  {rec.treatment_plan}
                                </Text>
                              ) : null}
                            </View>
                          ))}
                        </View>
                      )}

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

                      {/* Thông báo quy tắc kê đơn 1 lần tại phòng gốc */}
                      {selectedAppointment.is_referred_case ? (
                        <View style={styles.pendingPrescriptionAlert}>
                          <Ionicons name="information-circle" size={18} color="#0284C7" />
                          <Text style={[styles.pendingPrescriptionAlertText, { color: '#0369A1' }]}>
                            Ca khám phối hợp liên phòng: Phòng chuyên khoa lập Hồ sơ kết quả khám và ghi đề xuất thuốc ở mục Hướng điều trị. Bác sĩ phòng tiếp nhận chính ({selectedAppointment.room_code || 'phòng gốc'}) sẽ tổng hợp và kê 1 đơn thuốc duy nhất cho bé.
                          </Text>
                        </View>
                      ) : (
                        petRecords.length > 0 &&
                        petRecords.some((r) => !r.prescription_id) && (
                          <View style={styles.pendingPrescriptionAlert}>
                            <Ionicons name="information-circle" size={18} color="#D97706" />
                            <Text style={styles.pendingPrescriptionAlertText}>
                              Có hồ sơ/kết quả chuyên khoa chưa kê đơn thuốc. Bác sĩ phòng chính có thể xem đề xuất thuốc ở trên và nhấn "Kê đơn thuốc điện tử" bên dưới để kê đơn tổng hợp.
                            </Text>
                          </View>
                        )
                      )}
                    </View>
                  )}

                  <View style={styles.actions}>
                    {selectedAppointment.status === 'pending' && (
                      <Action label="Xác nhận lịch khám" icon={<Ionicons name="checkmark-circle-outline" size={18} color="#fff" />} color={COLORS.primary} onPress={() => updateStatus('confirmed')} />
                    )}
                    {(selectedAppointment.status === 'confirmed' || selectedAppointment.status === 'completed') &&
                      !(selectedAppointment.invoice_id && selectedAppointment.invoice_payment_status !== 'pending') && (
                        <Action
                          label="Chỉ định / Cập nhật dịch vụ khám (Đa phòng)"
                          icon={<Ionicons name="medkit-outline" size={18} color="#fff" />}
                          color="#0284C7"
                          onPress={() => openAppointmentServiceModal(selectedAppointment)}
                        />
                      )}
                    {selectedAppointment.status === 'confirmed' && (
                      <Action
                        label={
                          selectedAppointment.is_referred_case
                            ? `Hoàn thành tại phòng này (Trả kết quả về ${
                                selectedAppointment.referred_by_room_code || selectedAppointment.room_code
                              })`
                            : 'Hoàn thành khám bệnh'
                        }
                        icon={<Ionicons name="checkbox-outline" size={18} color="#fff" />}
                        color={COLORS.success}
                        onPress={() => updateStatus('completed')}
                      />
                    )}
                    {selectedAppointment.status === 'confirmed' && !selectedAppointment.is_referred_case && (
                      <Action
                        label="Khách vắng mặt (Không đến khám)"
                        icon={<Ionicons name="person-remove-outline" size={18} color="#fff" />}
                        color="#B45309"
                        onPress={handleMarkNoShow}
                      />
                    )}
                    {(selectedAppointment.status === 'pending' ||
                      (selectedAppointment.status === 'confirmed' && !selectedAppointment.is_referred_case)) && (
                      <Action label="Hủy lịch hẹn" icon={<Ionicons name="close-circle-outline" size={18} color="#fff" />} color={COLORS.danger} onPress={() => updateStatus('cancelled')} />
                    )}
                    {(selectedAppointment.status === 'confirmed' || selectedAppointment.status === 'completed') && (
                      <>
                        <Action
                          label={selectedAppointment.is_referred_case ? 'Lập hồ sơ kết quả chuyên khoa' : 'Lập hồ sơ bệnh án'}
                          icon={<Ionicons name="document-text-outline" size={18} color="#fff" />}
                          color={COLORS.primaryDark}
                          onPress={openRecordForm}
                        />
                        {!selectedAppointment.is_referred_case && (
                          <Action
                            label="Kê đơn thuốc điện tử (Tổng hợp)"
                            icon={<MaterialCommunityIcons name="pill" size={18} color="#fff" />}
                            color={COLORS.primary}
                            onPress={prescribeForAppointment}
                          />
                        )}
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
                <Text style={styles.modalTitle}>
                  {selectedAppointment?.is_referred_case ? 'Lập hồ sơ kết quả chuyên khoa' : 'Lập hồ sơ bệnh án'}
                </Text>
                <Text style={styles.modalSubtitle}>
                  {selectedAppointment?.is_referred_case
                    ? 'Ghi kết quả cận lâm sàng & đề xuất thuốc gửi về phòng chính'
                    : 'Ghi chép tình trạng và phác đồ điều trị tổng hợp'}
                </Text>
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
              <Field label="Chẩn đoán / Kết quả chuyên khoa" value={form.diagnosis} onChangeText={(diagnosis) => setForm({ ...form, diagnosis })} multiline placeholder="Mô tả kết quả khám, siêu âm, xét nghiệm và chẩn đoán..." />
              <Field
                label={
                  selectedAppointment?.is_referred_case
                    ? 'Hướng điều trị & Đề xuất thuốc (gửi về phòng chính)'
                    : 'Hướng điều trị & dặn dò'
                }
                value={form.treatment_plan}
                onChangeText={(treatment_plan) => setForm({ ...form, treatment_plan })}
                multiline
                placeholder={
                  selectedAppointment?.is_referred_case
                    ? 'Ghi đề xuất thuốc/liều lượng để Bác sĩ phòng chính tổng hợp kê đơn...'
                    : 'Phác đồ điều trị, chăm sóc tại nhà...'
                }
              />
              <Field label="Ngày thực hiện (YYYY-MM-DD)" value={form.performed_date} onChangeText={(performed_date) => setForm({ ...form, performed_date })} />
              <Field label="Ngày tái khám (YYYY-MM-DD, không bắt buộc)" value={form.next_due_date} onChangeText={(next_due_date) => setForm({ ...form, next_due_date })} placeholder="Để trống nếu không hẹn khám lại" />
              <TouchableOpacity style={styles.saveButton} onPress={saveRecord} disabled={saving}>
                <Text style={styles.saveText}>
                  {saving
                    ? 'Đang lưu hồ sơ...'
                    : selectedAppointment?.is_referred_case
                    ? 'Lưu kết quả chuyên khoa'
                    : 'Lưu hồ sơ & Kê đơn thuốc'}
                </Text>
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
                  {petRecords.some((r) => r.treatment_plan) && (
                    <View
                      style={{
                        backgroundColor: '#F0FDFA',
                        borderWidth: 1,
                        borderColor: '#99F6E4',
                        borderRadius: 10,
                        padding: 10,
                        marginBottom: 12,
                        gap: 4,
                      }}
                    >
                      <Text style={{ color: '#0F766E', fontWeight: '800', fontSize: 12 }}>
                        Đề xuất thuốc / Hướng điều trị từ các phòng khám:
                      </Text>
                      {petRecords
                        .filter((r) => r.treatment_plan)
                        .slice(0, 3)
                        .map((r) => (
                          <Text key={`rec-note-${r.id}`} style={{ color: '#134E4A', fontSize: 12, lineHeight: 17 }}>
                            • <Text style={{ fontWeight: '700' }}>[{r.doctor_room_code || 'Phòng khám'} - BS. {r.doctor_name || 'Phụ trách'}]: </Text>
                            {r.treatment_plan}
                          </Text>
                        ))}
                    </View>
                  )}
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

      {/* Modal Chỉ định / Cập nhật Dịch vụ Khám (Đa phòng) & Tiếp nhận ca khám vãng lai */}
      <Modal
        visible={invoiceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInvoiceModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons
                    name={invoiceModalMode === 'walk_in' ? 'person-add-outline' : 'medkit-outline'}
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.modalTitle}>
                    {invoiceModalMode === 'walk_in'
                      ? 'Tiếp nhận ca khám vãng lai'
                      : 'Chỉ định & Cập nhật Dịch vụ Khám'}
                  </Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  {invoiceModalMode === 'walk_in'
                    ? 'Tạo ca khám trực tiếp tại phòng khám — hỗ trợ chỉ định đa phòng, kê đơn thuốc và tự động đẩy dịch vụ sang Quầy Thu Ngân.'
                    : 'Chọn các dịch vụ thực tế làm cho bé (bao gồm cả dịch vụ của phòng khác). Hệ thống sẽ tự động gộp vào 1 hóa đơn tại Quầy Thu Ngân.'}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setInvoiceModalVisible(false)}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {invoiceLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ marginTop: 10, color: COLORS.textSecondary, fontSize: 13 }}>
                  Đang tải danh sách dịch vụ các phòng khám...
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {invoiceModalMode === 'walk_in' ? (
                  <View style={styles.walkInFormBox}>
                    <View style={styles.invoiceTypeTagWalkIn}>
                      <Ionicons name="walk-outline" size={14} color="#B45309" />
                      <Text style={styles.invoiceTypeTagWalkInText}>
                        Khách khám vãng lai · Phòng tiếp nhận: {doctorRoom ? `${doctorRoom.room_code} - ${doctorRoom.room_name}` : 'Tự động theo dịch vụ'}
                      </Text>
                    </View>

                    {/* Tra cứu SĐT khách hàng cũ / hoặc nhập mới */}
                    <View style={{ marginBottom: 12 }}>
                      <Text style={styles.fieldLabel}>
                        Số điện thoại chủ nuôi (nhập để tự động tìm hồ sơ cũ nếu có)
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TextInput
                          value={walkInCustomerPhone}
                          onChangeText={setWalkInCustomerPhone}
                          onSubmitEditing={handleLookupWalkInCustomerByPhone}
                          placeholder="VD: 0901234567"
                          placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
                          keyboardType="phone-pad"
                          style={[styles.input, { flex: 1 }]}
                        />
                        <TouchableOpacity
                          style={{
                            backgroundColor: COLORS.primary,
                            paddingHorizontal: 14,
                            borderRadius: 12,
                            justifyContent: 'center',
                            alignItems: 'center',
                            flexDirection: 'row',
                            gap: 5,
                          }}
                          onPress={handleLookupWalkInCustomerByPhone}
                          disabled={walkInSearchingPhone}
                        >
                          {walkInSearchingPhone ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <>
                              <Ionicons name="search" size={16} color="#fff" />
                              <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Tìm SĐT</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                      {walkInLookupMessage ? (
                        <Text
                          style={{
                            marginTop: 6,
                            fontSize: 12,
                            fontWeight: '700',
                            color: walkInFoundUser ? COLORS.primaryDark : '#B45309',
                          }}
                        >
                          {walkInLookupMessage}
                        </Text>
                      ) : null}
                    </View>

                    <Field
                      label="Họ tên chủ nuôi *"
                      value={walkInCustomerName}
                      onChangeText={setWalkInCustomerName}
                      placeholder="VD: Nguyễn Văn A"
                    />

                    {/* Nếu khách cũ có sẵn thú cưng thì cho phép chọn nhanh */}
                    {walkInFoundPets.length > 0 && (
                      <View style={{ marginBottom: 12 }}>
                        <Text style={styles.fieldLabel}>Chọn thú cưng của khách:</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {walkInFoundPets.map((p) => {
                            const selected = Number(walkInSelectedPetId) === Number(p.id);
                            return (
                              <TouchableOpacity
                                key={p.id}
                                style={[
                                  styles.speciesOptionBtn,
                                  { flex: 0, paddingHorizontal: 14 },
                                  selected && styles.speciesOptionBtnActive,
                                ]}
                                onPress={() => handleSelectWalkInPet(p)}
                              >
                                <FontAwesome5
                                  name={getSpeciesIconName(p.species)}
                                  size={13}
                                  color={selected ? '#fff' : COLORS.textSecondary}
                                />
                                <Text style={[styles.speciesOptionText, selected && styles.speciesOptionTextActive]}>
                                  {p.name} ({formatSpeciesLabel(p.species)})
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                          <TouchableOpacity
                            style={[
                              styles.speciesOptionBtn,
                              { flex: 0, paddingHorizontal: 14 },
                              !walkInSelectedPetId && styles.speciesOptionBtnActive,
                            ]}
                            onPress={() => handleSelectWalkInPet(null)}
                          >
                            <Ionicons
                              name="add-circle-outline"
                              size={15}
                              color={!walkInSelectedPetId ? '#fff' : COLORS.textSecondary}
                            />
                            <Text style={[styles.speciesOptionText, !walkInSelectedPetId && styles.speciesOptionTextActive]}>
                              Thú cưng mới
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    <Field
                      label="Tên thú cưng *"
                      value={walkInPetName}
                      onChangeText={(val) => {
                        setWalkInPetName(val);
                        if (walkInSelectedPetId) setWalkInSelectedPetId(null);
                      }}
                      placeholder="VD: Miu, Lu, Cún..."
                    />

                    <Text style={styles.fieldLabel}>Loài thú cưng *</Text>
                    <View style={styles.speciesSelectRow}>
                      {SPECIES_OPTIONS.map((opt) => {
                        const active = walkInPetSpecies === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            style={[styles.speciesOptionBtn, active && styles.speciesOptionBtnActive]}
                            onPress={() => setWalkInPetSpecies(opt.value)}
                          >
                            <FontAwesome5
                              name={opt.icon}
                              size={14}
                              color={active ? '#fff' : COLORS.textSecondary}
                            />
                            <Text style={[styles.speciesOptionText, active && styles.speciesOptionTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    <Field
                      label="Triệu chứng / Yêu cầu khám (không bắt buộc)"
                      value={walkInNotes}
                      onChangeText={setWalkInNotes}
                      placeholder="VD: Bé bỏ ăn, nôn mửa, cần khám tổng quát..."
                    />
                  </View>
                ) : (
                  invoiceTargetAppointment && (
                    <View style={styles.invoiceSummaryCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <View style={styles.invoiceTypeTagAppointment}>
                          <Ionicons name="calendar-outline" size={13} color="#0F766E" />
                          <Text style={styles.invoiceTypeTagAppointmentText}>Ca khám #{invoiceTargetAppointment.id}</Text>
                        </View>
                        <Text style={styles.invoiceRoomTag}>
                          {invoiceTargetAppointment.room_code ? `${invoiceTargetAppointment.room_code} · ` : ''}
                          {invoiceTargetAppointment.room_name}
                        </Text>
                      </View>
                      <InfoRow label="Khách hàng" value={invoiceTargetAppointment.customer_info} />
                      <InfoRow
                        label="Thú cưng"
                        value={`${invoiceTargetAppointment.pet_name} (${formatSpeciesLabel(invoiceTargetAppointment.species)})`}
                      />
                      <InfoRow
                        label="Dịch vụ hiện tại"
                        value={invoiceTargetAppointment.service_name || 'Chưa có'}
                      />
                    </View>
                  )
                )}

                {/* BỘ LỌC THEO PHÒNG KHÁM (ĐỂ BÁC SĨ CHỈ ĐỊNH DỊCH VỤ ĐA PHÒNG DỄ DÀNG) */}
                {allRooms.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>
                      Lọc dịch vụ theo phòng khám:
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <TouchableOpacity
                        style={[
                          styles.chip,
                          serviceRoomFilter === 'all' && styles.chipSelected,
                        ]}
                        onPress={() => setServiceRoomFilter('all')}
                      >
                        <Text style={serviceRoomFilter === 'all' ? styles.chipTextSelected : styles.chipText}>
                          Tất cả phòng ({roomServices.length})
                        </Text>
                      </TouchableOpacity>
                      {allRooms.map((r) => {
                        const active = Number(serviceRoomFilter) === Number(r.id);
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[styles.chip, active && styles.chipSelected]}
                            onPress={() => setServiceRoomFilter(r.id)}
                          >
                            <Text style={active ? styles.chipTextSelected : styles.chipText}>
                              {r.room_code} - {r.room_name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* DANH SÁCH DỊCH VỤ ĐỂ BÁC SĨ TÍCH CHỌN / ĐIỀU CHỈNH */}
                <View style={styles.serviceSelectSectionHeader}>
                  <Text style={styles.fieldLabel}>
                    Đã chọn ({selectedServiceIds.length}) dịch vụ thực hiện *
                  </Text>
                  {bookedServiceIds.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSelectedServiceIds([...bookedServiceIds])}
                      style={styles.resetBookedBtn}
                    >
                      <Ionicons name="refresh-outline" size={13} color={COLORS.primaryDark} />
                      <Text style={styles.resetBookedBtnText}>Đặt lại mặc định</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {displayedServicesForModal.length === 0 ? (
                  <View style={styles.emptyMedicalBox}>
                    <Text style={styles.emptyMedicalText}>
                      Không tìm thấy danh sách dịch vụ của phòng khám.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.serviceChecklistWrap}>
                    {displayedServicesForModal.map((service) => {
                      const sId = Number(service.id);
                      const isChecked = selectedServiceIds.includes(sId);
                      const wasBooked = bookedServiceIds.includes(sId);

                      return (
                        <TouchableOpacity
                          key={service.id}
                          style={[
                            styles.serviceCheckItem,
                            isChecked && styles.serviceCheckItemActive,
                          ]}
                          onPress={() => toggleInvoiceService(sId)}
                          activeOpacity={0.75}
                        >
                          <View
                            style={[
                              styles.checkboxSquare,
                              isChecked && styles.checkboxSquareChecked,
                            ]}
                          >
                            {isChecked && <Ionicons name="checkmark" size={15} color="#fff" />}
                          </View>

                          <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                              <Text
                                style={[
                                  styles.serviceCheckName,
                                  isChecked && styles.serviceCheckNameActive,
                                ]}
                              >
                                {service.service_name}
                              </Text>
                              {service.room_code ? (
                                <View style={[styles.bookedDefaultTag, { backgroundColor: '#E0F2FE' }]}>
                                  <Text style={[styles.bookedDefaultTagText, { color: '#0369A1' }]}>
                                    {service.room_code} · {service.room_name}
                                  </Text>
                                </View>
                              ) : null}
                              {wasBooked && (
                                <View style={styles.bookedDefaultTag}>
                                  <Text style={styles.bookedDefaultTagText}>Đặt ban đầu</Text>
                                </View>
                              )}
                            </View>
                            {service.description ? (
                              <Text style={styles.serviceCheckDesc} numberOfLines={1}>
                                {service.description}
                              </Text>
                            ) : null}
                          </View>

                          <Text
                            style={[
                              styles.serviceCheckPrice,
                              isChecked && styles.serviceCheckPriceActive,
                            ]}
                          >
                            {Number(service.price || 0).toLocaleString('vi-VN')} đ
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {/* TỔNG TIỀN TẠM TÍNH ĐẨY SANG THU NGÂN */}
                <View style={styles.invoiceTotalPreviewBox}>
                  <View>
                    <Text style={styles.invoiceTotalPreviewLabel}>Tổng chi phí dự kiến chuyển Thu ngân</Text>
                    <Text style={styles.invoiceTotalPreviewSub}>
                      Đã chọn {selectedServiceIds.length} dịch vụ thực hiện
                    </Text>
                  </View>
                  <Text style={styles.invoiceTotalPreviewValue}>
                    {invoiceCalculatedTotal.toLocaleString('vi-VN')} đ
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, invoiceSaving && { opacity: 0.7 }]}
                  onPress={invoiceModalMode === 'walk_in' ? submitWalkInAppointment : submitAssignedServices}
                  disabled={invoiceSaving}
                >
                  {invoiceSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Ionicons
                        name={invoiceModalMode === 'walk_in' ? 'person-add-outline' : 'checkmark-done-circle-outline'}
                        size={19}
                        color="#fff"
                      />
                      <Text style={styles.saveText}>
                        {invoiceModalMode === 'walk_in'
                          ? 'Tiếp nhận & Bắt đầu khám'
                          : 'Lưu chỉ định dịch vụ (Đồng bộ sang Thu ngân)'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </ScrollView>
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
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  walkInHeaderBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    ...SHADOWS.sm,
  },
  walkInHeaderBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  walkInFormBox: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  speciesSelectRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 12,
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

  // Invoice & QR Billing Styles
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  createWalkInInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0284C7',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    ...SHADOWS.sm,
  },
  createWalkInInvoiceBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  invoiceCreatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  invoiceCreatedBadgeText: {
    color: '#0369A1',
    fontWeight: '700',
    fontSize: 11,
  },
  cardAmountPill: {
    alignItems: 'flex-end',
    backgroundColor: COLORS.background,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardAmountLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  cardAmountValue: {
    color: COLORS.primaryDark,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 1,
  },
  cardFooterRow: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardInvoiceActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0284C7',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  cardInvoiceBtnView: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  cardInvoiceBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  cardInvoiceBtnTextView: {
    color: COLORS.primaryDark,
  },
  cardAdjustInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 10,
  },
  cardAdjustInvoiceBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  walkInSection: {
    marginTop: 28,
  },
  walkInSectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  walkInSectionTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  walkInSectionSub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  invoiceSummaryCard: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  invoiceTypeTagAppointment: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#CCFBF1',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  invoiceTypeTagAppointmentText: {
    color: '#0F766E',
    fontWeight: '800',
    fontSize: 12,
  },
  invoiceTypeTagWalkIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  invoiceTypeTagWalkInText: {
    color: '#0369A1',
    fontWeight: '800',
    fontSize: 12,
  },
  invoiceRoomTag: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  invoiceWalkInFormBox: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  speciesSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  speciesOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  speciesOptionBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  speciesOptionText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  speciesOptionTextActive: {
    color: '#fff',
  },
  serviceSelectSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resetBookedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  resetBookedBtnText: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 12,
  },
  serviceChecklistWrap: {
    gap: 8,
    marginBottom: 16,
  },
  serviceCheckItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: 12,
  },
  serviceCheckItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDFA',
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSquareChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  serviceCheckName: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  serviceCheckNameActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  serviceCheckDesc: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  bookedDefaultTag: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  bookedDefaultTagText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
  },
  serviceCheckPrice: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  serviceCheckPriceActive: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  invoiceTotalPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
  },
  invoiceTotalPreviewLabel: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
  },
  invoiceTotalPreviewSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  invoiceTotalPreviewValue: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 20,
  },
  qrShowcaseCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  qrBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CCFBF1',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  qrBadgeHeaderText: {
    color: '#0F766E',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  qrImageFrame: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  qrImage: {
    width: 210,
    height: 210,
  },
  qrBankTitle: {
    color: COLORS.textSecondary,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  qrAmountBig: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 24,
    marginTop: 4,
  },
  qrTransferNotePill: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  qrTransferNoteText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceOrderDetailBox: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  invoiceOrderSectionTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 4,
  },
  invoiceItemsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 6,
  },
  invoiceBillItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  invoiceBillItemName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  invoiceBillItemPrice: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  invoiceBillTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    marginTop: 4,
  },
  invoiceBillTotalLabel: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
  },
  invoiceBillTotalValue: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 18,
  },
  qrFooterButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  qrSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  qrSecondaryBtnText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 13,
  },
  qrPrimaryDoneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  qrPrimaryDoneBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});

