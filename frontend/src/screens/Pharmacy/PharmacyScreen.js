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
import { getMyPetsApi } from '../../api/petApi';
import { getPetPrescriptionsApi, getPrescriptionDetailApi } from '../../api/prescriptionApi';
import { createMedicineOrderApi } from '../../api/medicineOrderApi';

const ORDER_STATUS_LABELS = {
  pending: { label: 'Chờ thanh toán tại quầy', bg: '#FEF3C7', textColor: '#B45309' },
  paid: { label: 'Đã thanh toán & nhận thuốc', bg: '#D1FAE5', textColor: '#047857' },
  cancelled: { label: 'Đã hủy', bg: '#FEE2E2', textColor: '#B91C1C' },
};

export default function PharmacyScreen() {
  const { isTabletOrDesktop } = useResponsive();
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
      Alert.alert('Thành công', 'Đã giữ chỗ đơn thuốc thành công! Vui lòng đến quầy thuốc bệnh viện để thanh toán và nhận thuốc.');
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
        <Text style={styles.title}>Đơn Thuốc Của Bé 💊</Text>
        <Text style={styles.subtitle}>Xem đơn thuốc do bác sĩ kê và đặt giữ chỗ mua thuốc tại quầy viện.</Text>
      </View>

      {/* Pet selector chips */}
      {pets.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.petRow}
          contentContainerStyle={styles.petRowContent}
        >
          {pets.map((pet) => {
            const isSelected = selectedPetId === pet.id;
            return (
              <TouchableOpacity
                key={pet.id}
                style={[styles.petChip, isSelected && styles.petChipSelected]}
                onPress={() => setSelectedPetId(pet.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.petIcon}>{pet.species === 'dog' ? '🐶' : '🐱'}</Text>
                <Text style={[styles.petChipText, isSelected && styles.petChipTextSelected]}>
                  {pet.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
      >
        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải danh sách đơn thuốc...</Text>
          </View>
        ) : prescriptions.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>💊</Text>
            <Text style={styles.emptyTitle}>Chưa có đơn thuốc nào</Text>
            <Text style={styles.emptySubtitle}>Bé cưng của bạn hiện chưa có đơn thuốc nào được kê từ bác sĩ.</Text>
          </View>
        ) : (
          <View style={[styles.prescriptionGrid, isTabletOrDesktop && styles.prescriptionGridDesktop]}>
            {prescriptions.map((prescription) => {
              const detail = detailCache[prescription.id];
              const expanded = expandedId === prescription.id;
              const canBuy = !prescription.latest_order_status || prescription.latest_order_status === 'cancelled';
              const orderStatusMeta = prescription.latest_order_status
                ? ORDER_STATUS_LABELS[prescription.latest_order_status]
                : null;

              return (
                <View
                  key={prescription.id}
                  style={[styles.card, isTabletOrDesktop && styles.cardDesktop]}
                >
                  <TouchableOpacity
                    onPress={() => toggleExpand(prescription)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={styles.recordTitle}>{prescription.health_record_title}</Text>
                        <Text style={styles.doctor}>👨‍⚕️ Bác sĩ: {prescription.doctor_name}</Text>
                      </View>
                      <View style={styles.dateBadge}>
                        <Text style={styles.dateText}>
                          {new Date(prescription.created_at).toLocaleDateString('vi-VN')}
                        </Text>
                      </View>
                    </View>

                    {orderStatusMeta && (
                      <View style={[styles.orderStatusBadge, { backgroundColor: orderStatusMeta.bg }]}>
                        <Text style={[styles.orderStatusText, { color: orderStatusMeta.textColor }]}>
                          Trạng thái: {orderStatusMeta.label}
                        </Text>
                      </View>
                    )}

                    <View style={styles.expandRow}>
                      <Text style={styles.expandText}>
                        {expanded ? 'Thu gọn đơn thuốc ▲' : 'Xem danh mục thuốc chi tiết ▼'}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.detailBox}>
                      {!detail ? (
                        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 12 }} />
                      ) : (
                        <>
                          <Text style={styles.itemsHeader}>Danh sách thuốc được kê:</Text>
                          {detail.items.map((item) => (
                            <View key={item.id} style={styles.itemRow}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.itemName}>
                                  💊 {item.medicine_name} x {item.quantity} {item.unit}
                                </Text>
                                <Text style={styles.itemDosage}>Liều dùng: {item.dosage}</Text>
                              </View>
                              <Text style={styles.itemPrice}>
                                {(Number(item.unit_price) * item.quantity).toLocaleString('vi-VN')} đ
                              </Text>
                            </View>
                          ))}

                          <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Tổng tiền thuốc:</Text>
                            <Text style={styles.totalValue}>
                              {detail.items.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0).toLocaleString('vi-VN')} đ
                            </Text>
                          </View>

                          {canBuy ? (
                            <TouchableOpacity
                              style={styles.buyButton}
                              onPress={() => buyMedicine(prescription.id)}
                              disabled={orderingId === prescription.id}
                              activeOpacity={0.8}
                            >
                              {orderingId === prescription.id ? (
                                <ActivityIndicator color="#fff" />
                              ) : (
                                <Text style={styles.buyButtonText}>
                                  🛒 Giữ chỗ mua thuốc (thanh toán tại quầy)
                                </Text>
                              )}
                            </TouchableOpacity>
                          ) : (
                            <View style={styles.alreadyOrderedBox}>
                              <Text style={styles.alreadyOrdered}>✓ Đã đặt giữ chỗ thành công — Vui lòng thanh toán và nhận thuốc tại quầy</Text>
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
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
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  petRow: {
    marginBottom: 16,
  },
  petRowContent: {
    gap: 8,
  },
  petChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
  },
  petChipSelected: {
    backgroundColor: COLORS.primaryLight,
    borderColor: COLORS.primary,
  },
  petIcon: {
    fontSize: 16,
  },
  petChipText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  petChipTextSelected: {
    color: COLORS.primaryDark,
    fontWeight: '700',
  },
  centerBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 32,
    marginTop: 12,
  },
  emptyIcon: {
    fontSize: 44,
    marginBottom: 10,
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
    maxWidth: 320,
    lineHeight: 18,
  },
  prescriptionGrid: {
    flexDirection: 'column',
    gap: 14,
  },
  prescriptionGridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
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
    alignItems: 'flex-start',
  },
  recordTitle: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  dateBadge: {
    backgroundColor: COLORS.surfaceSubtle,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  dateText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  doctor: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  orderStatusBadge: {
    marginTop: 10,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  orderStatusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  expandRow: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  expandText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  detailBox: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },
  itemsHeader: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  itemName: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 13,
  },
  itemDosage: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  itemPrice: {
    color: COLORS.primaryDark,
    fontWeight: 'bold',
    fontSize: 13,
    marginLeft: 10,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.primaryDark,
  },
  buyButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  buyButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 13,
  },
  alreadyOrderedBox: {
    backgroundColor: '#D1FAE5',
    padding: 12,
    borderRadius: 10,
  },
  alreadyOrdered: {
    color: '#047857',
    fontWeight: '600',
    fontSize: 12,
    textAlign: 'center',
  },
});
