import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import {
  getMyAppointmentsApi,
  cancelAppointmentApi,
  getAllAppointmentsApi,
  updateAppointmentStatusApi,
} from '../../api/appointmentApi';
import { createReviewApi } from '../../api/reviewApi';
import { getRoomsApi } from '../../api/roomApi';

const STATUS_FILTERS = [
  ['all', 'Tất cả'],
  ['pending', 'Chờ duyệt'],
  ['confirmed', 'Đã xác nhận'],
  ['completed', 'Hoàn thành'],
  ['cancelled', 'Đã hủy'],
];

export default function AppointmentsScreen() {
  const { isTabletOrDesktop } = useResponsive();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('customer');
  const [roleReady, setRoleReady] = useState(false);
  const [rooms, setRooms] = useState([]);
  const [roomFilter, setRoomFilter] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [error, setError] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  const isAdmin = userRole === 'admin';

  useEffect(() => {
    AsyncStorage.getItem('user')
      .then((user) => {
        if (user) setUserRole(JSON.parse(user).role || 'customer');
      })
      .catch((err) => console.error('Error loading user role:', err))
      .finally(() => setRoleReady(true));
  }, []);

  useEffect(() => {
    if (isAdmin) {
      getRoomsApi()
        .then((res) => setRooms(res.data.success ? res.data.data || [] : []))
        .catch(() => setRooms([]));
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!roleReady) return;
    if (dateFilter && !/^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) return;
    loadAppointments();
  }, [roleReady, userRole, roomFilter, statusFilter, dateFilter]);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError('');

      let response;
      if (userRole === 'customer') {
        response = await getMyAppointmentsApi();
      } else {
        const params = {};
        if (isAdmin) {
          if (roomFilter) params.room_id = roomFilter;
          if (statusFilter !== 'all') params.status = statusFilter;
          if (dateFilter) params.date = dateFilter;
        }
        response = await getAllAppointmentsApi(params);
      }

      if (response.data.success) {
        setAppointments(response.data.data || []);
      } else {
        setError('Không thể tải danh sách lịch hẹn');
      }
    } catch (err) {
      console.error('LOAD_APPOINTMENTS_ERROR:', err);
      setError(err.response?.data?.message || 'Lỗi khi tải danh sách lịch hẹn');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments();
    setRefreshing(false);
  };

  const handleCancelAppointment = async (appointmentId) => {
    Alert.alert(
      'Xác nhận hủy lịch',
      'Bạn chắc chắn muốn hủy lịch hẹn này?',
      [
        { text: 'Không', onPress: () => {} },
        {
          text: 'Hủy lịch',
          onPress: async () => {
            try {
              const response = await cancelAppointmentApi(appointmentId);
              if (response.data.success) {
                Alert.alert('Thành công', 'Hủy lịch hẹn thành công');
                await loadAppointments();
              }
            } catch (err) {
              Alert.alert('Lỗi', err.response?.data?.message || 'Không thể hủy lịch hẹn');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    try {
      setUpdatingId(appointmentId);
      const response = await updateAppointmentStatusApi(appointmentId, { status: newStatus });
      if (response.data.success) {
        Alert.alert('Thành công', 'Cập nhật trạng thái thành công');
        await loadAppointments();
        setShowDetail(false);
      }
    } catch (err) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể cập nhật trạng thái');
    } finally {
      setUpdatingId(null);
    }
  };

  const getStatusBadgeMeta = (status) => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', textColor: '#B45309', label: 'Chờ duyệt' };
      case 'confirmed':
        return { bg: '#E0F2FE', textColor: '#0369A1', label: 'Đã xác nhận' };
      case 'completed':
        return { bg: '#D1FAE5', textColor: '#047857', label: 'Hoàn thành' };
      case 'cancelled':
        return { bg: '#FEE2E2', textColor: '#B91C1C', label: 'Đã hủy' };
      default:
        return { bg: '#F1F5F9', textColor: '#475569', label: status };
    }
  };

  const submitReview = async () => {
    try {
      setSubmittingReview(true);
      await createReviewApi({
        appointment_id: selectedAppointment.id,
        rating: reviewRating,
        comment: reviewComment || undefined,
      });
      Alert.alert('Cảm ơn bạn!', 'Đánh giá của bạn đã được ghi nhận.');
      setReviewComment('');
      setReviewRating(5);
      setShowDetail(false);
    } catch (err) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể gửi đánh giá');
    } finally {
      setSubmittingReview(false);
    }
  };

  const filteredAppointments = userRole === 'customer' && statusFilter !== 'all'
    ? appointments.filter(a => a.status === statusFilter)
    : appointments;

  return (
    <ResponsiveContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quản Lý Lịch Hẹn 📋</Text>
        <Text style={styles.subtitle}>
          {isAdmin
            ? 'Toàn bộ lịch hẹn của viện (chế độ giám sát Admin)'
            : userRole === 'doctor'
            ? 'Quản lý danh sách ca khám phụ trách'
            : 'Theo dõi tiến độ và lịch sử khám bệnh của các bé'}
        </Text>
      </View>

      {/* Customer Status Filter Pills */}
      {userRole === 'customer' && (
        <View style={styles.filterContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.filterPillRow}
          >
            {STATUS_FILTERS.map(([value, label]) => {
              const isSelected = statusFilter === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.filterPill, isSelected && styles.filterPillActive]}
                  onPress={() => setStatusFilter(value)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterPillText, isSelected && styles.filterPillTextActive]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* Admin Filters */}
      {isAdmin && (
        <View style={styles.filterBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.chipRow}
          >
            <TouchableOpacity
              style={[styles.chip, !roomFilter && styles.chipSelected]}
              onPress={() => setRoomFilter(null)}
            >
              <Text style={!roomFilter ? styles.chipTextSelected : styles.chipText}>Mọi phòng</Text>
            </TouchableOpacity>
            {rooms.map((room) => (
              <TouchableOpacity
                key={room.id}
                style={[styles.chip, roomFilter === room.id && styles.chipSelected]}
                onPress={() => setRoomFilter(room.id)}
              >
                <Text style={roomFilter === room.id ? styles.chipTextSelected : styles.chipText}>
                  {room.room_code}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScrollView}
            contentContainerStyle={styles.chipRow}
          >
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

          <TextInput
            style={styles.dateFilterInput}
            value={dateFilter}
            onChangeText={setDateFilter}
            placeholder="Lọc theo ngày (YYYY-MM-DD), để trống = tất cả"
            placeholderTextColor={COLORS.textMuted}
            maxLength={10}
          />
        </View>
      )}

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải danh sách lịch hẹn...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAppointments}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : filteredAppointments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📅</Text>
          <Text style={styles.emptyTitle}>Chưa có lịch hẹn nào</Text>
          <Text style={styles.emptySubtitle}>Các lịch khám của bé cưng sẽ xuất hiện tại đây sau khi được đặt.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listScrollView}
          contentContainerStyle={styles.listScrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        >
          <View style={[styles.appointmentGrid, isTabletOrDesktop && styles.appointmentGridDesktop]}>
            {filteredAppointments.map((apt) => {
              const badge = getStatusBadgeMeta(apt.status);
              const dateObj = new Date(apt.appointment_datetime);
              const dateFormatted = dateObj.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
              const timeFormatted = dateObj.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

              return (
                <TouchableOpacity
                  key={apt.id}
                  style={[styles.appointmentCard, isTabletOrDesktop && styles.appointmentCardDesktop]}
                  onPress={() => {
                    setSelectedAppointment(apt);
                    setShowDetail(true);
                  }}
                  activeOpacity={0.8}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardPetHeader}>
                      <View style={styles.petAvatarBadge}>
                        <Text style={styles.petAvatarIcon}>🐾</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.petName} numberOfLines={1}>{apt.pet_name}</Text>
                        <Text style={styles.roomInfo} numberOfLines={1}>{apt.room_code} - {apt.room_name}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.statusText, { color: badge.textColor }]}>{badge.label}</Text>
                    </View>
                  </View>

                  <View style={styles.cardDivider} />

                  <View style={styles.cardBody}>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoIcon}>📅</Text>
                      <Text style={styles.dateTimeText}>
                        {dateFormatted} lúc {timeFormatted}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Text style={styles.infoIcon}>💊</Text>
                      <Text style={styles.serviceText} numberOfLines={1}>{apt.service_name}</Text>
                    </View>
                    {apt.price && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoIcon}>💰</Text>
                        <Text style={styles.priceText}>{Number(apt.price).toLocaleString('vi-VN')} đ</Text>
                      </View>
                    )}
                    {isAdmin && (
                      <>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoIcon}>👤</Text>
                          <Text style={styles.adminInfoText} numberOfLines={1}>{apt.customer_info}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <Text style={styles.infoIcon}>👨‍⚕️</Text>
                          <Text style={styles.adminInfoText} numberOfLines={1}>
                            {apt.room_doctor_name || 'Chưa phân công bác sĩ'}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Customer cancel action */}
                  {userRole === 'customer' && apt.status === 'pending' && (
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleCancelAppointment(apt.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.cancelButtonText}>✕ Hủy lịch hẹn</Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={{ height: 32 }} />
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal
        visible={showDetail && !!selectedAppointment}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isTabletOrDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chi tiết lịch hẹn 📋</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.modalCloseBtn}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {selectedAppointment && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>🐾 Bé cưng:</Text>
                  <Text style={styles.sectionValue}>
                    {selectedAppointment.pet_name} {selectedAppointment.species ? `(${selectedAppointment.species})` : ''}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>🏥 Chuyên khoa / Phòng:</Text>
                  <Text style={styles.sectionValue}>
                    {selectedAppointment.room_code} - {selectedAppointment.room_name}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>💊 Dịch vụ đăng ký:</Text>
                  <Text style={styles.sectionValue}>{selectedAppointment.service_name}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>📅 Thời gian khám:</Text>
                  <Text style={styles.sectionValue}>
                    {new Date(selectedAppointment.appointment_datetime).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} lúc {new Date(selectedAppointment.appointment_datetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                {selectedAppointment.price && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionLabel}>💰 Chi phí dịch vụ:</Text>
                    <Text style={[styles.sectionValue, { fontWeight: 'bold', color: COLORS.primaryDark }]}>
                      {Number(selectedAppointment.price).toLocaleString('vi-VN')} đ
                    </Text>
                  </View>
                )}

                {isAdmin && (
                  <>
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionLabel}>👤 Khách hàng:</Text>
                      <Text style={styles.sectionValue}>{selectedAppointment.customer_info}</Text>
                    </View>
                    <View style={styles.detailSection}>
                      <Text style={styles.sectionLabel}>👨‍⚕️ Bác sĩ phòng khám:</Text>
                      <Text style={styles.sectionValue}>{selectedAppointment.room_doctor_name || 'Chưa phân công'}</Text>
                    </View>
                    {selectedAppointment.review_rating ? (
                      <View style={styles.detailSection}>
                        <Text style={styles.sectionLabel}>⭐ Đánh giá của khách:</Text>
                        <Text style={styles.sectionValue}>
                          {'⭐'.repeat(selectedAppointment.review_rating)}{selectedAppointment.review_comment ? ` — "${selectedAppointment.review_comment}"` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </>
                )}

                {selectedAppointment.notes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionLabel}>📝 Ghi chú ban đầu:</Text>
                    <Text style={styles.sectionValue}>{selectedAppointment.notes}</Text>
                  </View>
                )}

                {/* Doctor actions */}
                {userRole === 'doctor' && (
                  <View style={styles.actionSection}>
                    {selectedAppointment.status === 'pending' && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.confirmButton]}
                        onPress={() => handleUpdateStatus(selectedAppointment.id, 'confirmed')}
                        disabled={updatingId !== null}
                      >
                        {updatingId === selectedAppointment.id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.actionButtonText}>✅ Xác Nhận Tiếp Nhận</Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {selectedAppointment.status === 'confirmed' && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.completeButton]}
                        onPress={() => handleUpdateStatus(selectedAppointment.id, 'completed')}
                        disabled={updatingId !== null}
                      >
                        {updatingId === selectedAppointment.id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.actionButtonText}>🎉 Hoàn Thành Ca Khám</Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {(selectedAppointment.status === 'pending' || selectedAppointment.status === 'confirmed') && (
                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelActionButton]}
                        onPress={() => handleUpdateStatus(selectedAppointment.id, 'cancelled')}
                        disabled={updatingId !== null}
                      >
                        {updatingId === selectedAppointment.id ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.actionButtonText}>✕ Hủy Ca Khám</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Customer Review Section */}
                {userRole === 'customer' && selectedAppointment.status === 'completed' && (
                  <View style={styles.reviewBox}>
                    <Text style={styles.reviewBoxTitle}>⭐ Đánh giá ca khám này:</Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                          <Text style={styles.starIcon}>{star <= reviewRating ? '⭐' : '☆'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={styles.reviewInput}
                      placeholder="Nhập cảm nhận của bạn về sự chăm sóc của bác sĩ..."
                      placeholderTextColor={COLORS.textMuted}
                      value={reviewComment}
                      onChangeText={setReviewComment}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.actionButton, styles.confirmButton]}
                      onPress={submitReview}
                      disabled={submittingReview}
                    >
                      {submittingReview ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.actionButtonText}>Gửi Đánh Giá</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
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
    flexShrink: 0,
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
    lineHeight: 18,
  },

  // Filter Pills (Customer)
  filterContainer: {
    flexShrink: 0,
    marginBottom: 16,
  },
  filterScrollView: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterPillActive: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
  filterPillTextActive: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },

  // Admin Filter Bar
  filterBar: {
    marginBottom: 16,
    gap: 8,
    flexShrink: 0,
  },
  chipRow: {
    gap: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 12,
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  dateFilterInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 10,
    backgroundColor: COLORS.surface,
    color: COLORS.text,
    fontSize: 13,
  },

  listScrollView: {
    flex: 1,
  },
  listScrollContent: {
    paddingBottom: 32,
  },

  // Appointment Grid & Cards
  appointmentGrid: {
    flexDirection: 'column',
    gap: 14,
  },
  appointmentGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  appointmentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  appointmentCardDesktop: {
    width: '48.8%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardPetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  petAvatarBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  petAvatarIcon: {
    fontSize: 20,
  },
  petName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  roomInfo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cardDivider: {
    height: 1,
    backgroundColor: COLORS.borderLight,
    marginVertical: 12,
  },
  cardBody: {
    gap: 6,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoIcon: {
    fontSize: 14,
  },
  dateTimeText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  serviceText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    flex: 1,
  },
  priceText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  adminInfoText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: '#FEE2E2',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '600',
  },

  // Loading & Empty States
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
    fontSize: 14,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: 12,
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
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
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
    maxWidth: 520,
    maxHeight: '85%',
    padding: 20,
    ...SHADOWS.lg,
  },
  modalContentDesktop: {
    maxWidth: 560,
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
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  modalBody: {
    paddingVertical: 6,
  },
  detailSection: {
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 14,
    color: COLORS.text,
  },
  actionSection: {
    marginTop: 16,
    gap: 10,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: COLORS.primary,
  },
  completeButton: {
    backgroundColor: COLORS.success,
  },
  cancelActionButton: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  reviewBox: {
    marginTop: 18,
    padding: 14,
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 14,
  },
  reviewBoxTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  starIcon: {
    fontSize: 26,
  },
  reviewInput: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 70,
    fontSize: 13,
    color: COLORS.text,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
});
