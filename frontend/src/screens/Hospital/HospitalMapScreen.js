import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { getRoomsApi, getLiveRoomsOccupancyApi } from '../../api/roomApi';

const LIVE_REFRESH_INTERVAL_MS = 30000;

const STATUS_META = {
  available: { color: COLORS.success, bg: '#D1FAE5', textColor: '#047857', label: 'Trống chỗ' },
  busy: { color: COLORS.warning, bg: '#FEF3C7', textColor: '#B45309', label: 'Đang tiếp nhận' },
  full: { color: COLORS.danger, bg: '#FEE2E2', textColor: '#B91C1C', label: 'Kín lịch' },
};

// BR08: sinh hướng dẫn lối đi từ sảnh tiếp đón tới phòng dựa trên tầng & tọa độ
const getWayfindingSteps = (room) => {
  const steps = [
    { icon: 'exit-outline', text: 'Xuất phát từ sảnh tiếp đón chính (tầng trệt).' },
  ];
  if (room.floor > 1) {
    steps.push({ icon: 'arrow-up-circle-outline', text: `Di chuyển lên Tầng ${room.floor} bằng thang bộ hoặc thang máy.` });
  } else {
    steps.push({ icon: 'arrow-forward-circle-outline', text: 'Đi thẳng theo hành lang chính của tầng trệt.' });
  }
  const side = (room.coordinate_x ?? 0) % 2 === 0 ? 'bên trái' : 'bên phải';
  steps.push({ icon: 'compass-outline', text: `Rẽ ${side} theo biển chỉ dẫn, phòng ${room.room_code} nằm ở khu vực này.` });
  return steps;
};

export default function HospitalMapScreen({ navigation }) {
  const { isTabletOrDesktop, isWideScreen } = useResponsive();
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
        selectedRoomName: selectedRoom.room_name,
      });
      setShowRoomDetail(false);
    }
  };

  const filteredRooms = rooms.filter((room) => room.floor === selectedFloor);

  return (
    <ResponsiveContainer style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Sơ Đồ Bệnh Viện</Text>
          <Text style={styles.subtitle}>Mật độ và tình trạng tiếp nhận bệnh nhân theo thời gian thực</Text>
        </View>
      </View>

      {/* Floor Selector & Legend Row */}
      <View style={[styles.controlBar, isTabletOrDesktop && styles.controlBarDesktop]}>
        <View style={styles.segmentedSwitch}>
          {[1, 2].map((floor) => (
            <TouchableOpacity
              key={floor}
              style={[styles.segment, selectedFloor === floor && styles.segmentActive]}
              onPress={() => setSelectedFloor(floor)}
              activeOpacity={0.8}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <FontAwesome5
                  name="building"
                  size={13}
                  color={selectedFloor === floor ? COLORS.primaryDark : COLORS.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.segmentText, selectedFloor === floor && styles.segmentTextActive]}>
                  Tầng {floor} {floor === 1 ? '(Sảnh & Khám Nội)' : '(Chuyên Khoa & Spa)'}
                </Text>
              </View>
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
      </View>

      {/* Room Grid */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang cập nhật mật độ phòng khám thời gian thực...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="alert-circle" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <TouchableOpacity style={styles.retryButton} onPress={() => loadRooms()}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : filteredRooms.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Không tìm thấy phòng khám nào ở tầng này</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={[styles.roomGrid, isWideScreen && styles.roomGridWide, isTabletOrDesktop && !isWideScreen && styles.roomGridTablet]}>
            {filteredRooms.map((room) => {
              const meta = STATUS_META[room.status_indicator] || STATUS_META.available;
              const currentBookings = room.current_bookings ?? 0;
              const maxSlots = room.max_slot_per_hour || 1;
              const occupancyRatio = Math.min(currentBookings / maxSlots, 1);

              return (
                <TouchableOpacity
                  key={room.id}
                  style={[
                    styles.roomCard,
                    isWideScreen && styles.roomCardWide,
                    isTabletOrDesktop && !isWideScreen && styles.roomCardTablet,
                    { borderTopColor: meta.color },
                  ]}
                  onPress={() => handleRoomPress(room)}
                  activeOpacity={0.8}
                >
                  <View style={styles.roomCardTopRow}>
                    <View style={styles.roomCodeBadge}>
                      <Text style={styles.roomCode}>{room.room_code}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: meta.textColor }]}>
                        {room.status_label || meta.label}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.roomName}>{room.room_name}</Text>
                  
                  {room.description && (
                    <Text style={styles.roomDescription} numberOfLines={2}>
                      {room.description}
                    </Text>
                  )}

                  {/* Occupancy Progress Bar */}
                  <View style={styles.occupancyBarContainer}>
                    <View style={styles.occupancyTextRow}>
                      <Text style={styles.occupancyLabel}>Công suất giờ hiện tại:</Text>
                      <Text style={[styles.occupancyValue, { color: meta.color }]}>
                        {currentBookings}/{maxSlots} ca
                      </Text>
                    </View>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressBar, { width: `${occupancyRatio * 100}%`, backgroundColor: meta.color }]} />
                    </View>
                  </View>

                  <View style={styles.roomCardFooter}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="pill" size={14} color={COLORS.textSecondary} style={{ marginRight: 4 }} />
                      <Text style={styles.serviceCountText}>
                        {room.services?.length || 0} dịch vụ chuyên khoa
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.detailLinkText}>Xem chi tiết</Text>
                      <Ionicons name="arrow-forward" size={13} color={COLORS.primaryDark} style={{ marginLeft: 3 }} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Room Detail Modal */}
      <Modal
        visible={showRoomDetail && !!selectedRoom}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRoomDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isTabletOrDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Chi tiết phòng khám</Text>
                <Text style={styles.modalSubtitle}>Thông tin chuyên khoa & hướng dẫn lối đi</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRoomDetail(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedRoom && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                <View style={styles.roomDetailHeader}>
                  <View style={styles.roomDetailCodeBox}>
                    <Text style={styles.roomDetailCode}>{selectedRoom.room_code}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomDetailName}>{selectedRoom.room_name}</Text>
                    <Text style={styles.roomDetailFloor}>Vị trí: Tầng {selectedRoom.floor}</Text>
                  </View>
                </View>

                {selectedRoom.description && (
                  <View style={styles.detailSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Ionicons name="document-text-outline" size={15} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                      <Text style={styles.sectionLabel}>Chức năng chuyên môn:</Text>
                    </View>
                    <Text style={styles.sectionContent}>{selectedRoom.description}</Text>
                  </View>
                )}

                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="bar-chart-outline" size={15} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                    <Text style={styles.sectionLabel}>Năng lực & Công suất tiếp nhận:</Text>
                  </View>
                  <Text style={styles.sectionContent}>
                    • Tối đa: {selectedRoom.max_slot_per_hour} ca khám / mỗi khung giờ
                  </Text>
                  <Text style={styles.sectionContent}>
                    • Hiện tại: Đang có {selectedRoom.current_bookings ?? 0} ca hẹn ({selectedRoom.status_label || STATUS_META[selectedRoom.status_indicator]?.label})
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="compass-outline" size={16} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                    <Text style={styles.sectionLabel}>Chỉ dẫn lối đi trong viện:</Text>
                  </View>
                  {getWayfindingSteps(selectedRoom).map((step, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 3 }}>
                      <Ionicons name={step.icon} size={15} color={COLORS.primary} style={{ marginRight: 8 }} />
                      <Text style={styles.stepItemText}>{step.text}</Text>
                    </View>
                  ))}
                </View>

                {selectedRoom.services && selectedRoom.services.length > 0 && (
                  <View style={styles.detailSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <MaterialCommunityIcons name="pill" size={15} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                      <Text style={styles.sectionLabel}>Các dịch vụ thực hiện tại phòng ({selectedRoom.services.length}):</Text>
                    </View>
                    <View style={styles.serviceItemContainer}>
                      {selectedRoom.services.map((service) => (
                        <View key={service.id} style={styles.serviceItem}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.serviceName}>{service.service_name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                              <Ionicons name="time-outline" size={12} color={COLORS.textSecondary} style={{ marginRight: 3 }} />
                              <Text style={styles.serviceInfo}>
                                {service.duration_minutes} phút {service.description ? `• ${service.description}` : ''}
                              </Text>
                            </View>
                          </View>
                          <Text style={styles.servicePrice}>
                            {Number(service.price || 0).toLocaleString('vi-VN')} đ
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <TouchableOpacity
                  style={styles.bookingButton}
                  onPress={handleBookingRedirect}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="calendar-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.bookingButtonText}>Đặt Lịch Tại Phòng Này Ngay</Text>
                  </View>
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
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 16,
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

  // Control Bar
  controlBar: {
    marginBottom: 18,
    gap: 12,
  },
  controlBarDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segmentedSwitch: {
    flexDirection: 'row',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentActive: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.sm,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  segmentTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  // Room Grid
  roomGrid: {
    flexDirection: 'column',
    gap: 14,
  },
  roomGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  roomGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  roomCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 4,
    ...SHADOWS.sm,
  },
  roomCardTablet: {
    width: '48.5%',
  },
  roomCardWide: {
    width: '31.8%',
  },
  roomCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  roomCodeBadge: {
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  roomCode: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  roomName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 6,
  },
  roomDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  occupancyBarContainer: {
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  occupancyTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  occupancyLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  occupancyValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  roomCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    paddingTop: 10,
    marginTop: 4,
  },
  serviceCountText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  detailLinkText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },

  // Loading & Error States
  centerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 12,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
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
    borderRadius: 24,
    width: '100%',
    maxWidth: 560,
    maxHeight: '88%',
    padding: 22,
    ...SHADOWS.lg,
  },
  modalContentDesktop: {
    maxWidth: 600,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  modalSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    paddingVertical: 6,
  },
  roomDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  roomDetailCodeBox: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomDetailCode: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  roomDetailName: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  roomDetailFloor: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  detailSection: {
    marginBottom: 14,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  sectionContent: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
  },
  stepItemText: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 20,
    flex: 1,
  },
  serviceItemContainer: {
    gap: 8,
    marginTop: 4,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    padding: 12,
    borderRadius: 12,
  },
  serviceName: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  serviceInfo: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginLeft: 10,
  },
  bookingButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 8,
    ...SHADOWS.sm,
  },
  bookingButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
