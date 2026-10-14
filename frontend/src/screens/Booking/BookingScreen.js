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
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { getRoomsApi, getRoomServicesApi, getRoomAvailabilityApi } from '../../api/roomApi';
import { getMyPetsApi } from '../../api/petApi';
import { createAppointmentApi } from '../../api/appointmentApi';

export default function BookingScreen({ route, navigation }) {
  const { isTabletOrDesktop } = useResponsive();

  // State
  const [rooms, setRooms] = useState([]);
  const [services, setServices] = useState([]);
  const [pets, setPets] = useState([]);
  const [availability, setAvailability] = useState([]);

  // Selected values
  const [selectedRoom, setSelectedRoom] = useState(route?.params?.selectedRoomId || null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [selectedPet, setSelectedPet] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [notes, setNotes] = useState('');

  // UI state
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [bookingError, setBookingError] = useState('');
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [showPetPicker, setShowPetPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

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

  useFocusEffect(
    useCallback(() => {
      if (selectedRoom && selectedDate) {
        loadAvailability(selectedRoom, selectedDate);
      }
    }, [selectedRoom, selectedDate])
  );

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      const [roomsRes, petsRes] = await Promise.all([
        getRoomsApi(),
        getMyPetsApi()
      ]);

      if (roomsRes.data.success) {
        setRooms(roomsRes.data.data || []);
        if (route?.params?.selectedRoomId) {
          const room = roomsRes.data.data?.find(r => r.id === route.params.selectedRoomId);
          if (room) {
            setSelectedRoom(room.id);
          }
        } else if (roomsRes.data.data?.length > 0) {
          setSelectedRoom(roomsRes.data.data[0].id);
        }
      }

      if (petsRes.data.success) {
        setPets(petsRes.data.data || []);
        if (petsRes.data.data?.length > 0) {
          setSelectedPet(petsRes.data.data[0].id);
        }
      }
    } catch (err) {
      console.error('LOAD_INITIAL_DATA_ERROR:', err);
      setError('Lỗi khi tải dữ liệu. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
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
        date: date.toISOString().split('T')[0],
        label: date.toLocaleDateString('vi-VN', { weekday: 'short', month: '2-digit', day: '2-digit' }),
        fullLabel: date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }),
      });
    }
    return days;
  };

  const handleBooking = async () => {
    if (!selectedPet || !selectedRoom || selectedServices.length === 0 || !selectedDate || !selectedTime) {
      Alert.alert('Thông báo', 'Vui lòng chọn đầy đủ thông tin: thú cưng, phòng khám, dịch vụ, ngày và giờ khám.');
      return;
    }

    try {
      setSubmitting(true);
      setBookingError('');

      const appointmentDatetime = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();

      const response = await createAppointmentApi({
        pet_id: selectedPet,
        room_id: selectedRoom,
        service_id: selectedServices[0],
        service_ids: selectedServices,
        appointment_datetime: appointmentDatetime,
        notes: notes || null
      });

      if (response.data.success) {
        setSelectedServices([]);
        setSelectedTime(null);
        setSelectedDate(null);
        setNotes('');
        setAvailability([]);

        Alert.alert('Thành công', 'Đặt lịch thành công! Bác sĩ sẽ xác nhận lịch của bạn sớm.', [
          {
            text: 'Xem lịch hẹn',
            onPress: () => navigation.navigate('Appointments')
          },
          {
            text: 'Đặt lịch khác',
            style: 'cancel'
          }
        ]);
      }
    } catch (err) {
      setBookingError(err.response?.data?.message || 'Không thể đặt lịch. Vui lòng thử lại.');
      setSelectedTime(null);
      if (selectedRoom && selectedDate) {
        loadAvailability(selectedRoom, selectedDate);
      }
    } finally {
      setSubmitting(false);
    }
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
  const selectedPetObj = pets.find(p => p.id === selectedPet);
  const totalPrice = selectedServiceObjs.reduce((total, service) => total + Number(service.price || 0), 0);
  const isFormComplete = selectedPet && selectedRoom && selectedServices.length > 0 && selectedDate && selectedTime;

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header Banner */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Đặt Lịch Khám Bệnh 📅</Text>
            <Text style={styles.subtitle}>Chọn chuyên khoa, dịch vụ và khung giờ khám phù hợp cho bé cưng</Text>
          </View>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ {error}</Text>
          </View>
        ) : null}

        {/* 2-Column Split on Desktop, 1-Column on Mobile */}
        <View style={[styles.mainLayout, isTabletOrDesktop && styles.mainLayoutDesktop]}>
          
          {/* CỘT TRÁI: THÔNG TIN THÚ CƯNG, PHÒNG KHÁM, DỊCH VỤ, GHI CHÚ */}
          <View style={[styles.leftColumn, isTabletOrDesktop && styles.leftColumnDesktop]}>
            {/* 1. Chọn Thú cưng */}
            <View style={styles.cardSection}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>1</Text></View>
                <Text style={styles.sectionLabel}>Bé cưng cần khám</Text>
              </View>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={() => setShowPetPicker(true)}
                activeOpacity={0.7}
              >
                <View style={styles.pickerButtonContent}>
                  <Text style={styles.pickerIcon}>🐾</Text>
                  <View>
                    <Text style={styles.pickerButtonText}>
                      {selectedPetObj ? selectedPetObj.name : 'Chọn bé cưng của bạn'}
                    </Text>
                    {selectedPetObj && (
                      <Text style={styles.pickerSubText}>
                        Loài: {selectedPetObj.species === 'dog' ? 'Chó' : 'Mèo'} • {selectedPetObj.breed || 'Chưa rõ giống'}
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={styles.pickerArrow}>▼</Text>
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
                  <Text style={styles.pickerIcon}>🏥</Text>
                  <View>
                    <Text style={styles.pickerButtonText}>
                      {selectedRoomObj ? `${selectedRoomObj.room_code} - ${selectedRoomObj.room_name}` : 'Chọn phòng khám'}
                    </Text>
                    {selectedRoomObj && (
                      <Text style={styles.pickerSubText}>
                        Tầng {selectedRoomObj.floor} • Tối đa {selectedRoomObj.max_slot_per_hour} ca/giờ
                      </Text>
                    )}
                  </View>
                </View>
                <Text style={styles.pickerArrow}>▼</Text>
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
                            <Text style={styles.serviceDetails}>
                              ⏱️ {service.duration_minutes} phút • 💰 {Number(service.price).toLocaleString('vi-VN')} đ
                            </Text>
                          </View>
                          <View style={[styles.checkCircle, isSelected && styles.checkCircleActive]}>
                            {isSelected && <Text style={styles.checkText}>✓</Text>}
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
              <Text style={styles.sectionLabelWithoutStep}>📝 Ghi chú hoặc mô tả triệu chứng (tùy chọn)</Text>
              <TextInput
                style={styles.notesTextInput}
                value={notes}
                onChangeText={setNotes}
                placeholder="Ví dụ: Bé bị nôn 2 lần từ sáng, bỏ ăn hạt, cần kiểm tra thêm tai..."
                placeholderTextColor={COLORS.textMuted}
                multiline
                numberOfLines={3}
              />
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
                  <Text style={styles.pickerIcon}>📅</Text>
                  <View>
                    <Text style={styles.pickerButtonText}>
                      {selectedDate
                        ? new Date(selectedDate).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
                        : 'Bấm để chọn ngày khám (14 ngày tới)'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.pickerArrow}>▼</Text>
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
                            {slot.isFull ? 'Hết chỗ' : `Còn ${slot.available} slot`}
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
                <Text style={styles.errorText}>⚠️ {bookingError}</Text>
              </View>
            ) : null}

            {/* SUMMARY CARD (Tóm Tắt Lịch Hẹn) */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>📋 Tóm tắt lịch hẹn</Text>
              
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Bé cưng:</Text>
                <Text style={styles.summaryValue}>{selectedPetObj ? selectedPetObj.name : '—'}</Text>
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
                <Text style={styles.summaryLabel}>Thời gian:</Text>
                <Text style={[styles.summaryValue, selectedTime && { color: COLORS.primaryDark, fontWeight: 'bold' }]}>
                  {selectedDate && selectedTime ? `${selectedTime} • ${selectedDate}` : '—'}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tạm tính chi phí:</Text>
                <Text style={styles.totalValue}>{totalPrice.toLocaleString('vi-VN')} đ</Text>
              </View>

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
                  <Text style={styles.bookButtonText}>✅ Xác Nhận Đặt Lịch</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Pet Picker Modal */}
      <Modal visible={showPetPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn bé cưng</Text>
              <TouchableOpacity onPress={() => setShowPetPicker(false)} style={styles.modalCloseBtn}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={pets}
              keyExtractor={p => p.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, selectedPet === item.id && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedPet(item.id);
                    setShowPetPicker(false);
                  }}
                >
                  <View>
                    <Text style={[styles.pickerItemText, selectedPet === item.id && styles.pickerItemTextActive]}>
                      {item.name}
                    </Text>
                    <Text style={styles.pickerItemSub}>
                      Loài: {item.species === 'dog' ? 'Chó' : 'Mèo'} • {item.breed || 'Chưa rõ giống'}
                    </Text>
                  </View>
                  {selectedPet === item.id && <Text style={styles.modalCheck}>✓</Text>}
                </TouchableOpacity>
              )}
            />
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
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={rooms}
              keyExtractor={r => r.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.pickerItem, selectedRoom === item.id && styles.pickerItemActive]}
                  onPress={() => {
                    setSelectedRoom(item.id);
                    setShowRoomPicker(false);
                  }}
                >
                  <View>
                    <Text style={[styles.pickerItemText, selectedRoom === item.id && styles.pickerItemTextActive]}>
                      {item.room_code} - {item.room_name}
                    </Text>
                    <Text style={styles.pickerItemSub}>Tầng {item.floor} • Tối đa {item.max_slot_per_hour} ca/giờ</Text>
                  </View>
                  {selectedRoom === item.id && <Text style={styles.modalCheck}>✓</Text>}
                </TouchableOpacity>
              )}
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
                <Text style={styles.closeButton}>✕</Text>
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
                  {selectedDate === item.date && <Text style={styles.modalCheck}>✓</Text>}
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
    marginBottom: 10,
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
    gap: 12,
    flex: 1,
  },
  pickerIcon: {
    fontSize: 20,
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
  pickerArrow: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 8,
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
    marginBottom: 4,
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
  checkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
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
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#CCFBF1',
    backgroundColor: '#F0FDFA',
    ...SHADOWS.md,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginBottom: 14,
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
  closeButton: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
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
  modalCheck: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
});