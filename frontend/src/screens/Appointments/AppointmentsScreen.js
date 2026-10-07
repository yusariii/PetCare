import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl, Modal, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { getMyAppointmentsApi, cancelAppointmentApi, getAllAppointmentsApi, updateAppointmentStatusApi } from '../../api/appointmentApi';
import { createReviewApi } from '../../api/reviewApi';

export default function AppointmentsScreen() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userRole, setUserRole] = useState('customer');
  const [error, setError] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    loadUserRole();
    loadAppointments();
  }, []);

  const loadUserRole = async () => {
    try {
      const user = await AsyncStorage.getItem('user');
      if (user) {
        const parsed = JSON.parse(user);
        setUserRole(parsed.role || 'customer');
      }
    } catch (err) {
      console.error('Error loading user role:', err);
    }
  };

  const loadAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      
      let response;
      if (userRole === 'customer') {
        response = await getMyAppointmentsApi();
      } else {
        response = await getAllAppointmentsApi();
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
          style: 'destructive'
        }
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

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'pending':
        return COLORS.warning;
      case 'confirmed':
        return COLORS.secondary;
      case 'completed':
        return COLORS.success;
      case 'cancelled':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: 'Chờ duyệt',
      confirmed: 'Đã xác nhận',
      completed: 'Hoàn thành',
      cancelled: 'Đã hủy'
    };
    return labels[status] || status;
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

  return (
    <ResponsiveContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📅 Lịch Hẹn</Text>
        <Text style={styles.subtitle}>
          {userRole === 'doctor' ? 'Quản lý ca khám' : 'Các lịch hẹn của bạn'}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải lịch hẹn...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>❌ {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAppointments}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : appointments.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>Chưa có lịch hẹn nào</Text>
        </View>
      ) : (
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.appointmentList}>
            {appointments.map((apt) => (
              <TouchableOpacity
                key={apt.id}
                style={styles.appointmentCard}
                onPress={() => {
                  setSelectedAppointment(apt);
                  setShowDetail(true);
                }}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleSection}>
                    <Text style={styles.petName}>🐾 {apt.pet_name}</Text>
                    <Text style={styles.roomInfo}>{apt.room_code} - {apt.room_name}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusBadgeColor(apt.status) }]}>
                    <Text style={styles.statusText}>{getStatusLabel(apt.status)}</Text>
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.serviceInfo}>💊 {apt.service_name}</Text>
                  <Text style={styles.dateTimeInfo}>
                    📅 {new Date(apt.appointment_datetime).toLocaleDateString('vi-VN')} • ⏰ {new Date(apt.appointment_datetime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                  {apt.price && (
                    <Text style={styles.priceInfo}>💰 {apt.price.toLocaleString('vi-VN')}đ</Text>
                  )}
                </View>

                {userRole === 'customer' && apt.status === 'pending' && (
                  <TouchableOpacity 
                    style={styles.cancelButton}
                    onPress={() => {
                      handleCancelAppointment(apt.id);
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Hủy lịch</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Detail Modal */}
      <Modal
        visible={showDetail && selectedAppointment}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowDetail(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Chi tiết lịch hẹn</Text>
              <View style={{ width: 30 }} />
            </View>

            {selectedAppointment && (
              <ScrollView showsVerticalScrollIndicator={false} style={styles.modalBody}>
                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>🐾 Thú cưng:</Text>
                  <Text style={styles.sectionValue}>
                    {selectedAppointment.pet_name} ({selectedAppointment.species})
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>🏥 Phòng khám:</Text>
                  <Text style={styles.sectionValue}>
                    {selectedAppointment.room_code} - {selectedAppointment.room_name}
                  </Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>💊 Dịch vụ:</Text>
                  <Text style={styles.sectionValue}>{selectedAppointment.service_name}</Text>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.sectionLabel}>📅 Thời gian:</Text>
                  <Text style={styles.sectionValue}>
                    {new Date(selectedAppointment.appointment_datetime).toLocaleDateString('vi-VN')} at {new Date(selectedAppointment.appointment_datetime).toLocaleTimeString('vi-VN')}
                  </Text>
                </View>

                {selectedAppointment.price && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionLabel}>💰 Giá:</Text>
                    <Text style={styles.sectionValue}>
                      {selectedAppointment.price.toLocaleString('vi-VN')}đ
                    </Text>
                  </View>
                )}

                {selectedAppointment.doctor_info && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionLabel}>👨‍⚕️ Bác sĩ:</Text>
                    <Text style={styles.sectionValue}>{selectedAppointment.doctor_info}</Text>
                  </View>
                )}

                {selectedAppointment.notes && (
                  <View style={styles.detailSection}>
                    <Text style={styles.sectionLabel}>📝 Ghi chú:</Text>
                    <Text style={styles.sectionValue}>{selectedAppointment.notes}</Text>
                  </View>
                )}

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
                          <Text style={styles.actionButtonText}>✅ Xác Nhận</Text>
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
                          <Text style={styles.actionButtonText}>🎉 Hoàn Thành</Text>
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
                          <Text style={styles.actionButtonText}>❌ Hủy</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {userRole === 'customer' && selectedAppointment.status === 'completed' && (
                  <View style={styles.actionSection}>
                    <Text style={styles.sectionLabel}>⭐ Đánh giá lịch khám này:</Text>
                    <View style={styles.starRow}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                          <Text style={styles.starIcon}>{star <= reviewRating ? '⭐' : '☆'}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                    <TextInput
                      style={styles.reviewInput}
                      placeholder="Nhận xét của bạn (không bắt buộc)"
                      value={reviewComment}
                      onChangeText={setReviewComment}
                      multiline
                    />
                    <TouchableOpacity
                      style={[styles.actionButton, styles.confirmButton]}
                      onPress={submitReview}
                      disabled={submittingReview}
                    >
                      {submittingReview ? <ActivityIndicator color="#fff" /> : <Text style={styles.actionButtonText}>Gửi đánh giá</Text>}
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
  appointmentList: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    gap: 12,
  },
  appointmentCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTitleSection: {
    flex: 1,
    marginRight: 8,
  },
  petName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  roomInfo: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 2,
  },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#fff',
  },
  cardBody: {
    gap: 4,
    marginBottom: 10,
  },
  serviceInfo: {
    fontSize: 12,
    color: COLORS.text,
  },
  dateTimeInfo: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  priceInfo: {
    fontSize: 12,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: COLORS.danger,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
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
    marginTop: 32,
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
    paddingBottom: 16,
  },
  detailSection: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 4,
  },
  sectionValue: {
    fontSize: 13,
    color: COLORS.text,
  },
  actionSection: {
    marginTop: 16,
    gap: 10,
  },
  actionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButton: {
    backgroundColor: COLORS.success,
  },
  completeButton: {
    backgroundColor: COLORS.secondary,
  },
  cancelActionButton: {
    backgroundColor: COLORS.danger,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  starRow: {
    flexDirection: 'row',
    gap: 6,
    marginVertical: 8,
  },
  starIcon: {
    fontSize: 28,
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
    color: COLORS.text,
    marginBottom: 12,
  },
});
