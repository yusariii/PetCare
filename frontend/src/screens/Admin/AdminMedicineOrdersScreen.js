import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { listMedicineOrdersApi, updateMedicineOrderStatusApi } from '../../api/medicineOrderApi';

export default function AdminMedicineOrdersScreen() {
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
      <View style={styles.header}>
        <Text style={styles.eyebrow}>QUẦY THUỐC</Text>
        <Text style={styles.title}>Đơn chờ thanh toán</Text>
        <Text style={styles.subtitle}>Xác nhận thanh toán hoặc hủy giữ chỗ khi khách đến quầy.</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} /> : orders.length === 0 ? (
          <Text style={styles.empty}>Không có đơn nào đang chờ thanh toán.</Text>
        ) : orders.map((order) => (
          <View key={order.id} style={styles.card}>
            <Text style={styles.customer}>{order.customer_name} · {order.customer_phone || 'Chưa có SĐT'}</Text>
            <Text style={styles.detail}>Thú cưng: {order.pet_name}</Text>
            <Text style={styles.total}>Tổng tiền: {Number(order.total_amount).toLocaleString('vi-VN')}đ</Text>
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.success }]}
                onPress={() => process(order.id, 'paid')}
                disabled={processingId === order.id}
              >
                <Text style={styles.actionText}>Xác nhận đã thanh toán</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.danger }]}
                onPress={() => process(order.id, 'cancelled')}
                disabled={processingId === order.id}
              >
                <Text style={styles.actionText}>Hủy giữ chỗ</Text>
              </TouchableOpacity>
            </View>
            {processingId === order.id && <ActivityIndicator color={COLORS.primary} />}
          </View>
        ))}
      </ScrollView>
    </ResponsiveContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '800', marginTop: 5 },
  subtitle: { color: COLORS.textSecondary, marginTop: 6 },
  loader: { marginTop: 30 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 30 },
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  customer: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  detail: { color: COLORS.textSecondary, marginTop: 5 },
  total: { color: COLORS.primaryDark, fontWeight: '800', marginTop: 8, fontSize: 16 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionButton: { flex: 1, padding: 12, borderRadius: 9, alignItems: 'center' },
  actionText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
