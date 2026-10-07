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
import { COLORS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { listMedicinesApi, createMedicineApi, adjustMedicineStockApi, getMedicineMovementsApi } from '../../api/medicineApi';

const MOVEMENT_LABELS = {
  initial: 'Tồn ban đầu',
  import: 'Nhập kho',
  adjust: 'Điều chỉnh',
  reserve: 'Giữ chỗ đơn',
  release: 'Hoàn kho',
};

export default function AdminMedicinesScreen() {
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
      <View style={styles.header}>
        <Text style={styles.eyebrow}>QUẢN TRỊ</Text>
        <Text style={styles.title}>Kho thuốc</Text>
        <Text style={styles.subtitle}>Quản lý danh mục thuốc và tồn kho.</Text>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={() => setCreateVisible(true)}>
        <Text style={styles.addButtonText}>+ Thêm thuốc mới</Text>
      </TouchableOpacity>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} /> : medicines.map((medicine) => (
          <View key={medicine.id} style={styles.card}>
            <Text style={styles.name}>{medicine.name}</Text>
            <Text style={styles.detail}>{Number(medicine.price).toLocaleString('vi-VN')}đ / {medicine.unit}</Text>
            <Text style={styles.stock}>Tồn kho: {medicine.stock_quantity}</Text>
            <View style={styles.stockRow}>
              <TextInput
                style={styles.stockInput}
                placeholder="+/- số lượng"
                keyboardType="numeric"
                value={stockInputs[medicine.id] || ''}
                onChangeText={(value) => setStockInputs({ ...stockInputs, [medicine.id]: value.replace(/[^0-9-]/g, '') })}
              />
              <TouchableOpacity style={styles.stockButton} onPress={() => submitStockAdjust(medicine.id)}>
                <Text style={styles.stockButtonText}>Cập nhật</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.stockInput, styles.noteInput]}
              placeholder="Ghi chú / lý do (không bắt buộc)"
              value={noteInputs[medicine.id] || ''}
              onChangeText={(value) => setNoteInputs({ ...noteInputs, [medicine.id]: value })}
              maxLength={255}
            />
            <TouchableOpacity onPress={() => openHistory(medicine)}>
              <Text style={styles.historyLink}>Xem lịch sử tồn kho</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>

      <Modal visible={Boolean(historyFor)} transparent animationType="slide" onRequestClose={() => setHistoryFor(null)}>
        <View style={styles.overlay}><View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Lịch sử: {historyFor?.name}</Text>
            <TouchableOpacity onPress={() => setHistoryFor(null)}><Text style={styles.close}>X</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {historyLoading ? <ActivityIndicator color={COLORS.primary} /> : movements.length === 0 ? (
              <Text style={styles.detail}>Chưa có biến động tồn kho.</Text>
            ) : movements.map((m) => (
              <View key={m.id} style={styles.movementRow}>
                <View style={styles.movementTop}>
                  <Text style={styles.movementType}>{MOVEMENT_LABELS[m.movement_type] || m.movement_type}</Text>
                  <Text style={[styles.movementQty, { color: m.change_qty > 0 ? COLORS.success : COLORS.danger }]}>
                    {m.change_qty > 0 ? '+' : ''}{m.change_qty} (còn {m.quantity_after})
                  </Text>
                </View>
                <Text style={styles.detail}>
                  {new Date(m.created_at).toLocaleString('vi-VN')} · {m.created_by_name || 'Hệ thống'}
                </Text>
                {m.note ? <Text style={styles.detail}>{m.note}</Text> : null}
              </View>
            ))}
          </ScrollView>
        </View></View>
      </Modal>

      <Modal visible={createVisible} transparent animationType="slide" onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.overlay}><View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Thêm thuốc mới</Text>
            <TouchableOpacity onPress={() => setCreateVisible(false)}><Text style={styles.close}>X</Text></TouchableOpacity>
          </View>
          <ScrollView>
            <Field label="Tên thuốc" value={form.name} onChangeText={(name) => setForm({ ...form, name })} />
            <Field label="Đơn vị (viên, chai...)" value={form.unit} onChangeText={(unit) => setForm({ ...form, unit })} />
            <Field label="Giá bán" value={form.price} onChangeText={(price) => setForm({ ...form, price: price.replace(/[^0-9]/g, '') })} keyboardType="numeric" />
            <Field label="Tồn kho ban đầu" value={form.stock_quantity} onChangeText={(stock_quantity) => setForm({ ...form, stock_quantity: stock_quantity.replace(/[^0-9]/g, '') })} keyboardType="numeric" />
            <Field label="Mô tả" value={form.description} onChangeText={(description) => setForm({ ...form, description })} multiline />
            <TouchableOpacity style={styles.saveButton} onPress={submitCreate} disabled={saving}>
              <Text style={styles.saveText}>{saving ? 'Đang lưu...' : 'Thêm thuốc'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View></View>
      </Modal>
    </ResponsiveContainer>
  );
}

function Field({ label, multiline, ...props }) {
  return <View><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} multiline={multiline} style={[styles.input, multiline && styles.multiline]} /></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { padding: 20, paddingBottom: 12 },
  eyebrow: { color: COLORS.primary, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  title: { color: COLORS.text, fontSize: 26, fontWeight: '800', marginTop: 5 },
  subtitle: { color: COLORS.textSecondary, marginTop: 6 },
  addButton: { marginHorizontal: 16, marginBottom: 12, backgroundColor: COLORS.primary, padding: 13, borderRadius: 10, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '800' },
  loader: { marginTop: 30 },
  card: { backgroundColor: COLORS.surface, borderRadius: 14, padding: 16, marginHorizontal: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  name: { color: COLORS.text, fontWeight: '800', fontSize: 16 },
  detail: { color: COLORS.textSecondary, marginTop: 5 },
  stock: { color: COLORS.primaryDark, fontWeight: '700', marginTop: 5 },
  stockRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  stockInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, color: COLORS.text },
  stockButton: { backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 14, justifyContent: 'center' },
  stockButtonText: { color: COLORS.primaryDark, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'flex-end' },
  modal: { backgroundColor: COLORS.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  modalTitle: { color: COLORS.text, fontSize: 21, fontWeight: '800' },
  close: { color: COLORS.textSecondary, fontWeight: '800', padding: 8 },
  fieldLabel: { color: COLORS.text, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, padding: 11, color: COLORS.text, backgroundColor: COLORS.background },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  saveButton: { backgroundColor: COLORS.primary, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 20, marginBottom: 12 },
  saveText: { color: '#fff', fontWeight: '800' },
  noteInput: { marginTop: 8 },
  historyLink: { color: COLORS.primary, fontWeight: '700', marginTop: 10 },
  movementRow: { borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10 },
  movementTop: { flexDirection: 'row', justifyContent: 'space-between' },
  movementType: { color: COLORS.text, fontWeight: '700' },
  movementQty: { fontWeight: '800' },
});
