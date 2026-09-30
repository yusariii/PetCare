import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal } from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { getRoomsApi, getLiveRoomsOccupancyApi } from '../../api/roomApi';

const LIVE_REFRESH_INTERVAL_MS = 30000;

const STATUS_META = {
  available: { color: COLORS.success, label: 'Trống chỗ' },
  busy: { color: COLORS.warning, label: 'Đang tiếp nhận' },
  full: { color: COLORS.danger, label: 'Kín lịch' },
};

// BR08: sinh hướng dẫn lối đi từ sảnh tiếp đón tới phòng dựa trên tầng & tọa độ
const getWayfindingSteps = (room) => {
  const steps = ['🚪 Xuất phát từ sảnh tiếp đón chính (tầng trệt).'];
  if (room.floor > 1) {
    steps.push(`🔼 Di chuyển lên Tầng ${room.floor} bằng thang bộ hoặc thang máy.`);
  } else {
    steps.push('➡️ Đi thẳng theo hành lang chính của tầng trệt.');
  }
  const side = (room.coordinate_x ?? 0) % 2 === 0 ? 'bên trái' : 'bên phải';
  steps.push(`🧭 Rẽ ${side} theo biển chỉ dẫn, phòng ${room.room_code} nằm ở khu vực này.`);
  return steps;
};

export default function HospitalMapScreen({ navigation }) {
  const [rooms, setRooms] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showRoomDetail, setShowRoomDetail] = useState(false);
  const [error, setError] = useState('');
  const pollingRef = useRef(null);

  useEffect(() => {
    loadRooms();
    pollingRef.current = setInterval(() => loadRooms({ silent: true }), LIVE_REFRESH_INTERVAL_MS);
    return () => clearInterval(pollingRef.current);
  }, []);

  const loadRooms = async ({ silent } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      const [occupancyRes, roomsRes] = await Promise.all([
        getLiveRoomsOccupancyApi(),
        getRoomsApi(),
      ]);

      if (occupancyRes.data.success) {
        const servicesById = (roomsRes.data.success ? roomsRes.data.data : []).reduce((map, room) => {
          map[room.id] = room.services || [];
          return map;
        }, {});
        const merged = occupancyRes.data.data.map((room) => ({
          ...room,
          services: servicesById[room.id] || [],
        }));
        setRooms(merged);
      } else if (!silent) {
        setError('Không thể tải danh sách phòng khám');
      }
    } catch (err) {
      console.error('LOAD_ROOMS_ERROR:', err);
      if (!silent) setError(err.response?.data?.message || 'Lỗi khi tải danh sách phòng khám');
    } finally {
      if (!silent) setLoading(false);
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
        <Text style={styles.subtitle}>Mật độ phòng khám theo thời gian thực</Text>
      </View>

      {/* Segmented Switch: Floor selector */}
      <View style={styles.segmentedSwitch}>
        {[1, 2].map((floor) => (
          <TouchableOpacity
            key={floor}
            style={[styles.segment, selectedFloor === floor && styles.segmentActive]}
            onPress={() => setSelectedFloor(floor)}
          >
            <Text style={[styles.segmentText, selectedFloor === floor && styles.segmentTextActive]}>
              Tầng {floor}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Legend */}
      <View style={styles.legendRow}>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <View key={key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: meta.color }]} />
            <Text style={styles.legendText}>{meta.label}</Text>
          </View>
        ))}
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
          <TouchableOpacity style={styles.retryButton} onPress={() => loadRooms()}>
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
            {filteredRooms.map((room) => {
              const meta = STATUS_META[room.status_indicator] || STATUS_META.available;
              return (
                <TouchableOpacity
                  key={room.id}
                  style={[styles.roomCard, { borderLeftColor: meta.color }]}
                  onPress={() => handleRoomPress(room)}
                >
                  <View style={styles.roomCardTopRow}>
                    <View style={styles.roomCodeBadge}>
                      <Text style={styles.roomCode}>{room.room_code}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.color }]}>
                      <Text style={styles.statusBadgeText}>{room.status_label || meta.label}</Text>
                    </View>
                  </View>
                  <Text style={styles.roomName}>{room.room_name}</Text>
                  <Text style={styles.roomInfo}>
                    🩺 Đang khám: {room.current_bookings ?? 0}/{room.max_slot_per_hour} ca
                  </Text>
                  {room.services && room.services.length > 0 && (
                    <Text style={styles.serviceCount}>
                      ✅ {room.services.length} dịch vụ
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
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
                  <Text style={styles.sectionContent}>
                    • Đang khám: {selectedRoom.current_bookings ?? 0}/{selectedRoom.max_slot_per_hour} ca ({selectedRoom.status_label || STATUS_META[selectedRoom.status_indicator]?.label})
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>🧭 Chỉ dẫn lối đi:</Text>
                  {getWayfindingSteps(selectedRoom).map((step, idx) => (
                    <Text key={idx} style={styles.sectionContent}>{step}</Text>
                  ))}
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
  segmentedSwitch: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: '#fff',
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 16,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
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
    borderLeftWidth: 5,
    elevation: 2,
  },
  roomCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  roomCodeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  roomCode: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statusBadge: {
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
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
