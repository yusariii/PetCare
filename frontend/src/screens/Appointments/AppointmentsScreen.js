import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import DateTimeFilterBar, { getTodayStr, matchesDateTimeFilter } from '../../components/DateTimeFilterBar';
import { useResponsive } from '../../utils/responsive';
import {
  getMyAppointmentsApi,
  getAllAppointmentsApi,
  updateAppointmentStatusApi,
  cancelAppointmentApi,
  deleteCancelledAppointmentApi,
  deleteAllCancelledAppointmentsApi,
} from '../../api/appointmentApi';
import { getRoomsApi } from '../../api/roomApi';
import { createReviewApi } from '../../api/reviewApi';
import { getPetHealthRecordsApi } from '../../api/healthRecordApi';

const STATUS_FILTERS = [
  ['all', 'Tất cả'],
  ['pending', 'Chờ duyệt'],
  ['confirmed', 'Đã xác nhận'],
  ['completed', 'Hoàn thành'],
  ['cancelled', 'Đã hủy'],
];

export default function AppointmentsScreen({ navigation, route }) {
  const { isTabletOrDesktop } = useResponsive();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState('customer');
  const [isAdmin, setIsAdmin] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState(null);
  const [dateFilter, setDateFilter] = useState(getTodayStr());
  const [timeFilter, setTimeFilter] = useState('');
  const [rooms, setRooms] = useState([]);

  // Detail Modal & Review & Health Records
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [petHealthRecords, setPetHealthRecords] = useState([]);
  const [loadingHealthRecords, setLoadingHealthRecords] = useState(false);

  useEffect(() => {
    if (showDetail && selectedAppointment?.pet_id) {
      setLoadingHealthRecords(true);
      getPetHealthRecordsApi(selectedAppointment.pet_id)
        .then((res) => {
          setPetHealthRecords(res.data?.success ? res.data.data || [] : []);
        })
        .catch(() => setPetHealthRecords([]))
        .finally(() => setLoadingHealthRecords(false));
    } else {
      setPetHealthRecords([]);
    }
  }, [showDetail, selectedAppointment?.pet_id]);

  // Tự động tải lại danh sách lịch hẹn mỗi khi người dùng chuyển sang tab Lịch hẹn hoặc navigate tới
  useFocusEffect(
    useCallback(() => {
      if (route?.params?.refresh) {
        setStatusFilter('all');
      }
      checkUserRoleAndLoad(appointments.length === 0);
    }, [statusFilter, roomFilter, dateFilter, route?.params?.refresh])
  );

  const checkUserRoleAndLoad = async (showLoading = true) => {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setUserRole(user.role || 'customer');
        setIsAdmin(user.role === 'admin');

        if (user.role === 'admin') {
          const roomsRes = await getRoomsApi();
          if (roomsRes.data.success) {
            setRooms(roomsRes.data.data || []);
          }
        }
      }
      await loadAppointments(showLoading);
    } catch (err) {
      console.error('INIT_APPOINTMENTS_ERROR:', err);
    }
  };

  const loadAppointments = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');

      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;
      const adminRole = user?.role === 'admin';
      const doctorRole = user?.role === 'doctor';

      let response;
      if (adminRole) {
        const params = {};
        if (statusFilter !== 'all') params.status = statusFilter;
        if (roomFilter) params.room_id = roomFilter;
        if (dateFilter) params.date = dateFilter;
        response = await getAllAppointmentsApi(params);
      } else if (doctorRole) {
        response = await getAllAppointmentsApi({ status: statusFilter !== 'all' ? statusFilter : undefined });
      } else {
        response = await getMyAppointmentsApi();
      }

      if (response.data.success) {
        setAppointments(response.data.data || []);
      } else {
        setError('Không thể tải danh sách lịch hẹn');
      }
    } catch (err) {
      console.error('LOAD_APPOINTMENTS_ERROR:', err);
      setError(err.response?.data?.message || 'Lỗi khi tải lịch hẹn');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAppointments(false);
    setRefreshing(false);
  };

  const handleCancelAppointment = (aptOrId) => {
    const targetApt =
      typeof aptOrId === 'object' && aptOrId !== null
        ? aptOrId
        : appointments.find((a) => Number(a.id) === Number(aptOrId));
    const appointmentId = targetApt ? targetApt.id : aptOrId;
    const depositAmt = Number(targetApt?.deposit_amount || targetApt?.invoice_deposit_amount || 0);

    const alertTitle =
      depositAmt > 0 ? 'Cảnh báo Mất Cọc 50% khi Tự Hủy' : 'Hủy lịch hẹn';
    const alertMessage =
      depositAmt > 0
        ? `Lịch hẹn này đã đặt cọc 50% (${depositAmt.toLocaleString('vi-VN')} đ).\n\n• Nếu bạn tự bấm hủy trực tiếp trên ứng dụng, bạn sẽ bị MẤT 100% TIỀN ĐẶT CỌC (không được hoàn tiền).\n• Nếu muốn hủy lịch và được hỗ trợ HOÀN CỌC, vui lòng KHÔNG bấm hủy tại đây mà liên hệ trực tiếp SĐT Bệnh viện: 1900 6868 (hoặc 024 3999 8888) để Bác sĩ/Viện hỗ trợ hủy lịch và hoàn cọc cho bạn.`
        : 'Bạn có chắc chắn muốn hủy lịch hẹn này không?';

    Alert.alert(
      alertTitle,
      alertMessage,
      [
        {
          text: depositAmt > 0 ? 'Giữ lịch (Gọi Viện 1900 6868)' : 'Không',
          style: 'cancel',
        },
        {
          text: depositAmt > 0 ? 'Chấp nhận mất cọc & Hủy' : 'Hủy lịch',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingId(appointmentId);
              const response = await cancelAppointmentApi(appointmentId);
              if (response.data.success) {
                Alert.alert('Thành công', response.data.message || 'Đã hủy lịch hẹn');
                await loadAppointments();
                setShowDetail(false);
              }
            } catch (err) {
              Alert.alert('Lỗi', err.response?.data?.message || 'Không thể hủy lịch hẹn');
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteCancelledAppointment = (appointmentId) => {
    Alert.alert(
      'Xóa lịch đã hủy',
      'Bạn có chắc chắn muốn xóa lịch hẹn này khỏi danh sách không? Thao tác này không thể hoàn tác.',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Xóa vĩnh viễn',
          style: 'destructive',
          onPress: async () => {
            try {
              setUpdatingId(appointmentId);
              const response = await deleteCancelledAppointmentApi(appointmentId);
              if (response.data.success) {
                Alert.alert('Thành công', 'Đã xóa lịch hẹn khỏi danh sách');
                await loadAppointments(false);
                setShowDetail(false);
              }
            } catch (err) {
              Alert.alert('Lỗi', err.response?.data?.message || 'Không thể xóa lịch hẹn');
            } finally {
              setUpdatingId(null);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllCancelledAppointments = () => {
    const cancelledCount = appointments.filter((a) => a.status === 'cancelled').length;
    if (cancelledCount === 0) return;

    Alert.alert(
      'Xóa tất cả lịch đã hủy',
      `Bạn có chắc chắn muốn xóa toàn bộ ${cancelledCount} lịch hẹn đã hủy không? Thao tác này không thể hoàn tác.`,
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Xóa tất cả',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const response = await deleteAllCancelledAppointmentsApi();
              if (response.data.success) {
                Alert.alert('Thành công', `Đã xóa ${cancelledCount} lịch hẹn đã hủy thành công`);
                await loadAppointments(false);
              }
            } catch (err) {
              Alert.alert('Lỗi', err.response?.data?.message || 'Không thể xóa các lịch hẹn đã hủy');
            } finally {
              setLoading(false);
            }
          },
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

  const getStatusBadgeMeta = (status, notes = '') => {
    if (status === 'cancelled' && String(notes || '').includes('[VẮNG MẶT')) {
      return { bg: '#FEF3C7', textColor: '#B45309', label: 'Vắng mặt (Không đến)' };
    }
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
      const savedComment = reviewComment ? reviewComment.trim() : '';
      const savedRating = reviewRating;
      setSelectedAppointment((prev) =>
        prev
          ? {
              ...prev,
              review_rating: savedRating,
              review_comment: savedComment,
            }
          : null
      );
      await loadAppointments(false);
      Alert.alert('Cảm ơn bạn!', 'Đánh giá của bạn đã được ghi nhận.');
      setReviewComment('');
      setReviewRating(5);
    } catch (err) {
      Alert.alert('Lỗi', err.response?.data?.message || 'Không thể gửi đánh giá');
    } finally {
      setSubmittingReview(false);
    }
  };

  const filteredAppointments = appointments.filter((a) => {
    if (userRole === 'customer' && statusFilter !== 'all' && a.status !== statusFilter) {
      return false;
    }
    return matchesDateTimeFilter(a.appointment_datetime, dateFilter, timeFilter);
  });

  return (
    <ResponsiveContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Quản Lý Lịch Hẹn</Text>
        <Text style={styles.subtitle}>
          {isAdmin
            ? 'Toàn bộ lịch hẹn của viện (chế độ giám sát Admin)'
            : userRole === 'doctor'
            ? 'Quản lý danh sách ca khám phụ trách'
            : 'Theo dõi tiến độ và lịch sử khám bệnh của các bé'}
        </Text>
      </View>

      {/* Customer Status Filter Pills + Date/Time Filter */}
      {userRole === 'customer' && (
        <View style={styles.filterContainer}>
          <DateTimeFilterBar
            selectedDate={dateFilter}
            onDateChange={setDateFilter}
            selectedTime={timeFilter}
            onTimeChange={setTimeFilter}
            showTimeFilter={true}
            allowAllDates={true}
            dateLabel="Ngày khám:"
            timeLabel="Giờ khám:"
            statusOptions={STATUS_FILTERS}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
          />
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

          <DateTimeFilterBar
            selectedDate={dateFilter}
            onDateChange={setDateFilter}
            selectedTime={timeFilter}
            onTimeChange={setTimeFilter}
            showTimeFilter={true}
            allowAllDates={true}
            dateLabel="Ngày khám:"
            timeLabel="Giờ khám:"
            statusOptions={STATUS_FILTERS}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <Ionicons name="alert-circle" size={18} color={COLORS.danger} style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
          <TouchableOpacity style={styles.retryButton} onPress={loadAppointments}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : filteredAppointments.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="calendar-outline" size={48} color={COLORS.textTertiary || '#94A3B8'} style={{ marginBottom: 12 }} />
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
          {statusFilter === 'cancelled' && filteredAppointments.length > 0 && (
            <View style={styles.cleanupBar}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="trash-bin-outline" size={16} color="#B91C1C" />
                <Text style={styles.cleanupText}>
                  Có {filteredAppointments.length} lịch hẹn đã hủy
                </Text>
              </View>
              <TouchableOpacity
                style={styles.cleanupBtn}
                onPress={handleDeleteAllCancelledAppointments}
                activeOpacity={0.8}
              >
                <Text style={styles.cleanupBtnText}>Xóa tất cả</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={[styles.appointmentGrid, isTabletOrDesktop && styles.appointmentGridDesktop]}>
            {filteredAppointments.map((apt) => {
              const badge = getStatusBadgeMeta(apt.status, apt.notes);
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
                        <FontAwesome5 name="paw" size={17} color={COLORS.primary} />
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
                      <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.dateTimeText}>
                        {dateFormatted} lúc {timeFormatted}
                      </Text>
                    </View>
                    <View style={styles.infoRow}>
                      <MaterialCommunityIcons name="pill" size={14} color={COLORS.textSecondary} />
                      <Text style={styles.serviceText} numberOfLines={1}>{apt.service_name}</Text>
                    </View>
                    {apt.price && (
                      <View style={[styles.infoRow, { flexWrap: 'wrap' }]}>
                        <Ionicons name="cash-outline" size={14} color={COLORS.primaryDark} />
                        <Text style={styles.priceText}>{Number(apt.price).toLocaleString('vi-VN')} đ</Text>
                        {Number(apt.deposit_amount || apt.invoice_deposit_amount || 0) > 0 && (
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '700',
                              color:
                                apt.deposit_status === 'forfeited'
                                  ? '#DC2626'
                                  : apt.deposit_status === 'refunded'
                                  ? '#0369A1'
                                  : '#B45309',
                              marginLeft: 6,
                            }}
                          >
                            {apt.deposit_status === 'forfeited'
                              ? `• Mất cọc 50%: ${Number(apt.deposit_amount || apt.invoice_deposit_amount || 0).toLocaleString('vi-VN')} đ`
                              : apt.deposit_status === 'refunded'
                              ? `• Hoàn cọc 50%: ${Number(apt.deposit_amount || apt.invoice_deposit_amount || 0).toLocaleString('vi-VN')} đ`
                              : `• Đã cọc 50%: ${Number(apt.deposit_amount || apt.invoice_deposit_amount || 0).toLocaleString('vi-VN')} đ`}
                          </Text>
                        )}
                      </View>
                    )}
                    {isAdmin && (
                      <>
                        <View style={styles.infoRow}>
                          <Ionicons name="person-outline" size={14} color={COLORS.textSecondary} />
                          <Text style={styles.adminInfoText} numberOfLines={1}>{apt.customer_info}</Text>
                        </View>
                        <View style={styles.infoRow}>
                          <FontAwesome5 name="user-md" size={13} color={COLORS.textSecondary} />
                          <Text style={styles.adminInfoText} numberOfLines={1}>
                            {apt.room_doctor_name || 'Chưa phân công bác sĩ'}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Customer cancel action */}
                  {userRole === 'customer' && apt.status === 'pending' && (
                    <View>
                      {Number(apt.deposit_amount || apt.invoice_deposit_amount || 0) > 0 && (
                        <View
                          style={{
                            marginTop: 8,
                            padding: 8,
                            borderRadius: 8,
                            backgroundColor: '#FFFBEB',
                            borderWidth: 1,
                            borderColor: '#FDE68A',
                          }}
                        >
                          <Text style={{ fontSize: 11, color: '#92400E', lineHeight: 16, fontWeight: '600' }}>
                            📞 Muốn hủy hoàn cọc? Vui lòng liên hệ trực tiếp SĐT Viện: 1900 6868 / 024 3999 8888 (Tự bấm hủy bên dưới sẽ mất 100% cọc).
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleCancelAppointment(apt);
                        }}
                        activeOpacity={0.8}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="close-circle-outline" size={14} color="#B91C1C" style={{ marginRight: 4 }} />
                          <Text style={styles.cancelButtonText}>
                            {Number(apt.deposit_amount || apt.invoice_deposit_amount || 0) > 0
                              ? 'Hủy lịch hẹn (Mất cọc 50%)'
                              : 'Hủy lịch hẹn'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Delete cancelled appointment action */}
                  {apt.status === 'cancelled' && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteCancelledAppointment(apt.id);
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Ionicons name="trash-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                        <Text style={styles.deleteButtonText}>Xóa khỏi danh sách</Text>
                      </View>
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
              <Text style={styles.modalTitle}>Chi tiết lịch hẹn</Text>
              <TouchableOpacity onPress={() => setShowDetail(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {selectedAppointment && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <FontAwesome5 name="paw" size={13} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                    <Text style={styles.sectionLabel}>Bé cưng:</Text>
                  </View>
                  <Text style={styles.sectionValue}>
                    {selectedAppointment.pet_name} {selectedAppointment.species ? `(${selectedAppointment.species})` : ''}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <FontAwesome5 name="hospital" size={13} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                    <Text style={styles.sectionLabel}>Chuyên khoa / Phòng:</Text>
                  </View>
                  <Text style={styles.sectionValue}>
                    {selectedAppointment.room_code} - {selectedAppointment.room_name}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <MaterialCommunityIcons name="pill" size={14} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                    <Text style={styles.sectionLabel}>Dịch vụ đăng ký:</Text>
                  </View>
                  <Text style={styles.sectionValue}>{selectedAppointment.service_name}</Text>
                </View>

                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                    <Ionicons name="calendar-outline" size={14} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                    <Text style={styles.sectionLabel}>Thời gian khám:</Text>
                  </View>
                  <Text style={styles.sectionValue}>
                    {new Date(selectedAppointment.appointment_datetime).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })} lúc {new Date(selectedAppointment.appointment_datetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>

                {selectedAppointment.price && (
                  <View style={styles.detailSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Ionicons name="cash-outline" size={14} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                      <Text style={styles.sectionLabel}>Chi phí dịch vụ:</Text>
                    </View>
                    <Text style={[styles.sectionValue, { fontWeight: 'bold', color: COLORS.primaryDark }]}>
                      {Number(selectedAppointment.price).toLocaleString('vi-VN')} đ
                    </Text>
                    {Number(selectedAppointment.deposit_amount || selectedAppointment.invoice_deposit_amount || 0) > 0 && (
                      <View
                        style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 10,
                          backgroundColor:
                            selectedAppointment.deposit_status === 'forfeited'
                              ? '#FEF2F2'
                              : selectedAppointment.deposit_status === 'refunded'
                              ? '#E0F2FE'
                              : '#FFFBEB',
                          borderWidth: 1,
                          borderColor:
                            selectedAppointment.deposit_status === 'forfeited'
                              ? '#FECACA'
                              : selectedAppointment.deposit_status === 'refunded'
                              ? '#BAE6FD'
                              : '#FDE68A',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 12.5,
                            fontWeight: '800',
                            color:
                              selectedAppointment.deposit_status === 'forfeited'
                                ? '#B91C1C'
                                : selectedAppointment.deposit_status === 'refunded'
                                ? '#0369A1'
                                : '#B45309',
                          }}
                        >
                          {selectedAppointment.deposit_status === 'forfeited'
                            ? `Mất cọc 50%: ${Number(selectedAppointment.deposit_amount || selectedAppointment.invoice_deposit_amount || 0).toLocaleString('vi-VN')} đ (Khách tự hủy / Vắng mặt)`
                            : selectedAppointment.deposit_status === 'refunded'
                            ? `Được hoàn cọc 50%: ${Number(selectedAppointment.deposit_amount || selectedAppointment.invoice_deposit_amount || 0).toLocaleString('vi-VN')} đ (Bác sĩ/Viện hủy lịch)`
                            : `Đã đặt cọc 50%: ${Number(selectedAppointment.deposit_amount || selectedAppointment.invoice_deposit_amount || 0).toLocaleString('vi-VN')} đ`}
                        </Text>
                        {userRole === 'customer' &&
                          (selectedAppointment.status === 'pending' || selectedAppointment.status === 'confirmed') &&
                          selectedAppointment.deposit_status === 'paid' && (
                            <Text style={{ fontSize: 11.5, color: '#78350F', marginTop: 4, lineHeight: 17 }}>
                              📞 Nếu có sự cố cần hủy lịch và hoàn cọc, vui lòng liên hệ trực tiếp SĐT Bệnh viện: 1900 6868 (hoặc 024 3999 8888) để được Bác sĩ/Viện hỗ trợ hủy và hoàn cọc. Tự bấm hủy trên ứng dụng sẽ mất 100% tiền cọc.
                            </Text>
                          )}
                      </View>
                    )}
                  </View>
                )}

                {isAdmin && (
                  <>
                    <View style={styles.detailSection}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <Ionicons name="person-outline" size={14} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                        <Text style={styles.sectionLabel}>Khách hàng:</Text>
                      </View>
                      <Text style={styles.sectionValue}>{selectedAppointment.customer_info}</Text>
                    </View>
                    <View style={styles.detailSection}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <FontAwesome5 name="user-md" size={13} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                        <Text style={styles.sectionLabel}>Bác sĩ phòng khám:</Text>
                      </View>
                      <Text style={styles.sectionValue}>{selectedAppointment.room_doctor_name || 'Chưa phân công'}</Text>
                    </View>
                    {selectedAppointment.review_rating ? (
                      <View style={styles.detailSection}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                          <Ionicons name="star" size={14} color="#F59E0B" style={{ marginRight: 6 }} />
                          <Text style={styles.sectionLabel}>Đánh giá của khách:</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          {[...Array(selectedAppointment.review_rating)].map((_, i) => (
                            <Ionicons key={i} name="star" size={14} color="#F59E0B" />
                          ))}
                          {selectedAppointment.review_comment ? (
                            <Text style={[styles.sectionValue, { marginLeft: 6 }]}>"{selectedAppointment.review_comment}"</Text>
                          ) : null}
                        </View>
                      </View>
                    ) : null}
                  </>
                )}

                {selectedAppointment.notes && (
                  <View style={styles.detailSection}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Ionicons name="create-outline" size={14} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                      <Text style={styles.sectionLabel}>Ghi chú ban đầu:</Text>
                    </View>
                    <Text style={styles.sectionValue}>{selectedAppointment.notes}</Text>
                  </View>
                )}

                {/* Hồ sơ kết quả khám & Bệnh án của bé */}
                <View style={styles.detailSection}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <FontAwesome5 name="notes-medical" size={14} color={COLORS.primaryDark} style={{ marginRight: 6 }} />
                      <Text style={styles.sectionLabel}>
                        Hồ sơ kết quả khám ({petHealthRecords.length}):
                      </Text>
                    </View>
                    {loadingHealthRecords && <ActivityIndicator size="small" color={COLORS.primary} />}
                  </View>

                  {petHealthRecords.length === 0 && !loadingHealthRecords ? (
                    <Text style={{ color: COLORS.textSecondary, fontSize: 13, fontStyle: 'italic' }}>
                      Chưa có hồ sơ kết quả khám nào được bác sĩ cập nhật cho bé.
                    </Text>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {petHealthRecords.map((rec) => (
                        <View
                          key={`apt-rec-${rec.id}`}
                          style={{
                            backgroundColor: COLORS.background,
                            borderRadius: 12,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: COLORS.border,
                            gap: 4,
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <Text style={{ fontWeight: '800', color: COLORS.text, fontSize: 13, flex: 1 }}>
                              {rec.title}
                            </Text>
                            {rec.doctor_room_code ? (
                              <View style={{ backgroundColor: '#E0F2FE', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ color: '#0369A1', fontSize: 11, fontWeight: '800' }}>
                                  {rec.doctor_room_code}
                                </Text>
                              </View>
                            ) : null}
                          </View>

                          <Text style={{ color: COLORS.textSecondary, fontSize: 12 }}>
                            {rec.performed_date ? new Date(rec.performed_date).toLocaleDateString('vi-VN') : ''} · BS.{' '}
                            {rec.doctor_name || rec.doctor_info || 'Phụ trách'}
                          </Text>

                          {rec.diagnosis ? (
                            <Text style={{ color: COLORS.text, fontSize: 13, lineHeight: 18, marginTop: 2 }}>
                              <Text style={{ fontWeight: '700', color: COLORS.textSecondary }}>Chẩn đoán / Kết quả: </Text>
                              {rec.diagnosis}
                            </Text>
                          ) : null}

                          {rec.treatment_plan ? (
                            <View
                              style={{
                                backgroundColor: '#F0FDFA',
                                padding: 8,
                                borderRadius: 8,
                                marginTop: 4,
                              }}
                            >
                              <Text style={{ color: '#0F766E', fontSize: 12, lineHeight: 17 }}>
                                <Text style={{ fontWeight: '800' }}>Hướng điều trị & Dặn dò: </Text>
                                {rec.treatment_plan}
                              </Text>
                            </View>
                          ) : null}

                          {rec.next_due_date ? (
                            <Text style={{ color: '#D97706', fontSize: 12, fontWeight: '700', marginTop: 2 }}>
                              Hẹn tái khám: {new Date(rec.next_due_date).toLocaleDateString('vi-VN')}
                            </Text>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

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
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="checkmark-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.actionButtonText}>Xác Nhận Tiếp Nhận</Text>
                          </View>
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
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="checkmark-done-circle-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                            <Text style={styles.actionButtonText}>Hoàn Thành Ca Khám</Text>
                          </View>
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
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="close-circle-outline" size={16} color="#B91C1C" style={{ marginRight: 6 }} />
                            <Text style={[styles.actionButtonText, { color: '#B91C1C' }]}>Hủy Ca Khám</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Xóa lịch đã hủy trong modal */}
                {selectedAppointment.status === 'cancelled' && (
                  <View style={styles.modalActionButtons}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteActionButton]}
                      onPress={() => handleDeleteCancelledAppointment(selectedAppointment.id)}
                      disabled={updatingId !== null}
                    >
                      {updatingId === selectedAppointment.id ? (
                        <ActivityIndicator color="#EF4444" />
                      ) : (
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                          <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Xóa Lịch Hẹn Đã Hủy Này</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}

                {/* Customer Review Section */}
                {userRole === 'customer' && selectedAppointment.status === 'completed' && (
                  <View style={styles.reviewBox}>
                    {selectedAppointment.review_rating ? (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Ionicons name="star" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                            <Text style={styles.reviewBoxTitle}>Kết quả đánh giá của bạn:</Text>
                          </View>
                          <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}>
                            <Text style={{ color: '#15803D', fontSize: 11, fontWeight: '800' }}>Đã đánh giá</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 }}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Ionicons
                              key={star}
                              name={star <= Number(selectedAppointment.review_rating) ? 'star' : 'star-outline'}
                              size={20}
                              color="#F59E0B"
                            />
                          ))}
                          <Text style={{ marginLeft: 6, fontWeight: '800', color: COLORS.text, fontSize: 13 }}>
                            {selectedAppointment.review_rating}/5 sao
                          </Text>
                        </View>
                        {selectedAppointment.review_comment ? (
                          <View
                            style={{
                              backgroundColor: COLORS.background,
                              padding: 10,
                              borderRadius: 10,
                              borderWidth: 1,
                              borderColor: COLORS.border,
                            }}
                          >
                            <Text style={{ color: COLORS.text, fontSize: 13, fontStyle: 'italic' }}>
                              "{selectedAppointment.review_comment}"
                            </Text>
                          </View>
                        ) : (
                          <Text style={{ color: COLORS.textSecondary, fontSize: 12, fontStyle: 'italic' }}>
                            Bạn không để lại nhận xét thêm.
                          </Text>
                        )}
                      </>
                    ) : (
                      <>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                          <Ionicons name="star" size={16} color="#F59E0B" style={{ marginRight: 6 }} />
                          <Text style={styles.reviewBoxTitle}>Đánh giá ca khám này:</Text>
                        </View>
                        <View style={styles.starRow}>
                          {[1, 2, 3, 4, 5].map((star) => (
                            <TouchableOpacity key={star} onPress={() => setReviewRating(star)} style={{ padding: 4 }}>
                              <Ionicons
                                name={star <= reviewRating ? 'star' : 'star-outline'}
                                size={26}
                                color="#F59E0B"
                              />
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
                      </>
                    )}
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
    justifyContent: 'center',
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
    justifyContent: 'center',
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
  },
  starRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
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
  deleteButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  deleteButtonText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
  },
  deleteActionButton: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cleanupBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  cleanupText: {
    color: '#991B1B',
    fontSize: 13,
    fontWeight: '700',
  },
  cleanupBtn: {
    backgroundColor: '#EF4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  cleanupBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
