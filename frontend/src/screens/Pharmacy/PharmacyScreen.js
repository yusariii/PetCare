import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { getMyPetsApi } from '../../api/petApi';
import { getPetPrescriptionsApi, getPrescriptionDetailApi } from '../../api/prescriptionApi';
import { createMedicineOrderApi } from '../../api/medicineOrderApi';

const ORDER_STATUS_LABELS = {
  pending: 'Chờ thanh toán tại quầy',
  paid: 'Đã thanh toán',
  cancelled: 'Đã hủy',
};

export default function PharmacyScreen() {
  const [pets, setPets] = useState([]);
  const [selectedPetId, setSelectedPetId] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [detailCache, setDetailCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orderingId, setOrderingId] = useState(null);

  const loadPets = async () => {
    try {
      const response = await getMyPetsApi();
      const list = response.data.success ? response.data.data || [] : [];
      setPets(list);
      if (list.length > 0) setSelectedPetId((current) => current || list[0].id);
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải danh sách thú cưng');
    }
  };

  const loadPrescriptions = async (petId) => {
    if (!petId) return;
    try {
      setLoading(true);
      const response = await getPetPrescriptionsApi(petId);
      setPrescriptions(response.data.success ? response.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải đơn thuốc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPets(); }, []);
  useEffect(() => { if (selectedPetId) loadPrescriptions(selectedPetId); }, [selectedPetId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPrescriptions(selectedPetId);
    setRefreshing(false);
  };

  const toggleExpand = async (prescription) => {
    if (expandedId === prescription.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(prescription.id);
    if (!detailCache[prescription.id]) {
      try {
        const response = await getPrescriptionDetailApi(prescription.id);
        setDetailCache((cache) => ({ ...cache, [prescription.id]: response.data.data }));
      } catch (error) {
        Alert.alert('Lỗi', 'Không thể tải chi tiết đơn thuốc');
      }
    }
  };

  const buyMedicine = async (prescriptionId) => {
    try {
      setOrderingId(prescriptionId);
      await createMedicineOrderApi(prescriptionId);
      Alert.alert('Thành công', 'Đã giữ chỗ đơn thuốc. Vui lòng đến quầy thuốc để thanh toán và nhận thuốc.');
      await loadPrescriptions(selectedPetId);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể đặt mua thuốc');
    } finally {
      setOrderingId(null);
    }
  };

  return (
    <ResponsiveContainer style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>ĐƠN THUỐC</Text>
        <Text style={styles.title}>Đơn thuốc & Mua thuốc</Text>
        <Text style={styles.subtitle}>Xem đơn thuốc bác sĩ đã kê và giữ chỗ mua tại quầy.</Text>
      </View>

      {pets.length > 1 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.petRow} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
          {pets.map((pet) => (
            <TouchableOpacity
              key={pet.id}
              style={[styles.petChip, selectedPetId === pet.id && styles.petChipSelected]}
              onPress={() => setSelectedPetId(pet.id)}
            >
              <Text style={selectedPetId === pet.id ? styles.petChipTextSelected : styles.petChipText}>{pet.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} /> : prescriptions.length === 0 ? (
          <Text style={styles.empty}>Thú cưng của bạn chưa có đơn thuốc nào.</Text>
        ) : prescriptions.map((prescription) => {
          const detail = detailCache[prescription.id];
          const expanded = expandedId === prescription.id;
          const canBuy = !prescription.latest_order_status || prescription.latest_order_status === 'cancelled';
          return (
            <View key={prescription.id} style={styles.card}>
              <TouchableOpacity onPress={() => toggleExpand(prescription)}>
                <View style={styles.cardHeader}>
                  <Text style={styles.recordTitle}>{prescription.health_record_title}</Text>
                  <Text style={styles.date}>{new Date(prescription.created_at).toLocaleDateString('vi-VN')}</Text>
                </View>
                <Text style={styles.doctor}>Bác sĩ: {prescription.doctor_name}</Text>
                {prescription.latest_order_status && (
                  <Text style={styles.orderStatus}>Trạng thái mua: {ORDER_STATUS_LABELS[prescription.latest_order_status]}</Text>
                )}
              </TouchableOpacity>

              {expanded && (
                <View style={styles.detailBox}>
                  {!detail ? <ActivityIndicator color={COLORS.primary} /> : (
                    <>
                      {detail.items.map((item) => (
                        <View key={item.id} style={styles.itemRow}>
                          <Text style={styles.itemName}>{item.medicine_name} x{item.quantity} {item.unit}</Text>
                          <Text style={styles.itemDosage}>Liều dùng: {item.dosage}</Text>
                        </View>
                      ))}
                      <Text style={styles.total}>
                        Tổng tiền: {detail.items.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0).toLocaleString('vi-VN')}đ
                      </Text>
                      {canBuy ? (
                        <TouchableOpacity
                          style={styles.buyButton}
                          onPress={() => buyMedicine(prescription.id)}
                          disabled={orderingId === prescription.id}
                        >
                          {orderingId === prescription.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.buyButtonText}>Giữ chỗ mua thuốc (thanh toán tại quầy)</Text>}
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.alreadyOrdered}>✓ Đã đặt giữ chỗ - thanh toán tại quầy thuốc</Text>
                      )}
                    </>
                  )}
                </View>
              )}
            </View>
          );
        })}
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
  petRow: { marginBottom: 10 },
  petChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16 },
  petChipSelected: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  petChipText: { color: COLORS.textSecondary, fontWeight: '600' },
  petChipTextSelected: { color: '#fff', fontWeight: '700' },
  loader: { marginTop: 30 },
  empty: { color: COLORS.textSecondary, textAlign: 'center', padding: 30 },
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  recordTitle: { color: COLORS.text, fontWeight: '800', fontSize: 16, flexShrink: 1 },
  date: { color: COLORS.textSecondary, fontSize: 12 },
  doctor: { color: COLORS.textSecondary, marginTop: 6 },
  orderStatus: { color: COLORS.primaryDark, marginTop: 6, fontWeight: '700' },
  detailBox: { marginTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 },
  itemRow: { marginBottom: 8 },
  itemName: { color: COLORS.text, fontWeight: '700' },
  itemDosage: { color: COLORS.textSecondary, fontSize: 13 },
  total: { color: COLORS.text, fontWeight: '800', marginTop: 8, marginBottom: 12 },
  buyButton: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 13, alignItems: 'center' },
  buyButtonText: { color: '#fff', fontWeight: '800' },
  alreadyOrdered: { color: COLORS.success, fontWeight: '700' },
});
