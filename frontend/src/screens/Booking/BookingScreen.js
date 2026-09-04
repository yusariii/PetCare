import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, ScrollView, Modal, FlatList } from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { getRoomsApi, getRoomServicesApi, getRoomAvailabilityApi } from '../../api/roomApi';
import { getMyPetsApi } from '../../api/petApi';
import { createAppointmentApi } from '../../api/appointmentApi';

export default function BookingScreen({ route, navigation }) {
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
        label: date.toLocaleDateString('vi-VN', { weekday: 'short', month: '2-digit', day: '2-digit' })
      });
    }
    return days;
  };

  const handleBooking = async () => {
    if (!selectedPet || !selectedRoom || selectedServices.length === 0 || !selectedDate || !selectedTime) {
      Alert.alert('Thông báo', 'Vui lòng chọn đầy đủ thông tin');
      return;
    }

    try {
      setSubmitting(true);

      // Format appointment datetime
      const [hours] = selectedTime.split(':');
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
        Alert.alert('Thành công', 'Đặt lịch thành công! Bác sĩ sẽ xác nhận lịch của bạn sớm.', [
          {
            text: 'Xem lịch hẹn',
            onPress: () => navigation.navigate('Appointments')
          }
        ]);
      }
    } catch (err) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể đặt lịch. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ResponsiveContainer style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải dữ liệu...</Text>
      </ResponsiveContainer>
    );
  }

  const selectedRoomObj = rooms.find(r => r.id === selectedRoom);
  const selectedServiceObjs = services.filter(service => selectedServices.includes(service.id));
  const selectedPetObj = pets.find(p => p.id === selectedPet);

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>📅 Đặt Lịch Khám</Text>
          <Text style={styles.subtitle}>Chọn phòng khám, dịch vụ và thời gian</Text>
        </View>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>❌ {error}</Text>
          </View>
        ) : null}

        {/* Thú cưng */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>🐾 Thú cưng *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowPetPicker(true)}
          >
            <Text style={styles.pickerButtonText}>
              {selectedPetObj ? `${selectedPetObj.name} (${selectedPetObj.species})` : 'Chọn thú cưng'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Phòng khám */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>🏥 Phòng khám *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowRoomPicker(true)}
          >
            <Text style={styles.pickerButtonText}>
              {selectedRoomObj ? `${selectedRoomObj.room_code} - ${selectedRoomObj.room_name}` : 'Chọn phòng khám'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Dịch vụ */}
        {selectedRoom && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>💊 Dịch vụ *</Text>
            {services.length === 0 ? (
              <Text style={styles.noDataText}>Không có dịch vụ nào</Text>
            ) : (
              <View>
                {services.map(service => (
                  <TouchableOpacity
                    key={service.id}
                    style={[
                      styles.serviceCard,
                      selectedServices.includes(service.id) && styles.serviceCardActive
                    ]}
                    onPress={() => {
                      setSelectedServices(current => current.includes(service.id)
                        ? current.filter(id => id !== service.id)
                        : [...current, service.id]);
                    }}
                  >
                    <View style={styles.serviceInfo}>
                      <Text style={styles.serviceName}>{service.service_name}</Text>
                      <Text style={styles.serviceDetails}>
                        ⏱️ {service.duration_minutes}min • 💰 {service.price.toLocaleString('vi-VN')}đ
                      </Text>
                    </View>
                    {selectedServices.includes(service.id) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
                {selectedServiceObjs.length > 0 && (
                  <Text style={styles.selectedServicesText}>
                    Đã chọn {selectedServiceObjs.length} dịch vụ • {selectedServiceObjs.reduce((total, service) => total + Number(service.price || 0), 0).toLocaleString('vi-VN')}đ
                  </Text>
                )}
              </View>
            )}
          </View>
        )}

        {/* Ngày */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>📅 Ngày *</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowDatePicker(true)}
          >
            <Text style={styles.pickerButtonText}>
              {selectedDate ? new Date(selectedDate).toLocaleDateString('vi-VN') : 'Chọn ngày'}
            </Text>
            <Text style={styles.pickerArrow}>▼</Text>
          </TouchableOpacity>
        </View>

        {/* Giờ */}
        {selectedDate && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>⏰ Giờ *</Text>
            {availability.length === 0 ? (
              <Text style={styles.noDataText}>Đang tải lịch trống...</Text>
            ) : (
              <View style={styles.timeGrid}>
                {availability.map((slot, idx) => (
                  <TouchableOpacity
                    key={idx}
                    disabled={slot.isFull}
                    style={[
                      styles.timeSlot,
                      slot.isFull && styles.timeSlotDisabled,
                      selectedTime === slot.time && styles.timeSlotActive
                    ]}
                    onPress={() => setSelectedTime(slot.time)}
                  >
                    <Text style={[
                      styles.timeSlotText,
                      selectedTime === slot.time && styles.timeSlotTextActive,
                      slot.isFull && styles.timeSlotTextDisabled
                    ]}>
                      {slot.time}
                    </Text>
                    <Text style={[styles.timeSlotAvailable, slot.isFull && styles.timeSlotAvailableDisabled]}>
                      {slot.available}/{slot.booked}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Ghi chú */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>📝 Ghi chú (tùy chọn)</Text>
          <TouchableOpacity style={styles.notesInput}>
            <Text style={{ color: COLORS.textSecondary }}>Nhập ghi chú cho bác sĩ...</Text>
          </TouchableOpacity>
        </View>

        {/* Button đặt lịch */}
        <TouchableOpacity
          style={[styles.bookButton, !selectedPet && styles.bookButtonDisabled]}
          onPress={handleBooking}
          disabled={submitting || !selectedPet || !selectedRoom || selectedServices.length === 0 || !selectedDate || !selectedTime}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.bookButtonText}>✅ Xác Nhận Đặt Lịch</Text>
          )}
        </TouchableOpacity>

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Pet Picker Modal */}
      <Modal visible={showPetPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowPetPicker(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Chọn thú cưng</Text>
              <View style={{ width: 30 }} />
            </View>
            <FlatList
              data={pets}
              keyExtractor={p => p.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    setSelectedPet(item.id);
                    setShowPetPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>
                    {item.name} ({item.species})
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Room Picker Modal */}
      <Modal visible={showRoomPicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowRoomPicker(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Chọn phòng khám</Text>
              <View style={{ width: 30 }} />
            </View>
            <FlatList
              data={rooms}
              keyExtractor={r => r.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    setSelectedRoom(item.id);
                    setShowRoomPicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>
                    {item.room_code} - {item.room_name}
                  </Text>
                  <Text style={styles.pickerItemSub}>Tầng {item.floor} • {item.max_slot_per_hour} ca/h</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Chọn ngày</Text>
              <View style={{ width: 30 }} />
            </View>
            <FlatList
              data={generateNextDays()}
              keyExtractor={d => d.date}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => {
                    setSelectedDate(item.date);
                    setShowDatePicker(false);
                  }}
                >
                  <Text style={styles.pickerItemText}>{item.label}</Text>
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
    flex: 1,
    backgroundColor: COLORS.background,
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
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  errorBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.danger,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 13,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  pickerButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerButtonText: {
    fontSize: 13,
    color: COLORS.text,
  },
  pickerArrow: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  noDataText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  serviceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 2,
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
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  serviceDetails: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  checkmark: {
    fontSize: 18,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  selectedServicesText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
    textAlign: 'right',
    marginTop: 2,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSlot: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  timeSlotDisabled: {
    opacity: 0.5,
    backgroundColor: '#f5f5f5',
  },
  timeSlotActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  timeSlotText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  timeSlotTextActive: {
    color: COLORS.primary,
  },
  timeSlotTextDisabled: {
    color: COLORS.textSecondary,
  },
  timeSlotAvailable: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  timeSlotAvailableDisabled: {
    color: '#999',
  },
  notesInput: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 80,
    justifyContent: 'flex-start',
    paddingTop: 12,
  },
  bookButton: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  bookButtonDisabled: {
    opacity: 0.5,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingTop: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    fontSize: 24,
    color: COLORS.textSecondary,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  pickerItem: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerItemText: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: '500',
  },
  pickerItemSub: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});