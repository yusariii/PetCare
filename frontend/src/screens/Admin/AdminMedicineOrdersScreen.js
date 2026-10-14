import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { listMedicineOrdersApi, updateMedicineOrderStatusApi } from '../../api/medicineOrderApi';

export default function AdminMedicineOrdersScreen() {
  const { isTabletOrDesktop } = useResponsive();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await listMedicineOrdersApi('pending');
      setOrders(response.data.success ? response.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải danh sách đơn mua thuốc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrders(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  const process = async (orderId, status) => {
    try {
      setProcessingId(orderId);
      await updateMedicineOrderStatusApi(orderId, status);
      await loadOrders();
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể xử lý đơn mua thuốc');
    } finally {
      setProcessingId(null);
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
          <Text style={styles.eyebrow}>QUẦY DƯỢC PHẨM</Text>
          <Text style={styles.title}>Đơn Thuốc Chờ Thanh Toán 🧾</Text>
          <Text style={styles.subtitle}>
            Xác nhận xuất thuốc và thanh toán tại quầy khi khách hàng đến nhận đơn.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>✨</Text>
            <Text style={styles.empty}>Hiện không có đơn nào đang chờ thanh toán.</Text>
            <Text style={styles.emptySub}>Các đơn mua thuốc mới từ khách hàng sẽ xuất hiện tại đây.</Text>
          </View>
        ) : (
          <View style={[styles.orderGrid, isTabletOrDesktop && styles.orderGridDesktop]}>
            {orders.map((order) => {
              const isProcessing = processingId === order.id;

              return (
                <View key={order.id} style={[styles.card, isTabletOrDesktop && styles.cardDesktop]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>⏳ Chờ thanh toán</Text>
                    </View>
                    <Text style={styles.orderId}>#ĐH-{order.id}</Text>
                  </View>

                  <View style={styles.customerBox}>
                    <Text style={styles.customerName}>👤 {order.customer_name}</Text>
                    <Text style={styles.customerPhone}>📞 {order.customer_phone || 'Chưa có SĐT'}</Text>
                    <Text style={styles.petName}>🐾 Thú cưng: {order.pet_name || 'Chưa cập nhật'}</Text>
                  </View>

                  <View style={styles.amountBox}>
                    <Text style={styles.amountLabel}>Tổng tiền cần thu:</Text>
                    <Text style={styles.totalAmount}>
                      {Number(order.total_amount).toLocaleString('vi-VN')} đ
                    </Text>
                  </View>

                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.payButton]}
                      onPress={() => process(order.id, 'paid')}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <Text style={styles.actionText}>✓ Xác nhận thanh toán</Text>
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionButton, styles.cancelButton]}
                      onPress={() => process(order.id, 'cancelled')}
                      disabled={isProcessing}
                    >
                      <Text style={styles.cancelText}>Hủy giữ chỗ</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ResponsiveContainer>
  );
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
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptySub: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  orderGrid: {
    paddingHorizontal: 16,
    gap: 14,
  },
  orderGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  cardDesktop: {
    width: '48.8%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  statusBadgeText: {
    color: '#D97706',
    fontWeight: '700',
    fontSize: 12,
  },
  orderId: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  customerBox: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    marginBottom: 14,
  },
  customerName: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 15,
  },
  customerPhone: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  petName: {
    color: COLORS.primaryDark,
    fontWeight: '600',
    fontSize: 13,
  },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 14,
  },
  amountLabel: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  totalAmount: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  payButton: {
    flex: 2,
    backgroundColor: COLORS.success,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
  },
  actionText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  cancelText: {
    color: COLORS.danger,
    fontWeight: '700',
    fontSize: 13,
  },
});
