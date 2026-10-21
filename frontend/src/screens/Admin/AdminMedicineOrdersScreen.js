import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import {
  createWalkInMedicineOrderApi,
  listMedicineOrdersApi,
  updateMedicineOrderItemsApi,
  updateMedicineOrderStatusApi,
} from '../../api/medicineOrderApi';
import { listMedicinesApi } from '../../api/medicineApi';
import { lookupCustomerByPhoneApi } from '../../api/invoiceApi';

const SPECIES_OPTIONS = [
  { value: 'dog', label: 'Chó', icon: 'dog' },
  { value: 'cat', label: 'Mèo', icon: 'cat' },
  { value: 'other', label: 'Khác', icon: 'paw' },
];

const formatSpeciesLabel = (species) => {
  if (!species) return 'Khác';
  const s = String(species).toLowerCase();
  if (s === 'dog' || s.includes('chó')) return 'Chó';
  if (s === 'cat' || s.includes('mèo')) return 'Mèo';
  return 'Khác';
};

const getSpeciesIconName = (species) => {
  if (!species) return 'paw';
  const s = String(species).toLowerCase();
  if (s === 'dog' || s.includes('chó')) return 'dog';
  if (s === 'cat' || s.includes('mèo')) return 'cat';
  return 'paw';
};

const STATUS_TABS = [
  ['pending', 'Chờ thanh toán'],
  ['paid', 'Đã thanh toán'],
  ['all', 'Tất cả đơn'],
];

export default function AdminMedicineOrdersScreen() {
  const { isTabletOrDesktop } = useResponsive();
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState(null);

  // State cho Popup Tạo Hóa đơn & Mã QR Thanh toán Dược sĩ
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState('prescription'); // 'prescription' | 'walk_in'
  const [invoiceStep, setInvoiceStep] = useState('select_medicines'); // 'select_medicines' | 'qr_view'
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  // Đơn thuốc khách đặt từ đơn bác sĩ đang xử lý
  const [targetOrder, setTargetOrder] = useState(null);
  // Danh sách thuốc trong đơn kê để dược sĩ tích chọn / điều chỉnh số lượng
  // [{ medicine_id, medicine_name, unit, dosage, prescribed_qty, quantity, unit_price, checked }]
  const [editableOrderItems, setEditableOrderItems] = useState([]);
  const [invoiceNotes, setInvoiceNotes] = useState('');

  // State cho đơn thuốc khách vãng lai (không có đơn bác sĩ)
  const [catalogMedicines, setCatalogMedicines] = useState([]);
  const [medicineSearch, setMedicineSearch] = useState('');
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [walkInPhoneSearch, setWalkInPhoneSearch] = useState('');
  const [walkInPhoneSearching, setWalkInPhoneSearching] = useState(false);
  const [walkInMatchedUser, setWalkInMatchedUser] = useState(null);
  const [walkInMatchedPets, setWalkInMatchedPets] = useState([]);
  const [walkInSelectedPetId, setWalkInSelectedPetId] = useState(null);
  const [walkInSpecies, setWalkInSpecies] = useState('dog');
  // [{ medicine_id, medicine_name, unit, price, stock_quantity, quantity }]
  const [walkInSelectedItems, setWalkInSelectedItems] = useState([]);

  // Đơn đã xác nhận danh sách thuốc -> hiển thị QR
  const [activeInvoiceOrder, setActiveInvoiceOrder] = useState(null);

  const loadOrders = async (filter = statusFilter) => {
    try {
      setLoading(true);
      const response = await listMedicineOrdersApi(filter === 'all' ? undefined : filter);
      setOrders(response.data.success ? response.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải danh sách đơn mua thuốc');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders(statusFilter);
  }, [statusFilter]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders(statusFilter);
    setRefreshing(false);
  };

  const cancelOrder = async (orderId) => {
    try {
      setProcessingId(orderId);
      await updateMedicineOrderStatusApi(orderId, 'cancelled');
      await loadOrders(statusFilter);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể hủy đơn giữ chỗ');
    } finally {
      setProcessingId(null);
    }
  };

  /**
   * Mở Popup Hóa đơn cho đơn thuốc khách đặt từ đơn kê bác sĩ (hoặc xem lại đơn đã thanh toán)
   */
  const openOrderInvoiceModal = (order) => {
    setTargetOrder(order);
    setInvoiceMode(order.order_type === 'walk_in' ? 'walk_in' : 'prescription');
    setInvoiceNotes(order.notes || '');

    // Nếu đơn đã thanh toán hoặc là đơn vãng lai chờ thanh toán -> hiển thị luôn màn QR
    if (order.status === 'paid' || order.order_type === 'walk_in') {
      setActiveInvoiceOrder(order);
      setInvoiceStep('qr_view');
      setInvoiceModalVisible(true);
      return;
    }

    // Mặc định tích chọn tất cả các thuốc trong đơn bác sĩ kê (hoặc theo danh sách đã điều chỉnh trước đó)
    const basePrescribed =
      Array.isArray(order.prescribed_items) && order.prescribed_items.length > 0
        ? order.prescribed_items
        : order.items || [];

    const currentSavedMap = new Map(
      (order.items || []).map((it) => [Number(it.medicine_id), Number(it.quantity)])
    );

    const initialChecklist = basePrescribed.map((pItem) => {
      const medId = Number(pItem.medicine_id);
      const hasSaved = currentSavedMap.has(medId);
      const savedQty = currentSavedMap.get(medId);
      return {
        medicine_id: medId,
        medicine_name: pItem.medicine_name,
        unit: pItem.unit || 'viên',
        dosage: pItem.dosage || '',
        prescribed_qty: Number(pItem.quantity) || 1,
        quantity: String(hasSaved ? savedQty : pItem.quantity || 1),
        unit_price: Number(pItem.unit_price || 0),
        checked: hasSaved ? savedQty > 0 : true,
      };
    });

    setEditableOrderItems(initialChecklist);
    setActiveInvoiceOrder(order);
    setInvoiceStep('select_medicines');
    setInvoiceModalVisible(true);
  };

  /**
   * Đặt lại mặc định tất cả các thuốc theo đơn bác sĩ kê
   */
  const resetToPrescribedItems = () => {
    if (!targetOrder) return;
    const basePrescribed =
      Array.isArray(targetOrder.prescribed_items) && targetOrder.prescribed_items.length > 0
        ? targetOrder.prescribed_items
        : targetOrder.items || [];

    setEditableOrderItems(
      basePrescribed.map((pItem) => ({
        medicine_id: Number(pItem.medicine_id),
        medicine_name: pItem.medicine_name,
        unit: pItem.unit || 'viên',
        dosage: pItem.dosage || '',
        prescribed_qty: Number(pItem.quantity) || 1,
        quantity: String(pItem.quantity || 1),
        unit_price: Number(pItem.unit_price || 0),
        checked: true,
      }))
    );
  };

  const toggleOrderMedicine = (medId) => {
    setEditableOrderItems((prev) =>
      prev.map((item) =>
        item.medicine_id === medId ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const changeOrderMedicineQty = (medId, deltaOrText, isDirectText = false) => {
    setEditableOrderItems((prev) =>
      prev.map((item) => {
        if (item.medicine_id !== medId) return item;
        if (isDirectText) {
          const cleaned = String(deltaOrText).replace(/[^0-9]/g, '');
          return { ...item, quantity: cleaned, checked: cleaned !== '0' && cleaned !== '' ? true : item.checked };
        }
        const current = Math.max(1, Number(item.quantity) || 1);
        const next = Math.max(1, current + Number(deltaOrText));
        return { ...item, quantity: String(next), checked: true };
      })
    );
  };

  /**
   * Mở Popup "+ Tạo hóa đơn" cho khách vãng lai mua thuốc trực tiếp
   */
  const openWalkInOrderModal = async () => {
    setTargetOrder(null);
    setInvoiceMode('walk_in');
    setInvoiceStep('select_medicines');
    setWalkInCustomerName('');
    setWalkInPhoneSearch('');
    setWalkInMatchedUser(null);
    setWalkInMatchedPets([]);
    setWalkInSelectedPetId(null);
    setWalkInSpecies('dog');
    setWalkInSelectedItems([]);
    setMedicineSearch('');
    setInvoiceNotes('');
    setActiveInvoiceOrder(null);
    setInvoiceModalVisible(true);

    try {
      setInvoiceLoading(true);
      const res = await listMedicinesApi();
      const meds = res.data?.success ? res.data.data || [] : [];
      setCatalogMedicines(meds.filter((m) => m.is_active !== 0 && m.is_active !== false));
    } catch (error) {
      Alert.alert('Lỗi', 'Không thể tải danh mục thuốc trong kho');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const handleLookupWalkInPhone = async () => {
    const phone = walkInPhoneSearch.trim();
    if (!phone) {
      Alert.alert('Thiếu SĐT', 'Vui lòng nhập số điện thoại khách hàng để tra cứu.');
      return;
    }
    try {
      setWalkInPhoneSearching(true);
      const res = await lookupCustomerByPhoneApi(phone);
      if (res.data?.success && res.data.data?.user) {
        const { user, pets = [] } = res.data.data;
        setWalkInMatchedUser(user);
        setWalkInMatchedPets(pets);
        setWalkInCustomerName(user.full_name || '');
        if (pets.length > 0) {
          setWalkInSelectedPetId(pets[0].id);
          setWalkInSpecies(
            ['dog', 'cat', 'other'].includes(pets[0].species) ? pets[0].species : 'other'
          );
        } else {
          setWalkInSelectedPetId(null);
        }
      }
    } catch (error) {
      setWalkInMatchedUser(null);
      setWalkInMatchedPets([]);
      setWalkInSelectedPetId(null);
      Alert.alert(
        'Không tìm thấy tài khoản',
        error.response?.data?.message ||
          'Chưa có tài khoản khách hàng đăng ký số điện thoại này. Bạn có thể nhập tên khách hàng bên dưới để tạo đơn vãng lai.'
      );
    } finally {
      setWalkInPhoneSearching(false);
    }
  };

  const clearMatchedWalkInCustomer = () => {
    setWalkInMatchedUser(null);
    setWalkInMatchedPets([]);
    setWalkInSelectedPetId(null);
  };

  const toggleWalkInMedicine = (medicine) => {
    const medId = Number(medicine.id);
    const exists = walkInSelectedItems.some((item) => item.medicine_id === medId);
    if (exists) {
      setWalkInSelectedItems((prev) => prev.filter((item) => item.medicine_id !== medId));
    } else {
      if (Number(medicine.stock_quantity) <= 0) {
        Alert.alert('Hết hàng', `Thuốc "${medicine.name}" hiện đã hết tồn kho.`);
        return;
      }
      setWalkInSelectedItems((prev) => [
        ...prev,
        {
          medicine_id: medId,
          medicine_name: medicine.name,
          unit: medicine.unit || 'viên',
          price: Number(medicine.price || 0),
          stock_quantity: Number(medicine.stock_quantity || 0),
          quantity: '1',
        },
      ]);
    }
  };

  const changeWalkInMedicineQty = (medId, deltaOrText, isDirectText = false) => {
    setWalkInSelectedItems((prev) =>
      prev.map((item) => {
        if (item.medicine_id !== medId) return item;
        if (isDirectText) {
          const cleaned = String(deltaOrText).replace(/[^0-9]/g, '');
          return { ...item, quantity: cleaned };
        }
        const current = Math.max(1, Number(item.quantity) || 1);
        const next = Math.min(item.stock_quantity || 9999, Math.max(1, current + Number(deltaOrText)));
        return { ...item, quantity: String(next) };
      })
    );
  };

  // Tính tổng tiền tạm tính ở Bước 1
  const calculatedPreviewTotal =
    invoiceMode === 'prescription'
      ? editableOrderItems
          .filter((it) => it.checked && Number(it.quantity) > 0)
          .reduce((sum, it) => sum + Number(it.unit_price || 0) * Number(it.quantity || 0), 0)
      : walkInSelectedItems.reduce(
          (sum, it) => sum + Number(it.price || 0) * Math.max(0, Number(it.quantity) || 0),
          0
        );

  /**
   * Xác nhận danh sách thuốc thực tế khách lấy & chuyển sang bước hiển thị QR thanh toán
   */
  const submitPrepareInvoice = async () => {
    if (invoiceMode === 'prescription') {
      const selected = editableOrderItems.filter((it) => it.checked && Number(it.quantity) > 0);
      if (selected.length === 0) {
        Alert.alert('Chưa chọn thuốc', 'Vui lòng tích chọn ít nhất 1 loại thuốc với số lượng hợp lệ để thanh toán.');
        return;
      }

      try {
        setInvoiceSaving(true);
        const res = await updateMedicineOrderItemsApi(targetOrder.id, {
          items: selected.map((it) => ({
            medicine_id: it.medicine_id,
            quantity: Number(it.quantity),
          })),
          notes: invoiceNotes.trim() || undefined,
        });
        if (res.data?.success) {
          const updated = res.data.data;
          setActiveInvoiceOrder(updated);
          setTargetOrder(updated);
          setInvoiceStep('qr_view');
          await loadOrders(statusFilter);
        }
      } catch (error) {
        Alert.alert('Lỗi', error.response?.data?.message || 'Không thể cập nhật hóa đơn thuốc');
      } finally {
        setInvoiceSaving(false);
      }
    } else {
      if (!walkInCustomerName.trim()) {
        Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên người dùng (khách hàng).');
        return;
      }
      const validWalkInItems = walkInSelectedItems.filter((it) => Number(it.quantity) > 0);
      if (validWalkInItems.length === 0) {
        Alert.alert('Chưa chọn thuốc', 'Vui lòng chọn ít nhất 1 loại thuốc và nhập số lượng mua.');
        return;
      }

      for (const it of validWalkInItems) {
        if (Number(it.quantity) > Number(it.stock_quantity)) {
          Alert.alert(
            'Vượt tồn kho',
            `Thuốc "${it.medicine_name}" chỉ còn ${it.stock_quantity} ${it.unit} trong kho.`
          );
          return;
        }
      }

      try {
        setInvoiceSaving(true);
        const selectedPetObj = walkInMatchedPets.find(
          (p) => Number(p.id) === Number(walkInSelectedPetId)
        );
        const res = await createWalkInMedicineOrderApi({
          customer_name: walkInCustomerName.trim(),
          customer_phone: walkInMatchedUser?.phone || walkInPhoneSearch.trim() || undefined,
          user_id: walkInMatchedUser?.id || undefined,
          pet_id: selectedPetObj?.id || undefined,
          pet_name: selectedPetObj?.name || undefined,
          pet_species: selectedPetObj?.species || walkInSpecies,
          items: validWalkInItems.map((it) => ({
            medicine_id: it.medicine_id,
            quantity: Number(it.quantity),
          })),
          notes: invoiceNotes.trim() || undefined,
        });
        if (res.data?.success) {
          const created = res.data.data;
          setActiveInvoiceOrder(created);
          setInvoiceStep('qr_view');
          await loadOrders(statusFilter);
        }
      } catch (error) {
        Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tạo hóa đơn thuốc vãng lai');
      } finally {
        setInvoiceSaving(false);
      }
    }
  };

  /**
   * Hoàn tất thanh toán & Đóng popup (chuyển trạng thái đơn sang 'paid')
   */
  const completeOrderPayment = async () => {
    if (!activeInvoiceOrder?.id) {
      setInvoiceModalVisible(false);
      return;
    }
    if (activeInvoiceOrder.status === 'paid') {
      setInvoiceModalVisible(false);
      return;
    }

    try {
      setInvoiceSaving(true);
      await updateMedicineOrderStatusApi(activeInvoiceOrder.id, 'paid');
      setInvoiceModalVisible(false);
      await loadOrders(statusFilter);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể xác nhận hoàn tất thanh toán');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const filteredCatalogMedicines = catalogMedicines.filter((m) =>
    !medicineSearch.trim()
      ? true
      : m.name?.toLowerCase().includes(medicineSearch.trim().toLowerCase())
  );

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>QUẦY DƯỢC PHẨM</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Text style={styles.title}>Thanh Toán & Xuất Thuốc</Text>
                <Ionicons name="receipt-outline" size={24} color={COLORS.primary} />
              </View>
              <Text style={styles.subtitle}>
                Kiểm tra thuốc thực tế khách lấy, tạo mã QR thanh toán cho đơn bác sĩ kê hoặc bán thuốc vãng lai.
              </Text>
            </View>

            <TouchableOpacity
              style={styles.createWalkInInvoiceBtn}
              onPress={openWalkInOrderModal}
              activeOpacity={0.85}
            >
              <Ionicons name="qr-code-outline" size={18} color="#fff" />
              <Text style={styles.createWalkInInvoiceBtnText}>+ Tạo hóa đơn</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Thanh lọc trạng thái đơn thuốc */}
        <View style={styles.filterSection}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_TABS.map(([val, label]) => {
              const selected = statusFilter === val;
              return (
                <TouchableOpacity
                  key={val}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() => setStatusFilter(val)}
                >
                  <Text style={selected ? styles.chipTextSelected : styles.chipText}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={styles.loader} />
        ) : orders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="sparkles-outline" size={44} color={COLORS.textTertiary || '#94A3B8'} style={{ marginBottom: 12 }} />
            <Text style={styles.empty}>
              {statusFilter === 'pending'
                ? 'Hiện không có đơn thuốc nào đang chờ thanh toán.'
                : statusFilter === 'paid'
                ? 'Chưa có đơn thuốc nào đã hoàn tất thanh toán.'
                : 'Chưa có đơn thuốc nào trong hệ thống.'}
            </Text>
            <Text style={styles.emptySub}>
              Các đơn đặt giữ chỗ từ khách hàng hoặc đơn thuốc vãng lai sẽ xuất hiện tại đây.
            </Text>
          </View>
        ) : (
          <View style={[styles.orderGrid, isTabletOrDesktop && styles.orderGridDesktop]}>
            {orders.map((order) => {
              const isProcessing = processingId === order.id;
              const isPaid = order.status === 'paid';
              const isCancelled = order.status === 'cancelled';
              const isWalkIn = order.order_type === 'walk_in';
              const displayCode = order.order_code || `#ĐH-${order.id}`;
              const itemsList = order.items || [];

              return (
                <View key={order.id} style={[styles.card, isTabletOrDesktop && styles.cardDesktop]}>
                  <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <View
                        style={[
                          styles.statusBadge,
                          isPaid && { backgroundColor: '#DCFCE7' },
                          isCancelled && { backgroundColor: '#FEE2E2' },
                        ]}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Ionicons
                            name={
                              isPaid
                                ? 'checkmark-circle'
                                : isCancelled
                                ? 'close-circle'
                                : 'hourglass-outline'
                            }
                            size={13}
                            color={isPaid ? '#16A34A' : isCancelled ? '#DC2626' : '#D97706'}
                          />
                          <Text
                            style={[
                              styles.statusBadgeText,
                              isPaid && { color: '#16A34A' },
                              isCancelled && { color: '#DC2626' },
                            ]}
                          >
                            {isPaid ? 'Đã thanh toán' : isCancelled ? 'Đã hủy' : 'Chờ thanh toán'}
                          </Text>
                        </View>
                      </View>

                      <View style={[styles.orderTypeBadge, isWalkIn && styles.orderTypeBadgeWalkIn]}>
                        <Text style={[styles.orderTypeBadgeText, isWalkIn && styles.orderTypeBadgeTextWalkIn]}>
                          {isWalkIn ? 'Khách vãng lai' : 'Đơn bác sĩ kê'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.orderId}>{displayCode}</Text>
                  </View>

                  <View style={styles.customerBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons name="person-outline" size={13} color={COLORS.text} />
                      <Text style={styles.customerName}>{order.customer_name || 'Khách vãng lai'}</Text>
                    </View>
                    {!isWalkIn && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="call-outline" size={13} color={COLORS.textSecondary} />
                        <Text style={styles.customerPhone}>{order.customer_phone || 'Chưa có SĐT'}</Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <FontAwesome5
                        name={getSpeciesIconName(order.pet_species)}
                        size={12}
                        color={COLORS.primary}
                      />
                      <Text style={styles.petName}>
                        {order.pet_name
                          ? `Thú cưng: ${order.pet_name} (${formatSpeciesLabel(order.pet_species)})`
                          : `Loài khám: ${formatSpeciesLabel(order.pet_species)}`}
                      </Text>
                    </View>
                  </View>

                  {/* Tóm tắt danh sách thuốc trong đơn */}
                  {itemsList.length > 0 && (
                    <View style={styles.itemsPreviewBox}>
                      <Text style={styles.itemsPreviewTitle}>
                        Danh sách thuốc ({itemsList.length} loại):
                      </Text>
                      {itemsList.map((it, idx) => (
                        <View key={it.id || idx} style={styles.itemsPreviewRow}>
                          <Text style={styles.itemsPreviewName} numberOfLines={1}>
                            • {it.medicine_name}
                          </Text>
                          <Text style={styles.itemsPreviewMeta}>
                            {it.quantity} {it.unit || 'viên'} × {Number(it.unit_price || 0).toLocaleString('vi-VN')} đ
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.amountBox}>
                    <Text style={styles.amountLabel}>
                      {isPaid ? 'Tổng tiền đã thu:' : 'Tổng tiền cần thu:'}
                    </Text>
                    <Text style={styles.totalAmount}>
                      {Number(order.total_amount).toLocaleString('vi-VN')} đ
                    </Text>
                  </View>

                  {/* Chỉ hiển thị các nút thao tác khi đơn đang chờ thanh toán (pending) */}
                  {order.status === 'pending' && (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.payButton]}
                        onPress={() => openOrderInvoiceModal(order)}
                        disabled={isProcessing}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                          <Ionicons name="qr-code-outline" size={16} color="#fff" />
                          <Text style={styles.actionText}>
                            {isWalkIn ? 'Xem mã QR thanh toán' : 'Tạo hóa đơn & Mã QR'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.actionButton, styles.cancelButton]}
                        onPress={() => cancelOrder(order.id)}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <ActivityIndicator color={COLORS.danger} size="small" />
                        ) : (
                          <Text style={styles.cancelText}>Hủy đơn</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* POPUP TẠO HÓA ĐƠN & MÃ QR THANH TOÁN CHO DƯỢC SĨ */}
      <Modal
        visible={invoiceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInvoiceModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={[styles.modal, isTabletOrDesktop && styles.modalCentered]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="qr-code-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.modalTitle}>
                    {invoiceStep === 'qr_view'
                      ? 'Hóa Đơn Thuốc & Mã QR Thanh Toán'
                      : invoiceMode === 'prescription'
                      ? 'Xác nhận Thuốc & Tạo Hóa đơn'
                      : 'Tạo Hóa đơn Thuốc (Khách vãng lai)'}
                  </Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  {invoiceStep === 'qr_view'
                    ? `Mã đơn: ${activeInvoiceOrder?.order_code || `#ĐH-${activeInvoiceOrder?.id || ''}`} · Quét mã QR để thanh toán`
                    : invoiceMode === 'prescription'
                    ? 'Mặc định tích chọn các thuốc theo đơn bác sĩ kê. Dược sĩ có thể bỏ chọn hoặc chỉnh số lượng thực tế khách lấy.'
                    : 'Nhập tên người dùng, loài thú cưng và chọn các loại thuốc khách mua trực tiếp.'}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setInvoiceModalVisible(false)}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {invoiceLoading ? (
              <View style={{ paddingVertical: 40, alignItems: 'center' }}>
                <ActivityIndicator size="large" color={COLORS.primary} />
                <Text style={{ marginTop: 10, color: COLORS.textSecondary, fontSize: 13 }}>
                  Đang tải danh mục thuốc trong kho...
                </Text>
              </View>
            ) : invoiceStep === 'select_medicines' ? (
              /* BƯỚC 1: CHỌN / ĐIỀU CHỈNH THUỐC & SỐ LƯỢNG TRƯỚC KHI XÁC NHẬN SỐ TIỀN */
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {invoiceMode === 'prescription' && targetOrder ? (
                  <>
                    <View style={styles.invoiceSummaryCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <View style={styles.invoiceTypeTagPrescription}>
                          <Ionicons name="medkit-outline" size={13} color="#0F766E" />
                          <Text style={styles.invoiceTypeTagPrescriptionText}>Đơn thuốc theo bác sĩ kê</Text>
                        </View>
                        <Text style={styles.orderCodeTag}>
                          {targetOrder.order_code || `#ĐH-${targetOrder.id}`}
                        </Text>
                      </View>
                      <InfoRow
                        label="Khách hàng"
                        value={
                          targetOrder.customer_phone
                            ? `${targetOrder.customer_name} (${targetOrder.customer_phone})`
                            : targetOrder.customer_name
                        }
                      />
                      <InfoRow
                        label="Thú cưng"
                        value={
                          targetOrder.pet_name
                            ? `${targetOrder.pet_name} (${formatSpeciesLabel(targetOrder.pet_species)})`
                            : formatSpeciesLabel(targetOrder.pet_species)
                        }
                      />
                      {targetOrder.doctor_name ? (
                        <InfoRow label="Bác sĩ kê đơn" value={targetOrder.doctor_name} />
                      ) : null}
                    </View>

                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.fieldLabel}>
                        Chọn thuốc thực tế khách mua (
                        {editableOrderItems.filter((i) => i.checked && Number(i.quantity) > 0).length}/
                        {editableOrderItems.length}) *
                      </Text>
                      <TouchableOpacity onPress={resetToPrescribedItems} style={styles.resetPrescribedBtn}>
                        <Ionicons name="refresh-outline" size={13} color={COLORS.primaryDark} />
                        <Text style={styles.resetPrescribedBtnText}>Chọn lại theo đơn kê</Text>
                      </TouchableOpacity>
                    </View>

                    <View style={styles.medicineChecklistWrap}>
                      {editableOrderItems.map((item) => {
                        const isChecked = item.checked && Number(item.quantity) > 0;
                        const lineTotal = isChecked
                          ? Number(item.unit_price || 0) * Number(item.quantity || 0)
                          : 0;

                        return (
                          <View
                            key={item.medicine_id}
                            style={[
                              styles.medicineCheckCard,
                              isChecked && styles.medicineCheckCardActive,
                            ]}
                          >
                            <TouchableOpacity
                              style={styles.medicineCheckTopRow}
                              onPress={() => toggleOrderMedicine(item.medicine_id)}
                              activeOpacity={0.75}
                            >
                              <View
                                style={[
                                  styles.checkboxSquare,
                                  isChecked && styles.checkboxSquareChecked,
                                ]}
                              >
                                {isChecked && <Ionicons name="checkmark" size={15} color="#fff" />}
                              </View>

                              <View style={{ flex: 1, marginRight: 8 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                  <Text
                                    style={[
                                      styles.medicineCheckName,
                                      isChecked && styles.medicineCheckNameActive,
                                    ]}
                                  >
                                    {item.medicine_name}
                                  </Text>
                                  <View style={styles.prescribedDefaultTag}>
                                    <Text style={styles.prescribedDefaultTagText}>
                                      Bác sĩ kê: {item.prescribed_qty} {item.unit}
                                    </Text>
                                  </View>
                                </View>
                                {item.dosage ? (
                                  <Text style={styles.medicineDosageText}>Liều dùng: {item.dosage}</Text>
                                ) : null}
                                <Text style={styles.medicineUnitPriceText}>
                                  Đơn giá: {Number(item.unit_price || 0).toLocaleString('vi-VN')} đ / {item.unit}
                                </Text>
                              </View>

                              <Text
                                style={[
                                  styles.medicineLineTotalText,
                                  isChecked && styles.medicineLineTotalTextActive,
                                ]}
                              >
                                {lineTotal.toLocaleString('vi-VN')} đ
                              </Text>
                            </TouchableOpacity>

                            {item.checked && (
                              <View style={styles.qtyAdjustRow}>
                                <Text style={styles.qtyAdjustLabel}>Số lượng thực lấy ({item.unit}):</Text>
                                <View style={styles.qtyStepper}>
                                  <TouchableOpacity
                                    style={styles.qtyStepBtn}
                                    onPress={() => changeOrderMedicineQty(item.medicine_id, -1)}
                                  >
                                    <Ionicons name="remove" size={16} color={COLORS.text} />
                                  </TouchableOpacity>
                                  <TextInput
                                    value={String(item.quantity)}
                                    onChangeText={(val) =>
                                      changeOrderMedicineQty(item.medicine_id, val, true)
                                    }
                                    keyboardType="numeric"
                                    style={styles.qtyInput}
                                  />
                                  <TouchableOpacity
                                    style={styles.qtyStepBtn}
                                    onPress={() => changeOrderMedicineQty(item.medicine_id, 1)}
                                  >
                                    <Ionicons name="add" size={16} color={COLORS.text} />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </>
                ) : (
                  /* FORM TỐI GIẢN CHO KHÁCH VÃNG LAI MUA THUỐC TRỰC TIẾP */
                  <>
                    <View style={styles.walkInFormBox}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <View style={styles.invoiceTypeTagWalkIn}>
                          <Ionicons name="walk-outline" size={14} color="#0369A1" />
                          <Text style={styles.invoiceTypeTagWalkInText}>
                            Khách mua thuốc trực tiếp (Không có đơn bác sĩ)
                          </Text>
                        </View>
                      </View>

                      {/* Tìm theo Số điện thoại khách hàng (không bắt buộc) */}
                      <Text style={styles.fieldLabel}>
                        Tìm theo Số điện thoại khách hàng (không bắt buộc)
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        <TextInput
                          value={walkInPhoneSearch}
                          onChangeText={setWalkInPhoneSearch}
                          onSubmitEditing={handleLookupWalkInPhone}
                          placeholder="Nhập SĐT khách đã có tài khoản..."
                          placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
                          keyboardType="phone-pad"
                          style={[styles.input, { flex: 1 }]}
                        />
                        <TouchableOpacity
                          style={[
                            {
                              backgroundColor: COLORS.primary,
                              borderRadius: 10,
                              paddingHorizontal: 14,
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            },
                            walkInPhoneSearching && { opacity: 0.7 },
                          ]}
                          onPress={handleLookupWalkInPhone}
                          disabled={walkInPhoneSearching}
                        >
                          {walkInPhoneSearching ? (
                            <ActivityIndicator color="#fff" size="small" />
                          ) : (
                            <>
                              <Ionicons name="search-outline" size={16} color="#fff" />
                              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                                Tìm SĐT
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      </View>

                      {walkInMatchedUser && (
                        <View
                          style={{
                            backgroundColor: '#F0FDFA',
                            borderWidth: 1,
                            borderColor: COLORS.primary,
                            borderRadius: 12,
                            padding: 12,
                            marginBottom: 12,
                          }}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: walkInMatchedPets.length > 0 ? 8 : 0,
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                              <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                              <Text style={{ color: COLORS.primaryDark, fontWeight: '800', fontSize: 13 }}>
                                Đã liên kết TK: {walkInMatchedUser.full_name} ({walkInMatchedUser.phone})
                              </Text>
                            </View>
                            <TouchableOpacity onPress={clearMatchedWalkInCustomer}>
                              <Text style={{ color: COLORS.danger, fontSize: 12, fontWeight: '700' }}>
                                Bỏ liên kết
                              </Text>
                            </TouchableOpacity>
                          </View>

                          {walkInMatchedPets.length > 0 && (
                            <>
                              <Text style={{ fontSize: 12, fontWeight: '700', color: COLORS.textSecondary, marginBottom: 6 }}>
                                Chọn thú cưng của khách:
                              </Text>
                              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                                {walkInMatchedPets.map((pet) => {
                                  const isPetSelected = Number(walkInSelectedPetId) === Number(pet.id);
                                  return (
                                    <TouchableOpacity
                                      key={pet.id}
                                      style={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                        paddingVertical: 7,
                                        paddingHorizontal: 12,
                                        borderRadius: 20,
                                        borderWidth: 1.5,
                                        borderColor: isPetSelected ? COLORS.primary : COLORS.border,
                                        backgroundColor: isPetSelected ? COLORS.primary : '#fff',
                                      }}
                                      onPress={() => {
                                        setWalkInSelectedPetId(pet.id);
                                        if (['dog', 'cat', 'other'].includes(pet.species)) {
                                          setWalkInSpecies(pet.species);
                                        }
                                      }}
                                    >
                                      <FontAwesome5
                                        name={getSpeciesIconName(pet.species)}
                                        size={12}
                                        color={isPetSelected ? '#fff' : COLORS.primaryDark}
                                      />
                                      <Text
                                        style={{
                                          fontSize: 12,
                                          fontWeight: '700',
                                          color: isPetSelected ? '#fff' : COLORS.text,
                                        }}
                                      >
                                        {pet.name} ({formatSpeciesLabel(pet.species)})
                                      </Text>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            </>
                          )}
                        </View>
                      )}

                      <Field
                        label="Tên người dùng (Khách hàng) *"
                        value={walkInCustomerName}
                        onChangeText={setWalkInCustomerName}
                        placeholder="Nhập họ tên khách hàng..."
                      />

                      <Text style={styles.fieldLabel}>Loài thú cưng *</Text>
                      <View style={styles.speciesSelectorRow}>
                        {SPECIES_OPTIONS.map((opt) => {
                          const active = walkInSpecies === opt.value;
                          return (
                            <TouchableOpacity
                              key={opt.value}
                              style={[styles.speciesOptionBtn, active && styles.speciesOptionBtnActive]}
                              onPress={() => setWalkInSpecies(opt.value)}
                              activeOpacity={0.8}
                            >
                              <FontAwesome5
                                name={opt.icon}
                                size={15}
                                color={active ? '#fff' : COLORS.textSecondary}
                              />
                              <Text
                                style={[
                                  styles.speciesOptionText,
                                  active && styles.speciesOptionTextActive,
                                ]}
                              >
                                {opt.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Chọn thuốc từ kho dược */}
                    <Text style={styles.fieldLabel}>
                      Chọn thuốc từ kho dược ({walkInSelectedItems.length} loại đã chọn) *
                    </Text>
                    <View style={styles.searchInputWrap}>
                      <Ionicons name="search-outline" size={16} color={COLORS.textSecondary} />
                      <TextInput
                        value={medicineSearch}
                        onChangeText={setMedicineSearch}
                        placeholder="Tìm kiếm tên thuốc trong kho..."
                        placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
                        style={styles.searchInput}
                      />
                    </View>

                    <View style={styles.medicineChecklistWrap}>
                      {filteredCatalogMedicines.map((med) => {
                        const selectedItem = walkInSelectedItems.find(
                          (it) => it.medicine_id === Number(med.id)
                        );
                        const isChecked = Boolean(selectedItem);
                        const lineTotal = isChecked
                          ? Number(med.price || 0) * Math.max(0, Number(selectedItem.quantity) || 0)
                          : Number(med.price || 0);

                        return (
                          <View
                            key={med.id}
                            style={[
                              styles.medicineCheckCard,
                              isChecked && styles.medicineCheckCardActive,
                            ]}
                          >
                            <TouchableOpacity
                              style={styles.medicineCheckTopRow}
                              onPress={() => toggleWalkInMedicine(med)}
                              activeOpacity={0.75}
                            >
                              <View
                                style={[
                                  styles.checkboxSquare,
                                  isChecked && styles.checkboxSquareChecked,
                                ]}
                              >
                                {isChecked && <Ionicons name="checkmark" size={15} color="#fff" />}
                              </View>

                              <View style={{ flex: 1, marginRight: 8 }}>
                                <Text
                                  style={[
                                    styles.medicineCheckName,
                                    isChecked && styles.medicineCheckNameActive,
                                  ]}
                                >
                                  {med.name}
                                </Text>
                                <Text style={styles.medicineUnitPriceText}>
                                  Đơn giá: {Number(med.price || 0).toLocaleString('vi-VN')} đ /{' '}
                                  {med.unit || 'viên'} · Tồn kho: {med.stock_quantity}
                                </Text>
                              </View>

                              <Text
                                style={[
                                  styles.medicineLineTotalText,
                                  isChecked && styles.medicineLineTotalTextActive,
                                ]}
                              >
                                {lineTotal.toLocaleString('vi-VN')} đ
                              </Text>
                            </TouchableOpacity>

                            {isChecked && selectedItem && (
                              <View style={styles.qtyAdjustRow}>
                                <Text style={styles.qtyAdjustLabel}>
                                  Số lượng mua ({med.unit || 'viên'}):
                                </Text>
                                <View style={styles.qtyStepper}>
                                  <TouchableOpacity
                                    style={styles.qtyStepBtn}
                                    onPress={() => changeWalkInMedicineQty(Number(med.id), -1)}
                                  >
                                    <Ionicons name="remove" size={16} color={COLORS.text} />
                                  </TouchableOpacity>
                                  <TextInput
                                    value={String(selectedItem.quantity)}
                                    onChangeText={(val) =>
                                      changeWalkInMedicineQty(Number(med.id), val, true)
                                    }
                                    keyboardType="numeric"
                                    style={styles.qtyInput}
                                  />
                                  <TouchableOpacity
                                    style={styles.qtyStepBtn}
                                    onPress={() => changeWalkInMedicineQty(Number(med.id), 1)}
                                  >
                                    <Ionicons name="add" size={16} color={COLORS.text} />
                                  </TouchableOpacity>
                                </View>
                              </View>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}

                <Field
                  label="Ghi chú hóa đơn (không bắt buộc)"
                  value={invoiceNotes}
                  onChangeText={setInvoiceNotes}
                  placeholder="VD: Khách bỏ 1 loại thuốc, chuyển khoản QR tại quầy..."
                />

                {/* TỔNG TIỀN TẠM TÍNH */}
                <View style={styles.invoiceTotalPreviewBox}>
                  <View>
                    <Text style={styles.invoiceTotalPreviewLabel}>Tổng số tiền cần thanh toán</Text>
                    <Text style={styles.invoiceTotalPreviewSub}>
                      Đã chọn{' '}
                      {invoiceMode === 'prescription'
                        ? editableOrderItems.filter((i) => i.checked && Number(i.quantity) > 0).length
                        : walkInSelectedItems.filter((i) => Number(i.quantity) > 0).length}{' '}
                      loại thuốc
                    </Text>
                  </View>
                  <Text style={styles.invoiceTotalPreviewValue}>
                    {calculatedPreviewTotal.toLocaleString('vi-VN')} đ
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, invoiceSaving && { opacity: 0.7 }]}
                  onPress={submitPrepareInvoice}
                  disabled={invoiceSaving}
                >
                  {invoiceSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Ionicons name="qr-code-outline" size={19} color="#fff" />
                      <Text style={styles.saveText}>
                        Xác nhận số tiền & Tạo mã QR thanh toán
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* BƯỚC 2: HIỂN THỊ POPUP MÃ QR & THÔNG TIN ĐƠN THUỐC */
              activeInvoiceOrder && (
                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.qrShowcaseCard}>
                    <View style={styles.qrBadgeHeader}>
                      <Ionicons name="shield-checkmark" size={15} color="#0F766E" />
                      <Text style={styles.qrBadgeHeaderText}>QUÉT MÃ QR ĐỂ THANH TOÁN ĐƠN THUỐC</Text>
                    </View>

                    <View style={styles.qrImageFrame}>
                      <Image
                        source={{
                          uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
                            `PETCARE_PHARMACY|MA_DON:${
                              activeInvoiceOrder.order_code || `DH-${activeInvoiceOrder.id}`
                            }|KHACH:${activeInvoiceOrder.customer_name || 'Khach'}|SO_TIEN:${Number(
                              activeInvoiceOrder.total_amount || 0
                            )}VND`
                          )}`,
                        }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                    </View>

                    <Text style={styles.qrBankTitle}>NHÀ THUỐC THÚ Y PETCARE</Text>
                    <Text style={styles.qrAmountBig}>
                      {Number(activeInvoiceOrder.total_amount || 0).toLocaleString('vi-VN')} đ
                    </Text>
                    <View style={styles.qrTransferNotePill}>
                      <Text style={styles.qrTransferNoteText}>
                        Nội dung CK:{' '}
                        <Text style={{ fontWeight: '800' }}>
                          {activeInvoiceOrder.order_code || `DH-${activeInvoiceOrder.id}`}
                        </Text>
                      </Text>
                    </View>
                  </View>

                  <View style={styles.invoiceOrderDetailBox}>
                    <Text style={styles.invoiceOrderSectionTitle}>Thông tin đơn thuốc</Text>
                    <InfoRow
                      label="Mã đơn thuốc"
                      value={activeInvoiceOrder.order_code || `#ĐH-${activeInvoiceOrder.id}`}
                    />
                    <InfoRow
                      label="Loại đơn"
                      value={
                        activeInvoiceOrder.order_type === 'walk_in'
                          ? 'Mua thuốc trực tiếp (Khách vãng lai)'
                          : 'Đơn thuốc theo bác sĩ kê'
                      }
                    />
                    <InfoRow
                      label="Khách hàng"
                      value={
                        activeInvoiceOrder.customer_phone
                          ? `${activeInvoiceOrder.customer_name} (${activeInvoiceOrder.customer_phone})`
                          : activeInvoiceOrder.customer_name || 'Khách vãng lai'
                      }
                    />
                    {activeInvoiceOrder.pet_name ? (
                      <InfoRow
                        label="Thú cưng"
                        value={`${activeInvoiceOrder.pet_name} (${formatSpeciesLabel(
                          activeInvoiceOrder.pet_species
                        )})`}
                      />
                    ) : (
                      <InfoRow
                        label="Loài khám"
                        value={formatSpeciesLabel(activeInvoiceOrder.pet_species)}
                      />
                    )}
                    {activeInvoiceOrder.doctor_name ? (
                      <InfoRow label="Bác sĩ kê đơn" value={activeInvoiceOrder.doctor_name} />
                    ) : null}
                    {activeInvoiceOrder.pharmacist_name ? (
                      <InfoRow label="Dược sĩ phụ trách" value={activeInvoiceOrder.pharmacist_name} />
                    ) : null}
                    <InfoRow
                      label="Thời gian tạo"
                      value={new Date(activeInvoiceOrder.created_at).toLocaleString('vi-VN')}
                    />
                    {activeInvoiceOrder.notes ? (
                      <InfoRow label="Ghi chú" value={activeInvoiceOrder.notes} />
                    ) : null}

                    <View style={styles.invoiceItemsDivider} />
                    <Text style={styles.invoiceOrderSectionTitle}>
                      Chi tiết thuốc thanh toán ({(activeInvoiceOrder.items || []).length})
                    </Text>

                    {(activeInvoiceOrder.items || []).map((item, idx) => (
                      <View key={item.id || idx} style={styles.invoiceBillItemRow}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={styles.invoiceBillItemName}>
                            {idx + 1}. {item.medicine_name}
                          </Text>
                          <Text style={styles.invoiceBillItemSub}>
                            SL: {item.quantity} {item.unit || 'viên'} ×{' '}
                            {Number(item.unit_price || 0).toLocaleString('vi-VN')} đ
                          </Text>
                        </View>
                        <Text style={styles.invoiceBillItemPrice}>
                          {(Number(item.quantity || 0) * Number(item.unit_price || 0)).toLocaleString(
                            'vi-VN'
                          )}{' '}
                          đ
                        </Text>
                      </View>
                    ))}

                    <View style={styles.invoiceBillTotalRow}>
                      <Text style={styles.invoiceBillTotalLabel}>TỔNG THANH TOÁN</Text>
                      <Text style={styles.invoiceBillTotalValue}>
                        {Number(activeInvoiceOrder.total_amount || 0).toLocaleString('vi-VN')} đ
                      </Text>
                    </View>
                  </View>

                  {/* Chỉ hiển thị nút khi đơn vẫn đang chờ thanh toán (pending) */}
                  {activeInvoiceOrder.status === 'pending' && (
                    <View style={styles.qrFooterButtonRow}>
                      {invoiceMode === 'prescription' && targetOrder && (
                        <TouchableOpacity
                          style={styles.qrSecondaryBtn}
                          onPress={() => setInvoiceStep('select_medicines')}
                          disabled={invoiceSaving}
                        >
                          <Ionicons name="options-outline" size={17} color={COLORS.primaryDark} />
                          <Text style={styles.qrSecondaryBtnText}>Điều chỉnh lại thuốc</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.qrPrimaryDoneBtn, invoiceSaving && { opacity: 0.7 }]}
                        onPress={completeOrderPayment}
                        disabled={invoiceSaving}
                      >
                        {invoiceSaving ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                            <Text style={styles.qrPrimaryDoneBtnText}>Hoàn tất & Đóng</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  )}
                </ScrollView>
              )
            )}
          </View>
        </View>
      </Modal>
    </ResponsiveContainer>
  );
}

function InfoRow({ label, value }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoRowLabel}>{label}</Text>
      <Text style={styles.infoRowValue}>{value}</Text>
    </View>
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
        style={[styles.input, multiline && { minHeight: 70, textAlignVertical: 'top' }]}
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
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
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
  createWalkInInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginTop: 4,
    ...SHADOWS.sm,
  },
  createWalkInInvoiceBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  filterSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  chipRow: {
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextSelected: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  loader: {
    marginTop: 40,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
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
  orderTypeBadge: {
    backgroundColor: '#CCFBF1',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 20,
  },
  orderTypeBadgeWalkIn: {
    backgroundColor: '#E0F2FE',
  },
  orderTypeBadgeText: {
    color: '#0F766E',
    fontSize: 11,
    fontWeight: '800',
  },
  orderTypeBadgeTextWalkIn: {
    color: '#0369A1',
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
    marginBottom: 12,
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
  itemsPreviewBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    gap: 4,
  },
  itemsPreviewTitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  itemsPreviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemsPreviewName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '600',
  },
  itemsPreviewMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  amountBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: 10,
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
    backgroundColor: COLORS.primary,
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
  // Modal styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '92%',
  },
  modalCentered: {
    width: 640,
    alignSelf: 'center',
    marginBottom: 24,
    borderRadius: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: {
    paddingBottom: 12,
  },
  invoiceSummaryCard: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  invoiceTypeTagPrescription: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#CCFBF1',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  invoiceTypeTagPrescriptionText: {
    color: '#0F766E',
    fontWeight: '800',
    fontSize: 12,
  },
  invoiceTypeTagWalkIn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#E0F2FE',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  invoiceTypeTagWalkInText: {
    color: '#0369A1',
    fontWeight: '800',
    fontSize: 12,
  },
  orderCodeTag: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  walkInFormBox: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  fieldLabel: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.text,
  },
  speciesSelectorRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  speciesOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  speciesOptionBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  speciesOptionText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  speciesOptionTextActive: {
    color: '#fff',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  resetPrescribedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  resetPrescribedBtnText: {
    color: COLORS.primaryDark,
    fontWeight: '700',
    fontSize: 12,
  },
  searchInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  medicineChecklistWrap: {
    gap: 10,
    marginBottom: 16,
  },
  medicineCheckCard: {
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
    padding: 12,
  },
  medicineCheckCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDFA',
  },
  medicineCheckTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkboxSquare: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94A3B8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSquareChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  medicineCheckName: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 14,
  },
  medicineCheckNameActive: {
    color: COLORS.primaryDark,
    fontWeight: '800',
  },
  prescribedDefaultTag: {
    backgroundColor: '#FEF3C7',
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 6,
  },
  prescribedDefaultTagText: {
    color: '#B45309',
    fontSize: 10,
    fontWeight: '800',
  },
  medicineDosageText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  medicineUnitPriceText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  medicineLineTotalText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 13,
  },
  medicineLineTotalTextActive: {
    color: COLORS.primary,
    fontWeight: '800',
    fontSize: 14,
  },
  qtyAdjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#CCFBF1',
  },
  qtyAdjustLabel: {
    color: COLORS.primaryDark,
    fontSize: 12,
    fontWeight: '700',
  },
  qtyStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qtyStepBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyInput: {
    width: 54,
    height: 30,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlign: 'center',
    fontWeight: '800',
    fontSize: 13,
    color: COLORS.text,
  },
  invoiceTotalPreviewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F0FDFA',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 14,
    padding: 14,
    marginTop: 4,
    marginBottom: 14,
  },
  invoiceTotalPreviewLabel: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
  },
  invoiceTotalPreviewSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  invoiceTotalPreviewValue: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 20,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
  // QR View styles
  qrShowcaseCard: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#BAE6FD',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  qrBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CCFBF1',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginBottom: 12,
  },
  qrBadgeHeaderText: {
    color: '#0F766E',
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 0.6,
  },
  qrImageFrame: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  qrImage: {
    width: 210,
    height: 210,
  },
  qrBankTitle: {
    color: COLORS.textSecondary,
    fontWeight: '800',
    fontSize: 12,
    marginTop: 12,
    letterSpacing: 0.5,
  },
  qrAmountBig: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 24,
    marginTop: 4,
  },
  qrTransferNotePill: {
    backgroundColor: '#E0F2FE',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  qrTransferNoteText: {
    color: '#0369A1',
    fontSize: 12,
    fontWeight: '600',
  },
  invoiceOrderDetailBox: {
    backgroundColor: COLORS.background,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  invoiceOrderSectionTitle: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoRowLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  infoRowValue: {
    flex: 1,
    textAlign: 'right',
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  invoiceItemsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 6,
  },
  invoiceBillItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  invoiceBillItemName: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '700',
  },
  invoiceBillItemSub: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  invoiceBillItemPrice: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: '800',
  },
  invoiceBillTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    marginTop: 4,
  },
  invoiceBillTotalLabel: {
    color: COLORS.text,
    fontWeight: '800',
    fontSize: 14,
  },
  invoiceBillTotalValue: {
    color: COLORS.primary,
    fontWeight: '900',
    fontSize: 18,
  },
  qrFooterButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  qrSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  qrSecondaryBtnText: {
    color: COLORS.primaryDark,
    fontWeight: '800',
    fontSize: 13,
  },
  qrPrimaryDoneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingVertical: 13,
    borderRadius: 12,
  },
  qrPrimaryDoneBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
