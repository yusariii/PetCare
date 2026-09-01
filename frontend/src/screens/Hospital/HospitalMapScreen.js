import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Modal, FlatList } from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { getRoomsApi } from '../../api/roomApi';

export default function HospitalMapScreen({ navigation }) {
  const [rooms, setRooms] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showRoomDetail, setShowRoomDetail] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadRooms();
  }, []);

  const loadRooms = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getRoomsApi();
      if (response.data.success) {
        setRooms(response.data.data);
      } else {
        setError('Không thể tải danh sách phòng khám');
      }
    } catch (err) {
      console.error('LOAD_ROOMS_ERROR:', err);
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách phòng khám');
    } finally {
      setLoading(false);
    }
  };

  const handleRoomPress = (room) => {
    setSelectedRoom(room);
    setShowRoomDetail(true);
  };

  const handleBookingRedirect = () => {
    if (selectedRoom) {
      navigation.navigate('Booking', { 
        selectedRoomId: selectedRoom.id,
        selectedRoomName: selectedRoom.room_name 
      });
      setShowRoomDetail(false);
    }
  };

  const filteredRooms = rooms.filter(room => room.floor === selectedFloor);

  return (
    <ResponsiveContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🏥 Bản Đồ Bệnh Viện</Text>
        <Text style={styles.subtitle}>Chọn phòng khám chuyên khoa</Text>
      </View>

      {/* Floor Selector */}
      <View style={styles.floorSelector}>
        <TouchableOpacity 
          style={[styles.floorButton, selectedFloor === 1 && styles.floorButtonActive]}
          onPress={() => setSelectedFloor(1)}
        >
          <Text style={[styles.floorButtonText, selectedFloor === 1 && styles.floorButtonTextActive]}>
            Tầng 1 - Cấp Cứu & Khám Nội
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.floorButton, selectedFloor === 2 && styles.floorButtonActive]}
          onPress={() => setSelectedFloor(2)}
        >
          <Text style={[styles.floorButtonText, selectedFloor === 2 && styles.floorButtonTextActive]}>
            Tầng 2 - Da Liễu & Chẩn Đoán
          </Text>
        </TouchableOpacity>
      </View>

      {/* Room Grid */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách phòng...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadRooms}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : filteredRooms.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Không có phòng khám tầng này</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.roomGrid}>
            {filteredRooms.map((room, index) => (
              <TouchableOpacity
                key={room.id}
                style={styles.roomCard}
                onPress={() => handleRoomPress(room)}
              >
                <View style={styles.roomCodeBadge}>
                  <Text style={styles.roomCode}>{room.room_code}</Text>
                </View>
                <Text style={styles.roomName}>{room.room_name}</Text>
                <Text style={styles.roomInfo}>
                  📊 Max: {room.max_slot_per_hour} ca/giờ
                </Text>
                {room.services && room.services.length > 0 && (
                  <Text style={styles.serviceCount}>
                    ✅ {room.services.length} dịch vụ
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Room Detail Modal */}
      <Modal
        visible={showRoomDetail}
        transparent
        animationType="slide"
        onRequestClose={() => setShowRoomDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowRoomDetail(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Chi tiết phòng khám</Text>
              <View style={{ width: 30 }} />
            </View>

            {selectedRoom && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                <View style={styles.roomDetailHeader}>
                  <Text style={styles.roomDetailCode}>{selectedRoom.room_code}</Text>
                  <Text style={styles.roomDetailName}>{selectedRoom.room_name}</Text>
                </View>

                {selectedRoom.description && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionLabel}>📝 Mô tả:</Text>
                    <Text style={styles.sectionContent}>{selectedRoom.description}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>📊 Thông tin:</Text>
                  <Text style={styles.sectionContent}>
                    • Tầng: {selectedRoom.floor}
                  </Text>
                  <Text style={styles.sectionContent}>
                    • Năng lực: {selectedRoom.max_slot_per_hour} ca/giờ
                  </Text>
                </View>

                {selectedRoom.services && selectedRoom.services.length > 0 && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionLabel}>💊 Dịch vụ:</Text>
                    {selectedRoom.services.map((service, idx) => (
                      <View key={service.id} style={styles.serviceItem}>
                        <Text style={styles.serviceName}>{service.service_name}</Text>
                        <Text style={styles.serviceInfo}>
                          💰 {(service.price || 0).toLocaleString('vi-VN')}đ • ⏱️ {service.duration_minutes}min
                        </Text>
                        {service.description && (
                          <Text style={styles.serviceDesc}>{service.description}</Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                <TouchableOpacity
                  style={styles.bookingButton}
                  onPress={handleBookingRedirect}
                >
                  <Text style={styles.bookingButtonText}>📅 Đặt Lịch Tại Phòng Này</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
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
  floorSelector: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
  },
  floorButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  floorButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  floorButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  floorButtonTextActive: {
    color: '#fff',
  },
  roomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 16,
    gap: 12,
  },
  roomCard: {
    width: '48%',
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },
  roomCodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  roomCode: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  roomName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 8,
  },
  roomInfo: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  serviceCount: {
    fontSize: 11,
    color: COLORS.success,
    fontWeight: '500',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  errorText: {
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 12,
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
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
    maxHeight: '90%',
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
    padding: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  roomDetailHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  roomDetailCode: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  roomDetailName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  detailSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 8,
  },
  sectionContent: {
    fontSize: 12,
    color: COLORS.text,
    lineHeight: 18,
  },
  serviceItem: {
    backgroundColor: COLORS.background,
    padding: 10,
    borderRadius: 8,
    marginBottom: 8,
  },
  serviceName: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 4,
  },
  serviceInfo: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  serviceDesc: {
    fontSize: 11,
    color: COLORS.text,
    fontStyle: 'italic',
    marginTop: 4,
  },
  bookingButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 16,
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
