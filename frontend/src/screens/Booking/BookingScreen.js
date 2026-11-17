import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
  FlatList,
  TextInput,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { getRoomsApi, getRoomServicesApi, getRoomAvailabilityApi } from '../../api/roomApi';
import { getMyPetsApi } from '../../api/petApi';
import { createAppointmentApi, getMyAppointmentsApi } from '../../api/appointmentApi';

const getSpeciesLabel = (species) => {
  if (!species) return 'Khác';
  const s = species.toLowerCase();
  if (s === 'dog' || s.includes('chó')) return 'Chó';
  if (s === 'cat' || s.includes('mèo')) return 'Mèo';
  return 'Khác';
};

const getSpeciesIcon = (species) => {
  if (!species) return 'paw';
  const s = species.toLowerCase();
  if (s === 'dog' || s.includes('chó')) return 'dog';
  if (s === 'cat' || s.includes('mèo')) return 'cat';
  return 'paw';
};

// Cơ chế Vetstoria 1: Sàng lọc từ khóa triệu chứng cấp cứu nguy kịch theo thời gian thực
const EMERGENCY_TRIAGE_KEYWORDS = [
  'chảy máu nhiều',
  'mất máu',
  'co giật',
  'bất tỉnh',
  'hôn mê',
  'ngộ độc',
  'uống thuốc độc',
  'ăn bả',
  'bả chó',
  'khó thở nặng',
  'thở gấp',
  'tím tái',
  'gãy xương',
  'tai nạn',
  'xe tông',
  'sùi bọt mép',
  'nôn ra máu',
  'đi ngoài ra máu tươi',
  'vỡ bụng',
  'trúng độc',
];

// Cơ chế Vetstoria 2: Các phòng chuyên khoa sâu chỉ tiếp nhận qua Bác sĩ chỉ định (không mở tự đặt online)
const REFERRAL_ONLY_ROOM_CODES = ['P103', 'P202', 'P203'];

const isRoomOnlineBookable = (room) => {
  if (!room) return false;
  if (typeof room.is_online_bookable === 'boolean') return room.is_online_bookable;
  return !REFERRAL_ONLY_ROOM_CODES.includes(room.room_code);
};

export default function BookingScreen({ route, navigation }) {
  const { isTabletOrDesktop } = useResponsive();

  // State
  const [rooms, setRooms] = useState([]);
  const [services, setServices] = useState([]);
  const [pets, setPets] = useState([]);
  const [myAppointments, setMyAppointments] = useState([]);
  const [availability, setAvailability] = useState([]);

  // Selected values
  const [selectedRoom, setSelectedRoom] = useState(route?.params?.selectedRoomId || null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedPets, setSelectedPets] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [notes, setNotes] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [showPetPicker, setShowPetPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showDepositQrModal, setShowDepositQrModal] = useState(false);
  const [previewAllocations, setPreviewAllocations] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      loadRoomServices(selectedRoom);
    }
  }, [selectedRoom]);

  useEffect(() => {
    if (selectedRoom && selectedDate) {
      loadAvailability(selectedRoom, selectedDate);
    }
  }, [selectedRoom, selectedDate]);

  const refreshPetsAndBookings = async () => {
    try {
      const [petsRes, appsRes] = await Promise.all([
        getMyPetsApi(),
        getMyAppointmentsApi().catch(() => ({ data: { success: false } })),
      ]);
      if (petsRes.data?.success) {
        const petList = petsRes.data.data || [];
        setPets(petList);
        setSelectedPets((prev) => {
          const validPrev = (prev || []).filter((id) => petList.some((p) => p.id === id));
          if (validPrev.length > 0) return validPrev;
          return petList.length > 0 ? [petList[0].id] : [];
        });
      }
      if (appsRes.data?.success) {
        setMyAppointments(appsRes.data.data || []);
      }
    } catch (e) {
      console.error('REFRESH_PETS_ERROR:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      refreshPetsAndBookings();
      if (selectedRoom && selectedDate) {
        loadAvailability(selectedRoom, selectedDate);
      }
    }, [selectedRoom, selectedDate])
  );

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      const [roomsRes, petsRes, appsRes] = await Promise.all([
        getRoomsApi(),
        getMyPetsApi(),
        getMyAppointmentsApi().catch(() => ({ data: { success: false } })),
      ]);

      if (roomsRes.data.success) {
        const allRooms = roomsRes.data.data || [];
        setRooms(allRooms);
        const bookableRooms = allRooms.filter(isRoomOnlineBookable);
        if (route?.params?.selectedRoomId) {
          const room = bookableRooms.find(r => r.id === route.params.selectedRoomId);
          if (room) {
            setSelectedRoom(room.id);
          } else if (bookableRooms.length > 0) {
            setSelectedRoom(bookableRooms[0].id);
          }
        } else if (bookableRooms.length > 0) {
          setSelectedRoom(bookableRooms[0].id);
        }
      }

      if (petsRes.data.success) {
        const petList = petsRes.data.data || [];
        setPets(petList);
        setSelectedPets((prev) => {
          const validPrev = (prev || []).filter((id) => petList.some((p) => p.id === id));
          if (validPrev.length > 0) return validPrev;
          return petList.length > 0 ? [petList[0].id] : [];
        });
      }

      if (appsRes.data?.success) {
        setMyAppointments(appsRes.data.data || []);
      }
    } catch (err) {
      console.error('LOAD_INITIAL_DATA_ERROR:', err);
      setError('Lỗi khi tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelectPet = (petId) => {
    setSelectedPets((prev) =>
      prev.includes(petId) ? prev.filter((id) => id !== petId) : [...prev, petId]
    );
    setBookingError('');
  };

  const toggleSelectAllPets = () => {
    if (selectedPets.length === pets.length) {
      setSelectedPets(pets.length > 0 ? [pets[0].id] : []);
    } else {
      setSelectedPets(pets.map((p) => p.id));
    }
    setBookingError('');
  };

  const loadRoomServices = async (roomId) => {
    try {
      const response = await getRoomServicesApi(roomId);
      if (response.data.success) {
        setServices(response.data.data || []);
        setSelectedServices([]);
        setAvailability([]);
      }
    } catch (err) {
      console.error('LOAD_SERVICES_ERROR:', err);
      setServices([]);
    }
  };

  const loadAvailability = async (roomId, date) => {
    try {
      const response = await getRoomAvailabilityApi(roomId, date);
      if (response.data.success) {
        setAvailability(response.data.data.slots || []);
      }
    } catch (err) {
      console.error('LOAD_AVAILABILITY_ERROR:', err);
      setAvailability([]);
    }
  };

  const generateNextDays = () => {
    const days = [];
    for (let i = 1; i <= 14; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      days.push({
        date: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
        label: date.toLocaleDateString('vi-VN', { weekday: 'short', month: '2-digit', day: '2-digit' }),
        fullLabel: date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
      });
    }
    return days;
  };

  const submitBookingRequest = async (depositConfirmed = false) => {
    if (selectedPets.length === 0 || !selectedRoom || selectedServices.length === 0 || !selectedDate || !selectedTime) {
      Alert.alert('Thông báo', 'Vui lòng chọn đầy đủ thông tin: ít nhất 1 thú cưng, phòng khám, dịch vụ, ngày và giờ khám.');
      return;
    }

    try {
      setSubmitting(true);
      setBookingError('');
      setBookingSuccess('');

      const appointmentDatetime = `${selectedDate} ${selectedTime}:00`;

      const response = await createAppointmentApi({
        pet_id: selectedPets[0],
        pet_ids: selectedPets,
        room_id: selectedRoom,
        service_ids: selectedServices,
        appointment_datetime: appointmentDatetime,
        notes: notes ? notes.trim() : null,
        deposit_confirmed: depositConfirmed,
      });

      if (response.data.success) {
        setShowDepositQrModal(false);
        const allocated = response.data.data?.allocated_appointments || [];
        const totalDepositPaid = Number(response.data.data?.total_deposit_paid || 0);
        const dateLabel = selectedDate.split('-').reverse().join('/');
        const allocatedSummary =
          allocated.length > 1
            ? allocated.map((a) => `${a.pet_name} (${a.time_slot})`).join(', ')
            : `${selectedTime} ngày ${dateLabel}`;

        setSelectedServices([]);
        setSelectedDate(null);
        setSelectedTime(null);
        setNotes('');
        setAvailability([]);
        await refreshPetsAndBookings();

        const successMsg =
          allocated.length > 1
            ? `Đặt lịch hàng loạt thành công cho ${allocated.length} bé ngày ${dateLabel}: ${allocatedSummary}${
                totalDepositPaid > 0 ? ` (Đã đặt cọc 50%: ${totalDepositPaid.toLocaleString('vi-VN')}đ)` : ''
              }.`
            : `Đặt lịch thành công lúc ${selectedTime} ngày ${dateLabel}${
                totalDepositPaid > 0 ? ` (Đã đặt cọc 50%: ${totalDepositPaid.toLocaleString('vi-VN')}đ)` : ''
              }. Lịch hẹn đang chờ phòng khám xác nhận.`;

        setBookingSuccess(successMsg);

        Alert.alert('Đặt lịch thành công', `${successMsg}\n\nBạn có muốn chuyển sang mục Lịch hẹn để theo dõi không?`, [
          {
            text: 'Đặt lịch khác',
            style: 'cancel',
          },
          {
            text: 'Xem lịch hẹn',
            onPress: () => navigation.navigate('Appointments', { refresh: Date.now() }),
          },
        ]);
      }
    } catch (err) {
      setShowDepositQrModal(false);
      if (err.response?.data?.requires_deposit) {
        setPreviewAllocations(err.response.data.preview_allocations || []);
        setShowDepositQrModal(true);
        return;
      }
      setBookingError(err.response?.data?.message || 'Không thể đặt lịch. Vui lòng thử lại.');
      if (selectedRoom && selectedDate) {
        loadAvailability(selectedRoom, selectedDate);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleBooking = () => {
    if (selectedPets.length === 0 || !selectedRoom || selectedServices.length === 0 || !selectedDate || !selectedTime) {
      Alert.alert('Thông báo', 'Vui lòng chọn đầy đủ thông tin: ít nhất 1 thú cưng, phòng khám, dịch vụ, ngày và giờ khám.');
      return;
    }
    // Luôn gửi kiểm tra qua Backend trước (depositConfirmed = false) để xác thực TẤT CẢ các chốt chặn
    // (No-Show >= 2 lần, điểm phạt hủy lịch, trùng phòng, giới hạn 2 phòng/ngày, đủ slot trống cho các bé).
    // Chỉ khi vượt qua toàn bộ chốt chặn và Backend trả về requires_deposit: true thì mới mở Modal QR Đặt cọc 50%!
    submitBookingRequest(false);
  };

  if (loading) {
    return (
      <ResponsiveContainer style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải danh sách phòng khám & dịch vụ...</Text>
      </ResponsiveContainer>
    );
  }

  const selectedRoomObj = rooms.find(r => r.id === selectedRoom);
  const selectedServiceObjs = services.filter(service => selectedServices.includes(service.id));
  const selectedPetObjs = pets.filter(p => selectedPets.includes(p.id));
  const selectedPetObj = selectedPetObjs[0] || null;
  const petCount = selectedPets.length;
  const singlePetPrice = selectedServiceObjs.reduce((total, service) => total + Number(service.price || 0), 0);
  const totalPrice = singlePetPrice * Math.max(1, petCount);
  const totalDurationMinutes = selectedServiceObjs.reduce((total, service) => total + Number(service.duration_minutes || 0), 0);
  const maxSlotMinutes = selectedRoomObj ? Math.round(60 / Math.max(1, Number(selectedRoomObj.max_slot_per_hour || 1))) : 60;

  // Đếm số lịch hẹn đã đặt trong ngày được chọn của chủ nuôi (status != 'cancelled')
  const existingTodayCount = selectedDate
    ? myAppointments.filter((a) => {
        if (!a.appointment_datetime || a.status === 'cancelled') return false;
        const dStr = String(a.appointment_datetime).slice(0, 10);
        return dStr === selectedDate;
      }).length
    : 0;

  // Quy tắc Đặt cọc 50%: Đặt hàng loạt >= 3 thú cưng HOẶC đặt cho thú cưng thứ 3 trở đi trong 1 ngày
  const requiresDeposit = petCount >= 3 || (Boolean(selectedDate) && existingTodayCount + petCount >= 3 && petCount > 0);
  const depositPerPet = requiresDeposit ? Math.round(singlePetPrice * 0.5) : 0;
  const depositAmount = depositPerPet * petCount;

  const matchedEmergencyKeywords = notes
    ? EMERGENCY_TRIAGE_KEYWORDS.filter((kw) => notes.toLowerCase().includes(kw))
    : [];
  const isEmergencyDetected = matchedEmergencyKeywords.length > 0;
  const isFormComplete = petCount > 0 && selectedRoom && selectedServices.length > 0 && selectedDate && selectedTime && !isEmergencyDetected;

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Banner */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Đặt Lịch Khám Bệnh</Text>
            <Text style={styles.subtitle}>Chọn chuyên khoa, dịch vụ và khung giờ khám phù hợp cho bé cưng</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color={COLORS.danger} style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* 2-Column Split on Desktop, 1-Column on Mobile */}
        <View style={[styles.mainLayout, isTabletOrDesktop && styles.mainLayoutDesktop]}>
          
          {/* CỘT TRÁI: THÔNG TIN THÚ CƯNG, PHÒNG KHÁM, DỊCH VỤ, GHI CHÚ */}
          <View style={[styles.leftColumn, isTabletOrDesktop && styles.leftColumnDesktop]}>
            {/* 1. Chọn Thú cưng (Hỗ trợ đặt lịch hàng loạt cho nhiều bé) */}
            <View style={styles.cardSection}>
              <View style={[styles.sectionTitleRow, { justifyContent: 'space-between' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
                  <Text style={styles.sectionLabel}>Bé cưng cần khám (Chọn 1 hoặc nhiều)</Text>
                </View>
                {pets.length > 1 && (
                  <TouchableOpacity
                    onPress={toggleSelectAllPets}
                    style={{
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      backgroundColor: selectedPets.length === pets.length ? '#DCFCE7' : '#F1F5F9',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.primaryDark }}>
                      {selectedPets.length === pets.length ? 'Chỉ chọn 1 bé' : `Chọn tất cả (${pets.length})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPetPicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.pickerButtonContent}>
                  <FontAwesome5
                    name={selectedPetObj ? getSpeciesIcon(selectedPetObj.species) : 'paw'}
                    size={18}
                    color={COLORS.primary}
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerButtonText}>
                      {selectedPetObjs.length > 0
                        ? selectedPetObjs.length === 1
                          ? selectedPetObjs[0].name
                          : `Đang chọn ${selectedPetObjs.length} bé: ${selectedPetObjs.map((p) => p.name).join(', ')}`
                        : 'Chọn bé cưng của bạn'}
                    </Text>
                    {selectedPetObjs.length === 1 && selectedPetObj && (
                      <Text style={styles.pickerSubText}>
                        Loài: {getSpeciesLabel(selectedPetObj.species)} • {selectedPetObj.breed || 'Chưa rõ giống'}
                      </Text>
                    )}
                    {selectedPetObjs.length > 1 && (
                      <Text style={styles.pickerSubText}>
                        Đặt lịch hàng loạt • Hệ thống tự động phân bổ khung giờ liên tiếp nếu vượt quá số ca/giờ
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 2. Chọn Phòng khám */}
            <View style={styles.cardSection}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>2</Text></View>
                <Text style={styles.sectionLabel}>Chuyên khoa / Phòng khám</Text>
              </View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowRoomPicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.pickerButtonContent}>
                  <FontAwesome5 name="hospital" size={18} color={COLORS.primary} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerButtonText}>
                      {selectedRoomObj ? `${selectedRoomObj.room_code} - ${selectedRoomObj.room_name}` : 'Chọn phòng khám'}
                    </Text>
                    {selectedRoomObj && (
                      <Text style={styles.pickerSubText}>
                        Tầng {selectedRoomObj.floor} • Tối đa {selectedRoomObj.max_slot_per_hour} ca/giờ ({maxSlotMinutes} phút/ca)
                      </Text>
                    )}
                  </View>
                </View>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* 3. Dịch vụ theo phòng */}
            {selectedRoom && (
              <View style={styles.cardSection}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>3</Text></View>
                  <Text style={styles.sectionLabel}>Dịch vụ y tế (Có thể chọn nhiều)</Text>
                </View>
                {services.length === 0 ? (
                  <Text style={styles.noDataText}>Chuyên khoa này hiện chưa cập nhật dịch vụ.</Text>
                ) : (
                  <View style={styles.serviceList}>
                    {services.map(service => {
                      const isSelected = selectedServices.includes(service.id);
                      return (
                        <TouchableOpacity
                          key={service.id}
                          style={[styles.serviceCard, isSelected && styles.serviceCardActive]}
                          onPress={() => {
                            setSelectedServices(current =>
                              current.includes(service.id)
                                ? current.filter(id => id !== service.id)
                                : [...current, service.id]
                            );
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.serviceInfo}>
                            <Text style={[styles.serviceName, isSelected && styles.serviceNameActive]}>
                              {service.service_name}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                              <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} style={{ marginRight: 3 }} />
                              <Text style={styles.serviceDetails}>{service.duration_minutes} phút</Text>
                              <Text style={[styles.serviceDetails, { marginHorizontal: 6 }]}>•</Text>
                              <Ionicons name="cash-outline" size={13} color={COLORS.primaryDark} style={{ marginRight: 3 }} />
                              <Text style={[styles.serviceDetails, { fontWeight: '700', color: COLORS.primaryDark }]}>
                                {Number(service.price).toLocaleString('vi-VN')} đ
                              </Text>
                            </View>
                          </View>
                          <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                            {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {/* 4. Ghi chú */}
            <View style={styles.cardSection}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                <Ionicons name="create-outline" size={16} color={COLORS.text} style={{ marginRight: 6 }} />
                <Text style={styles.sectionLabelWithoutStep}>Ghi chú hoặc mô tả triệu chứng (tùy chọn)</Text>
              </View>
              <TextInput
                style={[styles.notesTextInput, isEmergencyDetected && { borderColor: '#DC2626', backgroundColor: '#FEF2F2' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="Ví dụ: Bé bị nôn 2 lần từ sáng, bỏ ăn hạt, cần kiểm tra thêm tai..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />
              {isEmergencyDetected && (
                <View style={styles.emergencyTriageBanner}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <Ionicons name="alert-circle" size={18} color="#DC2626" style={{ marginRight: 6 }} />
                    <Text style={styles.emergencyTriageTitle}>
                      PHÁT HIỆN DẤU HIỆU CẤP CỨU NGUY KỊCH ({matchedEmergencyKeywords.join(', ')})
                    </Text>
                  </View>
                  <Text style={styles.emergencyTriageDesc}>
                    Theo tiêu chuẩn phân loại cấp cứu thú y (Emergency Triage), trường hợp này cần được xử trí ngay lập tức và KHÔNG NÊN đặt lịch hẹn chờ trực tuyến. Vui lòng đưa bé đến thẳng Sảnh Cấp Cứu Tầng 1 (P101/P102) để Bác sĩ tiếp nhận ưu tiên!
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* CỘT PHẢI: CHỌN NGÀY, GIỜ & SUMMARY CARD */}
          <View style={[styles.rightColumn, isTabletOrDesktop && styles.rightColumnDesktop]}>
            {/* Chọn Ngày */}
            <View style={styles.cardSection}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>4</Text></View>
                <Text style={styles.sectionLabel}>Ngày khám hẹn</Text>
              </View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowDatePicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.pickerButtonContent}>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickerButtonText}>
                      {selectedDate
                        ? new Date(selectedDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
                        : 'Bấm để chọn ngày khám (14 ngày tới)'}
                    </Text>
                  </View>
                </View>
                <Ionicons name="chevron-down" size={16} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Chọn Giờ */}
            {selectedDate && (
              <View style={styles.cardSection}>
                <View style={styles.sectionTitleRow}>
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>5</Text></View>
                  <Text style={styles.sectionLabel}>Khung giờ khám</Text>
                </View>
                {availability.length === 0 ? (
                  <View style={styles.loadingSlots}>
                    <ActivityIndicator size="small" color={COLORS.primary} />
                    <Text style={styles.loadingSlotsText}>Đang kiểm tra slot trống trong ngày...</Text>
                  </View>
                ) : (
                  <View style={styles.timeGrid}>
                    {availability.map((slot, idx) => {
                      const isSelected = selectedTime === slot.time;
                      return (
                        <TouchableOpacity
                          key={idx}
                          disabled={slot.isFull}
                          style={[
                            styles.timeSlot,
                            slot.isFull && styles.timeSlotDisabled,
                            isSelected && styles.timeSlotActive,
                          ]}
                          onPress={() => {
                            setSelectedTime(slot.time);
                            setBookingError('');
                          }}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.timeSlotText,
                              isSelected && styles.timeSlotTextActive,
                              slot.isFull && styles.timeSlotTextDisabled,
                            ]}
                          >
                            {slot.time}
                          </Text>
                          <Text
                            style={[
                              styles.timeSlotAvailable,
                              isSelected && styles.timeSlotAvailableActive,
                              slot.isFull && styles.timeSlotAvailableDisabled,
                            ]}
                          >
                            {slot.isFull ? 'Hết chỗ' : `Còn ${slot.available} chỗ`}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            )}

            {bookingError ? (
              <View style={styles.errorBox}>
                <Ionicons name="warning-outline" size={16} color={COLORS.warning} style={{ marginRight: 6 }} />
                <Text style={styles.errorText}>{bookingError}</Text>
              </View>
            ) : null}

            {bookingSuccess ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={20} color="#047857" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successText}>{bookingSuccess}</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('Appointments', { refresh: Date.now() })}>
                    <Text style={styles.successLink}>Xem lịch hẹn của tôi →</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => setBookingSuccess('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close" size={18} color="#047857" />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* SUMMARY CARD (Tóm Tắt Lịch Hẹn) */}
            <View style={styles.summaryCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <Ionicons name="clipboard-outline" size={18} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                <Text style={styles.summaryTitle}>Tóm tắt lịch hẹn</Text>
              </View>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Bé cưng ({petCount}):</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {selectedPetObjs.length > 0
                    ? selectedPetObjs.map((p) => `${p.name} (${getSpeciesLabel(p.species)})`).join(', ')
                    : '—'}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Phòng khám:</Text>
                <Text style={styles.summaryValue} numberOfLines={1}>{selectedRoomObj ? selectedRoomObj.room_name : '—'}</Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Dịch vụ ({selectedServiceObjs.length}):</Text>
                <Text style={styles.summaryValue} numberOfLines={2}>
                  {selectedServiceObjs.length > 0 ? selectedServiceObjs.map(s => s.service_name).join(', ') : '—'}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Thời lượng dự kiến:</Text>
                <Text style={styles.summaryValue}>
                  {selectedServiceObjs.length > 0
                    ? `${totalDurationMinutes} / ${maxSlotMinutes} phút (1 ca) × ${petCount} bé`
                    : '—'}
                </Text>
              </View>

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Khung giờ bắt đầu:</Text>
                <Text style={[styles.summaryValue, selectedTime && { color: COLORS.primaryDark, fontWeight: 'bold' }]}>
                  {selectedDate && selectedTime ? `${selectedTime} • ${selectedDate}` : '—'}
                </Text>
              </View>

              {petCount > 1 && selectedRoomObj && (
                <View
                  style={{
                    marginTop: 8,
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: '#EFF6FF',
                    borderWidth: 1,
                    borderColor: '#BFDBFE',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E40AF', marginBottom: 2 }}>
                    ⚡ Tự động phân bổ ca khám cho {petCount} thú cưng
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#1E3A8A', lineHeight: 17 }}>
                    Phòng {selectedRoomObj.room_code} tiếp nhận tối đa {selectedRoomObj.max_slot_per_hour} ca/giờ. Nếu số bé vượt quá số chỗ trống của khung giờ {selectedTime || 'đã chọn'}, hệ thống sẽ tự động xếp các bé tiếp theo sang khung giờ trống kế tiếp trong ngày!
                  </Text>
                </View>
              )}

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tổng chi phí ({petCount} bé):</Text>
                <Text style={styles.totalValue}>{totalPrice.toLocaleString('vi-VN')} đ</Text>
              </View>

              {requiresDeposit && totalPrice > 0 && (
                <View
                  style={{
                    marginTop: 10,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: '#FFFBEB',
                    borderWidth: 1,
                    borderColor: '#FDE68A',
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="qr-code-outline" size={16} color="#B45309" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#92400E' }}>
                      Yêu cầu đặt cọc trước 50% giữ chỗ
                    </Text>
                  </View>
                  <Text style={{ fontSize: 12, color: '#B45309', lineHeight: 17, marginBottom: 8 }}>
                    {petCount >= 3
                      ? `Đặt lịch hàng loạt từ 3 thú cưng trở lên (${petCount} bé) cần đặt cọc 50% chi phí dịch vụ.`
                      : `Bạn đã có ${existingTodayCount} lịch hẹn trong ngày ${selectedDate}. Đặt lịch từ thú cưng thứ 3 trở đi trong ngày cần đặt cọc 50%.`}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#92400E' }}>Tiền cọc 50% (Quét QR):</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#D97706' }}>
                      {depositAmount.toLocaleString('vi-VN')} đ
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 12, color: '#78350F' }}>Còn lại thanh toán tại Quầy Thu Ngân:</Text>
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#78350F' }}>
                      {Math.max(0, totalPrice - depositAmount).toLocaleString('vi-VN')} đ
                    </Text>
                  </View>
                  <View
                    style={{
                      marginTop: 8,
                      paddingTop: 8,
                      borderTopWidth: 1,
                      borderTopColor: '#FDE68A',
                    }}
                  >
                    <Text style={{ fontSize: 11.5, color: '#991B1B', lineHeight: 16, fontWeight: '600' }}>
                      ⚠️ Quy định hoàn/hủy cọc: Khách tự bấm hủy lịch trên ứng dụng sẽ mất 100% tiền cọc (chỉ hoàn cọc khi Bác sĩ/Viện hủy lịch). Nếu có lý do chính đáng cần hủy hoàn cọc, vui lòng liên hệ trực tiếp Hotline Bệnh viện: 1900 6868 (hoặc 024 3999 8888).
                    </Text>
                  </View>
                </View>
              )}

              {/* Button Đặt Lịch */}
              <TouchableOpacity
                style={[styles.bookButton, (!isFormComplete || submitting) && styles.bookButtonDisabled]}
                onPress={handleBooking}
                disabled={submitting || !isFormComplete}
                activeOpacity={0.8}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons
                      name={requiresDeposit ? 'qr-code-outline' : 'checkmark-circle-outline'}
                      size={18}
                      color="#fff"
                      style={{ marginRight: 6 }}
                    />
                    <Text style={styles.bookButtonText}>
                      {requiresDeposit
                        ? `Đặt Cọc QR 50% (${depositAmount.toLocaleString('vi-VN')}đ) & Đặt Lịch`
                        : petCount > 1
                        ? `Xác Nhận Đặt Lịch Hàng Loạt (${petCount} bé)`
                        : 'Xác Nhận Đặt Lịch'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Pet Picker Modal (Multi-select) */}
      <Modal visible={showPetPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Chọn thú cưng khám ({petCount}/{pets.length})</Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                  Tích chọn 1 hoặc nhiều bé để đặt lịch hàng loạt
                </Text>
              </View>
              <TouchableOpacity onPress={() => setShowPetPicker(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {pets.length > 1 && (
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingTop: 10 }}>
                <TouchableOpacity
                  onPress={toggleSelectAllPets}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: '#E0F2FE',
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#0369A1' }}>
                    {selectedPets.length === pets.length ? 'Chỉ chọn 1 bé đầu' : `Chọn tất cả (${pets.length} bé)`}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <FlatList
              data={pets}
              keyExtractor={p => p.id.toString()}
              renderItem={({ item }) => {
                const isSelected = selectedPets.includes(item.id);
                return (
                  <TouchableOpacity
                    style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                    onPress={() => toggleSelectPet(item.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <FontAwesome5
                        name={getSpeciesIcon(item.species)}
                        size={16}
                        color={isSelected ? COLORS.primaryDark : COLORS.primary}
                        style={{ marginRight: 10 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickerItemText, isSelected && styles.pickerItemTextActive]}>
                          {item.name}
                        </Text>
                        <Text style={styles.pickerItemSub}>
                          Loài: {getSpeciesLabel(item.species)} • {item.breed || 'Chưa rõ giống'}
                        </Text>
                      </View>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={isSelected ? COLORS.primary : COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                );
              }}
            />

            <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: COLORS.border }}>
              <TouchableOpacity
                style={[styles.bookButton, { marginTop: 0 }, petCount === 0 && styles.bookButtonDisabled]}
                disabled={petCount === 0}
                onPress={() => setShowPetPicker(false)}
              >
                <Text style={styles.bookButtonText}>Xong (Đã chọn {petCount} bé)</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Quét Mã QR Đặt Cọc 50% */}
      <Modal
        visible={showDepositQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDepositQrModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxWidth: 460, padding: 20 }]}>
            <View style={[styles.modalHeader, { paddingHorizontal: 0, paddingTop: 0 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Đặt Cọc 50% Giữ Chỗ Khám</Text>
                <Text style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: 2 }}>
                  Áp dụng khi đặt lịch hàng loạt ≥ 3 bé hoặc từ bé thứ 3 trở đi trong ngày
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowDepositQrModal(false)}
                style={styles.modalCloseBtn}
                disabled={submitting}
              >
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View
                style={{
                  alignItems: 'center',
                  backgroundColor: '#F0FDFA',
                  borderWidth: 1,
                  borderColor: '#99F6E4',
                  borderRadius: 16,
                  padding: 16,
                  marginVertical: 12,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#0F766E', marginBottom: 10 }}>
                  QUÉT MÃ QR ĐỂ ĐẶT CỌC 50% ({petCount} THÚ CƯNG)
                </Text>
                <View
                  style={{
                    backgroundColor: '#fff',
                    padding: 10,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                  }}
                >
                  <Image
                    source={{
                      uri: `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(
                        `PETCARE_DEPOSIT_50|NGAY:${selectedDate}|SO_PET:${petCount}|TIEN_COC:${depositAmount}VND`
                      )}`,
                    }}
                    style={{ width: 200, height: 200 }}
                    resizeMode="contain"
                  />
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A', marginTop: 10 }}>
                  BỆNH VIỆN THÚ Y ĐA KHOA PETCARE
                </Text>
                <Text style={{ fontSize: 22, fontWeight: '900', color: '#D97706', marginTop: 4 }}>
                  {depositAmount.toLocaleString('vi-VN')} đ
                </Text>
                <Text style={{ fontSize: 12, color: '#475569', marginTop: 4, textAlign: 'center' }}>
                  Nội dung CK: <Text style={{ fontWeight: '800' }}>COC50 {selectedDate} ({petCount} PET)</Text>
                </Text>
              </View>

              <View
                style={{
                  backgroundColor: '#F8FAFC',
                  borderRadius: 12,
                  padding: 12,
                  borderWidth: 1,
                  borderColor: '#E2E8F0',
                  marginBottom: 14,
                }}
              >
                {previewAllocations.length > 0 && (
                  <View style={{ marginBottom: 8, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E40AF', marginBottom: 2 }}>
                      ✓ Đã kiểm tra hợp lệ & giữ khung giờ dự kiến:
                    </Text>
                    <Text style={{ fontSize: 12, color: '#334155', lineHeight: 17 }}>
                      {previewAllocations.map((a) => `${a.pet_name} (${a.time_slot})`).join(' • ')}
                    </Text>
                  </View>
                )}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12.5, color: '#475569' }}>Tổng chi phí dự kiến ({petCount} bé):</Text>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0F172A' }}>
                    {totalPrice.toLocaleString('vi-VN')} đ
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 12.5, color: '#B45309', fontWeight: '700' }}>Đặt cọc ngay (50%):</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#D97706' }}>
                    -{depositAmount.toLocaleString('vi-VN')} đ
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12.5, color: '#047857', fontWeight: '700' }}>
                    Còn phải thu tại Quầy Thu Ngân:
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#047857' }}>
                    {Math.max(0, totalPrice - depositAmount).toLocaleString('vi-VN')} đ
                  </Text>
                </View>
              </View>

              <View
                style={{
                  backgroundColor: '#FEF2F2',
                  borderRadius: 10,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: '#FECACA',
                  marginBottom: 14,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="call-outline" size={15} color="#B91C1C" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 12, fontWeight: '800', color: '#991B1B' }}>
                    Quy định Hoàn / Hủy Tiền Cọc 50%
                  </Text>
                </View>
                <Text style={{ fontSize: 11.5, color: '#7F1D1D', lineHeight: 17 }}>
                  • Tự ý bấm hủy lịch trên ứng dụng hoặc vắng mặt (No-Show) sẽ bị <Text style={{ fontWeight: '800' }}>mất 100% tiền cọc</Text>.{'\n'}
                  • Tiền cọc chỉ được hoàn lại khi Bác sĩ / Bệnh viện hủy lịch. Nếu bạn muốn hủy lịch và được hỗ trợ hoàn cọc, vui lòng liên hệ trực tiếp SĐT Viện: <Text style={{ fontWeight: '800' }}>1900 6868 - 024 3999 8888</Text>.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.bookButton, { marginTop: 0 }, submitting && styles.bookButtonDisabled]}
                onPress={() => submitBookingRequest(true)}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="checkmark-done-circle-outline" size={19} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.bookButtonText}>Tôi Đã Chuyển Khoản Cọc 50% • Hoàn Tất</Text>
                  </View>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Room Picker Modal */}
      <Modal visible={showRoomPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn phòng khám</Text>
              <TouchableOpacity onPress={() => setShowRoomPicker(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={rooms}
              keyExtractor={r => r.id.toString()}
              renderItem={({ item }) => {
                const bookable = isRoomOnlineBookable(item);
                return (
                  <TouchableOpacity
                    disabled={!bookable}
                    style={[
                      styles.pickerItem,
                      selectedRoom === item.id && styles.pickerItemActive,
                      !bookable && { opacity: 0.55, backgroundColor: '#F8FAFC' },
                    ]}
                    onPress={() => {
                      if (!bookable) return;
                      setSelectedRoom(item.id);
                      setShowRoomPicker(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                        <Text style={[styles.pickerItemText, selectedRoom === item.id && styles.pickerItemTextActive]}>
                          {item.room_code} - {item.room_name}
                        </Text>
                        {!bookable && (
                          <View style={styles.referralOnlyBadge}>
                            <Text style={styles.referralOnlyBadgeText}>Chỉ định Bác sĩ</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.pickerItemSub}>
                        {bookable
                          ? `Tầng ${item.floor} • Tối đa ${item.max_slot_per_hour} ca/giờ (${Math.round(60 / Math.max(1, Number(item.max_slot_per_hour || 1)))} phút/ca)`
                          : `Tầng ${item.floor} • Phòng chuyên khoa sâu (Bác sĩ chỉ định sau khi khám tại P101/P102)`}
                      </Text>
                    </View>
                    {selectedRoom === item.id && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn ngày khám (14 ngày tới)</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={generateNextDays()}
              keyExtractor={d => d.date}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, selectedDate === item.date && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedDate(item.date);
                    setShowDatePicker(false);
                    setBookingError('');
                  }}
                >
                  <Text style={[styles.pickerItemText, selectedDate === item.date && styles.pickerItemTextActive]}>
                    {item.fullLabel}
                  </Text>
                  {selectedDate === item.date && <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  successBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#D1FAE5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  successText: {
    color: '#065F46',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  successLink: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 6,
    textDecorationLine: 'underline',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
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
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: '#FEE2E2',
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // Main Layout
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
    flex: 1.35,
  },
  rightColumn: {
    flex: 1,
  },
  rightColumnDesktop: {
    flex: 1,
  },

  // Card Section
  cardSection: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  sectionLabelWithoutStep: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },

  // Picker Button
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  pickerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  pickerSubText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  // Services
  serviceList: {
    gap: 10,
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  serviceCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  serviceInfo: {
    flex: 1,
  },
  serviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 2,
  },
  serviceNameActive: {
    color: COLORS.primaryDark,
    fontWeight: 'bold',
  },
  serviceDetails: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
  checkCircleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  noDataText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 14,
  },

  // Notes
  notesTextInput: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontSize: 13,
    color: COLORS.text,
    minHeight: 76,
    textAlignVertical: 'top',
  },

  // Time slots
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  timeSlot: {
    width: '31%',
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  timeSlotDisabled: {
    opacity: 0.45,
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  timeSlotActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  timeSlotText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  timeSlotTextActive: {
    color: COLORS.primaryDark,
  },
  timeSlotTextDisabled: {
    color: COLORS.textMuted,
  },
  timeSlotAvailable: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 3,
    fontWeight: '500',
  },
  timeSlotAvailableActive: {
    color: COLORS.primaryDark,
    fontWeight: '600',
  },
  timeSlotAvailableDisabled: {
    color: COLORS.textMuted,
  },
  loadingSlots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  loadingSlotsText: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  // Summary Card
  summaryCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    ...SHADOWS.md,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  summaryLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    width: 110,
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#CCFBF1',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  bookButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.sm,
  },
  bookButtonDisabled: {
    opacity: 0.5,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 520,
    maxHeight: '80%',
    padding: 20,
    ...SHADOWS.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
    borderRadius: 10,
  },
  pickerItemActive: {
    backgroundColor: COLORS.primaryLight,
  },
  pickerItemText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '600',
  },
  pickerItemTextActive: {
    color: COLORS.primaryDark,
  },
  pickerItemSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emergencyTriageBanner: {
    marginTop: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    borderRadius: 12,
    padding: 12,
  },
  emergencyTriageTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#991B1B',
    flex: 1,
  },
  emergencyTriageDesc: {
    fontSize: 12,
    color: '#B91C1C',
    lineHeight: 18,
    fontWeight: '500',
  },
  referralOnlyBadge: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  referralOnlyBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#B45309',
  },
});