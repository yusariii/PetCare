import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  listMedicinesApi,
  createMedicineApi,
  adjustMedicineStockApi,
  getMedicineMovementsApi,
} from '../../api/medicineApi';

const MOVEMENT_LABELS = {
  initial: 'Tồn ban đầu',
  import: 'Nhập kho',
  adjust: 'Điều chỉnh',
  reserve: 'Giữ chỗ đơn',
  release: 'Hoàn kho',
};

export default function AdminMedicinesScreen() {
  const { isTabletOrDesktop } = useResponsive();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', unit: 'viên', price: '', stock_quantity: '', description: '' });
  const [stockInputs, setStockInputs] = useState({});
  const [noteInputs, setNoteInputs] = useState({});
  const [historyFor, setHistoryFor] = useState(null);
  const [movements, setMovements] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const loadMedicines = async () => {
    try {
      setLoading(true);
      const response = await listMedicinesApi();
      setMedicines(response.data.success ? response.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải danh mục thuốc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMedicines(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMedicines();
    setRefreshing(false);
  };

  const submitCreate = async () => {
    if (!form.name || !form.price) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên thuốc và giá bán.');
      return;
    }
    try {
      setSaving(true);
      await createMedicineApi({
        ...form,
        price: Number(form.price),
        stock_quantity: Number(form.stock_quantity) || 0,
      });
      setCreateVisible(false);
      setForm({ name: '', unit: 'viên', price: '', stock_quantity: '', description: '' });
      await loadMedicines();
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể thêm thuốc');
    } finally {
      setSaving(false);
    }
  };

  const submitStockAdjust = async (medicineId) => {
    const delta = Number(stockInputs[medicineId]);
    if (!delta) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập số lượng cần nhập/điều chỉnh (có thể âm).');
      return;
    }
    try {
      await adjustMedicineStockApi(medicineId, delta, noteInputs[medicineId] || undefined);
      setStockInputs({ ...stockInputs, [medicineId]: '' });
      setNoteInputs({ ...noteInputs, [medicineId]: '' });
      await loadMedicines();
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể cập nhật tồn kho');
    }
  };

  const openHistory = async (medicine) => {
    setHistoryFor(medicine);
    setMovements([]);
    try {
      setHistoryLoading(true);
      const response = await getMedicineMovementsApi(medicine.id);
      setMovements(response.data.success ? response.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải lịch sử tồn kho');
    } finally {
      setHistoryLoading(false);
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
          <View style={styles.headerTitleWrap}>
            <Text style={styles.eyebrow}>QUẢN TRỊ DƯỢC PHẨM</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Text style={styles.title}>Kho Thuốc Bệnh Viện</Text>
              <MaterialCommunityIcons name="pill" size={24} color={COLORS.primary} />
            </View>
            <Text style={styles.subtitle}>
              Quản lý danh mục dược phẩm, cập nhật giá bán, theo dõi và điều chỉnh xuất nhập tồn kho.
            </Text>
          </View>
          <TouchableOpacity style={styles.addButton} onPress={() => setCreateVisible(true)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addButtonText}>Thêm thuốc mới</Text>
            </View>
          </TouchableOpacity>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : medicines.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={44} color={COLORS.textTertiary || '#94A3B8'} style={{ marginBottom: 12 }} />
            <Text style={styles.empty}>Kho thuốc hiện đang trống.</Text>
            <TouchableOpacity style={[styles.addButton, { marginTop: 12 }]} onPress={() => setCreateVisible(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="add" size={18} color="#fff" />
                <Text style={styles.addButtonText}>Thêm thuốc đầu tiên</Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={[styles.medicineGrid, isTabletOrDesktop && styles.medicineGridDesktop]}>
            {medicines.map((medicine) => {
              const isLowStock = medicine.stock_quantity <= 10;

              return (
                <View key={medicine.id} style={[styles.card, isTabletOrDesktop && styles.cardDesktop]}>
                  <View style={styles.cardHeader}>
                    <View style={styles.medicineIconWrap}>
                      <MaterialCommunityIcons name="pill" size={20} color={COLORS.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.name} numberOfLines={1}>{medicine.name}</Text>
                      <Text style={styles.priceText}>
                        {Number(medicine.price).toLocaleString('vi-VN')}đ <Text style={styles.unitText}>/ {medicine.unit}</Text>
                      </Text>
                    </View>
                    <View style={[styles.stockBadge, { backgroundColor: isLowStock ? '#FEF3C7' : '#DCFCE7' }]}>
                      <Text style={[styles.stockBadgeText, { color: isLowStock ? '#D97706' : '#16A34A' }]}>
                        {isLowStock ? 'Sắp hết: ' : 'Tồn: '}{medicine.stock_quantity} {medicine.unit}
                      </Text>
                    </View>
                  </View>

                  {medicine.description ? (
                    <Text style={styles.descriptionText} numberOfLines={2}>{medicine.description}</Text>
                  ) : null}

                  {/* Khu vực điều chỉnh tồn kho */}
                  <View style={styles.adjustSection}>
                    <Text style={styles.adjustSectionTitle}>Nhập / Điều chỉnh kho:</Text>
                    <View style={styles.stockRow}>
                      <TextInput
                        style={styles.stockInput}
                        placeholder="+/- số lượng (VD: 50 hoặc -5)"
                        placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
                        keyboardType="numeric"
                        value={stockInputs[medicine.id] || ''}
                        onChangeText={(value) =>
                          setStockInputs({ ...stockInputs, [medicine.id]: value.replace(/[^0-9-]/g, '') })
                        }
                      />
                      <TouchableOpacity
                        style={styles.stockButton}
                        onPress={() => submitStockAdjust(medicine.id)}
                      >
                        <Text style={styles.stockButtonText}>Cập nhật</Text>
                      </TouchableOpacity>
                    </View>
                    <TextInput
                      style={styles.noteInput}
                      placeholder="Lý do điều chỉnh (nhập hàng, kiểm kê...)"
                      placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
                      value={noteInputs[medicine.id] || ''}
                      onChangeText={(value) => setNoteInputs({ ...noteInputs, [medicine.id]: value })}
                      maxLength={255}
                    />
                  </View>

                  <View style={styles.cardFooter}>
                    <TouchableOpacity onPress={() => openHistory(medicine)}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="clipboard-outline" size={14} color={COLORS.primary} />
                        <Text style={styles.historyLink}>Xem lịch sử biến động kho →</Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Modal Lịch sử biến động tồn kho */}
      <Modal visible={Boolean(historyFor)} transparent animationType="fade" onRequestClose={() => setHistoryFor(null)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Lịch sử biến động</Text>
                <Text style={styles.modalSubtitle}>Thuốc: {historyFor?.name}</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setHistoryFor(null)}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              {historyLoading ? (
                <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
              ) : movements.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.empty}>Chưa có ghi nhận biến động tồn kho nào.</Text>
                </View>
              ) : (
                movements.map((m) => (
                  <View key={m.id} style={styles.movementRow}>
                    <View style={styles.movementTop}>
                      <View style={styles.movementTypeBadge}>
                        <Text style={styles.movementType}>{MOVEMENT_LABELS[m.movement_type] || m.movement_type}</Text>
                      </View>
                      <Text style={[styles.movementQty, { color: m.change_qty > 0 ? COLORS.success : COLORS.danger }]}>
                        {m.change_qty > 0 ? `+${m.change_qty}` : m.change_qty} (sau: {m.quantity_after})
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
                      <Text style={styles.movementMeta}>
                        {new Date(m.created_at).toLocaleString('vi-VN')} · Thực hiện: {m.created_by_name || 'Hệ thống'}
                      </Text>
                    </View>
                    {m.note ? <Text style={styles.movementNote}>Ghi chú: {m.note}</Text> : null}
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Modal Thêm thuốc mới */}
      <Modal visible={createVisible} transparent animationType="fade" onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Thêm dược phẩm mới</Text>
                <Text style={styles.modalSubtitle}>Khai báo thuốc mới vào kho bệnh viện</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setCreateVisible(false)}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll}>
              <Field
                label="Tên thuốc"
                value={form.name}
                onChangeText={(name) => setForm({ ...form, name })}
                placeholder="VD: Amoxicillin 250mg"
              />
              <Field
                label="Đơn vị tính (viên, chai, vỉ, ống...)"
                value={form.unit}
                onChangeText={(unit) => setForm({ ...form, unit })}
                placeholder="VD: viên"
              />
              <Field
                label="Giá bán lẻ (VNĐ)"
                value={form.price}
                onChangeText={(price) => setForm({ ...form, price: price.replace(/[^0-9]/g, '') })}
                keyboardType="numeric"
                placeholder="VD: 15000"
              />
              <Field
                label="Số lượng tồn kho ban đầu"
                value={form.stock_quantity}
                onChangeText={(stock_quantity) =>
                  setForm({ ...form, stock_quantity: stock_quantity.replace(/[^0-9]/g, '') })
                }
                keyboardType="numeric"
                placeholder="VD: 100"
              />
              <Field
                label="Mô tả công dụng & chỉ định"
                value={form.description}
                onChangeText={(description) => setForm({ ...form, description })}
                placeholder="Công dụng, liều dùng tham khảo..."
                multiline
              />
              <TouchableOpacity style={styles.saveButton} onPress={submitCreate} disabled={saving}>
                <Text style={styles.saveText}>{saving ? 'Đang lưu...' : 'Thêm vào kho thuốc'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ResponsiveContainer>
  );
}

function Field({ label, multiline, placeholder, ...props }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        {...props}
        placeholder={placeholder}
        placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline]}
      />
    </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: 12,
  },
  headerTitleWrap: {
    flex: 1,
    minWidth: 260,
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
  addButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    ...SHADOWS.sm,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
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
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  medicineGrid: {
    paddingHorizontal: 16,
    gap: 14,
  },
  medicineGridDesktop: {
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
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  medicineIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medicineIcon: {
    fontSize: 22,
  },
  name: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 16,
  },
  priceText: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 15,
    marginTop: 2,
  },
  unitText: {
    color: COLORS.textSecondary,
    fontWeight: '500',
    fontSize: 13,
  },
  stockBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  stockBadgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  descriptionText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  adjustSection: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginTop: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  adjustSectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  stockRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stockInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  stockButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stockButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 12,
    fontSize: 12,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  cardFooter: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  historyLink: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '90%',
    ...SHADOWS.lg,
  },
  modalCentered: {
    maxWidth: 600,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 15,
  },
  modalScroll: {
    maxHeight: 520,
  },
  movementRow: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 12,
    gap: 4,
  },
  movementTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  movementTypeBadge: {
    backgroundColor: COLORS.background,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  movementType: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 12,
  },
  movementQty: {
    fontWeight: '800',
    fontSize: 14,
  },
  movementMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  movementNote: {
    color: COLORS.text,
    fontSize: 12,
    fontStyle: 'italic',
  },
  fieldLabel: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: COLORS.text,
    backgroundColor: COLORS.background,
    fontSize: 14,
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
