import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import DateTimeFilterBar, { getTodayStr, matchesDateTimeFilter } from '../../components/DateTimeFilterBar';
import { useResponsive } from '../../utils/responsive';
import { getAllAppointmentsApi } from '../../api/appointmentApi';
import {
  getMyRoomServicesApi,
  getInvoicesApi,
  getInvoiceByAppointmentApi,
  createOrUpdateAppointmentInvoiceApi,
  createWalkInInvoiceApi,
  confirmInvoicePaymentApi,
  lookupCustomerByPhoneApi,
} from '../../api/invoiceApi';

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

export default function CashierScreen({ route }) {
  const { isTabletOrDesktop } = useResponsive();
  const paidOnly = route?.params?.mode === 'paid';
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedTime, setSelectedTime] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [walkInInvoices, setWalkInInvoices] = useState([]);
  const [allRooms, setAllRooms] = useState([]);
  const [allServices, setAllServices] = useState([]);
  const [serviceRoomFilter, setServiceRoomFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modal Tạo / Điều chỉnh Hóa đơn & QR Code
  const [invoiceModalVisible, setInvoiceModalVisible] = useState(false);
  const [invoiceMode, setInvoiceMode] = useState('appointment'); // 'appointment' | 'walk_in'
  const [invoiceStep, setInvoiceStep] = useState('qr_view'); // 'select_services' | 'qr_view'
  const [invoiceTargetAppointment, setInvoiceTargetAppointment] = useState(null);
  const [bookedServiceIds, setBookedServiceIds] = useState([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState([]);
  const [walkInCustomerName, setWalkInCustomerName] = useState('');
  const [walkInPhoneSearch, setWalkInPhoneSearch] = useState('');
  const [walkInPhoneSearching, setWalkInPhoneSearching] = useState(false);
  const [walkInMatchedUser, setWalkInMatchedUser] = useState(null);
  const [walkInMatchedPets, setWalkInMatchedPets] = useState([]);
  const [walkInSelectedPetId, setWalkInSelectedPetId] = useState(null);
  const [walkInSpecies, setWalkInSpecies] = useState('dog');
  const [invoiceNotes, setInvoiceNotes] = useState('');
  const [createdInvoice, setCreatedInvoice] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceSaving, setInvoiceSaving] = useState(false);

  const loadServicesCatalog = async () => {
    try {
      const res = await getMyRoomServicesApi();
      if (res.data?.success && res.data.data) {
        setAllRooms(res.data.data.rooms || []);
        setAllServices(res.data.data.services || []);
      }
    } catch (e) {
      // ignore
    }
  };

  const loadCashierData = async () => {
    try {
      setLoading(true);
      const [appRes, walkInRes] = await Promise.all([
        getAllAppointmentsApi({ status: 'completed' }),
        getInvoicesApi({ invoice_type: 'walk_in' }),
      ]);
      setAppointments(appRes.data?.success ? appRes.data.data || [] : []);
      setWalkInInvoices(walkInRes.data?.success ? walkInRes.data.data || [] : []);
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tải dữ liệu thu ngân');
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadCashierData();
      loadServicesCatalog();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadCashierData(), loadServicesCatalog()]);
    setRefreshing(false);
  };

  // Thống kê nhanh
  const stats = useMemo(() => {
    const pendingApps = appointments.filter(
      (a) => !a.invoice_id || a.invoice_payment_status === 'pending'
    ).length;
    const pendingWalkIns = walkInInvoices.filter((i) => i.payment_status === 'pending').length;

    const paidApps = appointments.filter(
      (a) => a.invoice_id && a.invoice_payment_status !== 'pending'
    );
    const paidWalkIns = walkInInvoices.filter((i) => i.payment_status !== 'pending');

    const totalRevenue =
      paidApps.reduce((sum, a) => sum + Number(a.invoice_total || a.price || 0), 0) +
      paidWalkIns.reduce((sum, i) => sum + Number(i.total_amount || 0), 0);

    return {
      pendingCount: pendingApps + pendingWalkIns,
      paidCount: paidApps.length + paidWalkIns.length,
      totalRevenue,
    };
  }, [appointments, walkInInvoices]);

  // Danh sách hiển thị hợp nhất theo tab (Chờ thanh toán / Đã thanh toán), bộ lọc ngày/giờ và từ khóa tìm kiếm
  const filteredEntries = useMemo(() => {
    const appEntries = appointments.map((a) => {
      const isPaid = Boolean(a.invoice_id && a.invoice_payment_status !== 'pending');
      const paidTime = a.invoice_paid_at || a.invoice_updated_at || a.appointment_datetime;
      return {
        entryKey: `app_${a.id}`,
        entryType: 'appointment',
        isPaid,
        paidTime,
        sortTime: new Date(isPaid ? paidTime : a.appointment_datetime).getTime(),
        appointment: a,
      };
    });

    const walkInEntries = walkInInvoices.map((inv) => {
      const isPaid = inv.payment_status !== 'pending';
      const paidTime = inv.paid_at || inv.updated_at || inv.created_at;
      return {
        entryKey: `walkin_${inv.id}`,
        entryType: 'walk_in',
        isPaid,
        paidTime,
        sortTime: new Date(isPaid ? paidTime : inv.created_at).getTime(),
        invoice: inv,
      };
    });

    let combined = [...appEntries, ...walkInEntries].filter((e) =>
      paidOnly ? e.isPaid : !e.isPaid
    );

    if (paidOnly) {
      combined = combined.filter((e) =>
        matchesDateTimeFilter(e.paidTime, selectedDate, selectedTime)
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      combined = combined.filter((e) => {
        if (e.entryType === 'appointment') {
          const a = e.appointment;
          return (
            a.pet_name?.toLowerCase().includes(q) ||
            a.customer_info?.toLowerCase().includes(q) ||
            a.service_name?.toLowerCase().includes(q) ||
            a.invoice_code?.toLowerCase().includes(q) ||
            a.room_name?.toLowerCase().includes(q)
          );
        }
        const inv = e.invoice;
        return (
          inv.customer_name?.toLowerCase().includes(q) ||
          inv.customer_phone?.toLowerCase().includes(q) ||
          inv.pet_name?.toLowerCase().includes(q) ||
          inv.invoice_code?.toLowerCase().includes(q)
        );
      });
    }

    return combined.sort((x, y) => y.sortTime - x.sortTime);
  }, [appointments, walkInInvoices, paidOnly, selectedDate, selectedTime, searchQuery]);

  const invoiceCalculatedTotal = useMemo(() => {
    return allServices
      .filter((s) => selectedServiceIds.includes(Number(s.id)))
      .reduce((sum, s) => sum + Number(s.price || 0), 0);
  }, [allServices, selectedServiceIds]);

  const displayedServicesForModal = useMemo(() => {
    if (serviceRoomFilter === 'all') return allServices;
    return allServices.filter((s) => Number(s.room_id) === Number(serviceRoomFilter));
  }, [allServices, serviceRoomFilter]);

  const toggleInvoiceService = (serviceId) => {
    const numId = Number(serviceId);
    setSelectedServiceIds((prev) =>
      prev.includes(numId) ? prev.filter((id) => id !== numId) : [...prev, numId]
    );
  };

  /**
   * Mở thanh toán cho ca khám đặt lịch:
   * - Dịch vụ đã được Bác sĩ chỉ định / tự động đồng bộ sẵn -> mở thẳng Mã QR (startAtQr = true)
   * - Hoặc mở màn hình Điều chỉnh dịch vụ nếu Thu ngân bấm "Điều chỉnh dịch vụ"
   */
  const openAppointmentPaymentModal = async (appointment, startAtQr = true) => {
    if (!appointment) return;
    setInvoiceMode('appointment');
    setInvoiceTargetAppointment(appointment);
    const defaultIds =
      Array.isArray(appointment.service_ids) && appointment.service_ids.length > 0
        ? appointment.service_ids.map(Number)
        : appointment.service_id
        ? [Number(appointment.service_id)]
        : [];
    setBookedServiceIds(defaultIds);
    setSelectedServiceIds(defaultIds);
    setServiceRoomFilter('all');
    setInvoiceNotes('');
    setCreatedInvoice(null);
    setInvoiceStep(startAtQr ? 'qr_view' : 'select_services');
    setInvoiceModalVisible(true);

    try {
      setInvoiceLoading(true);
      if (allServices.length === 0) {
        await loadServicesCatalog();
      }
      if (appointment.invoice_id) {
        const invRes = await getInvoiceByAppointmentApi(appointment.id);
        if (invRes.data?.success && invRes.data.data) {
          const inv = invRes.data.data;
          setCreatedInvoice(inv);
          setInvoiceNotes(inv.notes || '');
          if (Array.isArray(inv.items) && inv.items.length > 0) {
            setSelectedServiceIds(inv.items.map((it) => Number(it.service_id)));
          }
          setInvoiceStep(startAtQr ? 'qr_view' : 'select_services');
          return;
        }
      }

      // Nếu ca khám chưa có bản ghi hóa đơn nhưng đã có dịch vụ -> tự động khởi tạo hóa đơn chờ để lấy mã QR ngay!
      if (startAtQr && defaultIds.length > 0) {
        const createRes = await createOrUpdateAppointmentInvoiceApi({
          appointment_id: appointment.id,
          service_ids: defaultIds,
        });
        if (createRes.data?.success && createRes.data.data) {
          setCreatedInvoice(createRes.data.data);
          setInvoiceStep('qr_view');
          await loadCashierData();
          return;
        }
      }

      setInvoiceStep('select_services');
    } catch (e) {
      setInvoiceStep('select_services');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const openWalkInInvoiceModal = async () => {
    setInvoiceMode('walk_in');
    setInvoiceTargetAppointment(null);
    setWalkInCustomerName('');
    setWalkInPhoneSearch('');
    setWalkInMatchedUser(null);
    setWalkInMatchedPets([]);
    setWalkInSelectedPetId(null);
    setWalkInSpecies('dog');
    setBookedServiceIds([]);
    setSelectedServiceIds([]);
    setServiceRoomFilter('all');
    setInvoiceNotes('');
    setCreatedInvoice(null);
    setInvoiceStep('select_services');
    setInvoiceModalVisible(true);
    if (allServices.length === 0) {
      await loadServicesCatalog();
    }
  };

  const openExistingWalkInInvoice = (invoice) => {
    setInvoiceMode('walk_in');
    setInvoiceTargetAppointment(null);
    setCreatedInvoice(invoice);
    setInvoiceStep('qr_view');
    setInvoiceModalVisible(true);
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

  const submitInvoice = async () => {
    if (invoiceMode === 'walk_in' && !walkInCustomerName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên người dùng (khách hàng).');
      return;
    }
    if (selectedServiceIds.length === 0) {
      Alert.alert('Thiếu thông tin', 'Vui lòng chọn ít nhất 1 dịch vụ đã thực hiện để tính tiền.');
      return;
    }
    try {
      setInvoiceSaving(true);
      if (invoiceMode === 'appointment' && invoiceTargetAppointment) {
        const res = await createOrUpdateAppointmentInvoiceApi({
          appointment_id: invoiceTargetAppointment.id,
          service_ids: selectedServiceIds,
          notes: invoiceNotes.trim() || undefined,
        });
        if (res.data?.success) {
          setCreatedInvoice(res.data.data);
          setInvoiceStep('qr_view');
          await loadCashierData();
        }
      } else {
        const selectedPetObj = walkInMatchedPets.find(
          (p) => Number(p.id) === Number(walkInSelectedPetId)
        );
        const res = await createWalkInInvoiceApi({
          customer_name: walkInCustomerName.trim(),
          customer_phone: walkInMatchedUser?.phone || walkInPhoneSearch.trim() || undefined,
          user_id: walkInMatchedUser?.id || undefined,
          pet_id: selectedPetObj?.id || undefined,
          pet_name: selectedPetObj?.name || undefined,
          pet_species: selectedPetObj?.species || walkInSpecies,
          service_ids: selectedServiceIds,
          notes: invoiceNotes.trim() || undefined,
        });
        if (res.data?.success) {
          setCreatedInvoice(res.data.data);
          setInvoiceStep('qr_view');
          await loadCashierData();
        }
      }
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể tạo/cập nhật hóa đơn thanh toán');
    } finally {
      setInvoiceSaving(false);
    }
  };

  const completeInvoicePayment = async () => {
    if (!createdInvoice?.id) {
      setInvoiceModalVisible(false);
      return;
    }
    try {
      setInvoiceSaving(true);
      const res = await confirmInvoicePaymentApi(createdInvoice.id);
      if (res.data?.success) {
        setCreatedInvoice(res.data.data);
        await loadCashierData();
        setInvoiceModalVisible(false);
        Alert.alert('Thanh toán thành công', `Đã xác nhận thu tiền hóa đơn ${createdInvoice.invoice_code}.`);
      }
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể xác nhận thanh toán hóa đơn');
    } finally {
      setInvoiceSaving(false);
    }
  };

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* HEADER THU NGÂN */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>
                {paidOnly ? 'LỊCH SỬ THU NGÂN' : 'QUẦY THU NGÂN VIỆN PHÍ'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <Text style={styles.title}>
                  {paidOnly ? 'Hóa đơn Đã Thanh toán' : 'Hóa đơn Chờ Thanh toán'}
                </Text>
                <Ionicons
                  name={paidOnly ? 'checkmark-done-circle-outline' : 'cash-outline'}
                  size={22}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.subtitle}>
                {paidOnly
                  ? 'Danh sách các hóa đơn đã thu tiền thành công · Hỗ trợ lọc theo ngày và giờ thanh toán.'
                  : 'Thanh toán 1 lần cho tất cả dịch vụ khám của các phòng · Tự động đồng bộ dịch vụ từ Bác sĩ.'}
              </Text>
            </View>

            {!paidOnly && (
              <TouchableOpacity
                style={styles.createWalkInInvoiceBtn}
                onPress={openWalkInInvoiceModal}
                activeOpacity={0.85}
              >
                <Ionicons name="qr-code-outline" size={18} color="#fff" />
                <Text style={styles.createWalkInInvoiceBtnText}>+ Tạo hóa đơn vãng lai</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* THỐNG KÊ NHANH */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <Ionicons name="time-outline" size={22} color={COLORS.warning} />
              <Text style={[styles.statValue, { color: COLORS.warning }]}>{stats.pendingCount}</Text>
            </View>
            <Text style={styles.statLabel}>Đơn chờ thanh toán</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <Ionicons name="checkmark-done-circle-outline" size={22} color={COLORS.success} />
              <Text style={[styles.statValue, { color: COLORS.success }]}>{stats.paidCount}</Text>
            </View>
            <Text style={styles.statLabel}>Đơn đã thu tiền</Text>
          </View>

          <View style={styles.statCard}>
            <View style={styles.statTop}>
              <Ionicons name="wallet-outline" size={22} color={COLORS.primary} />
              <Text style={[styles.statValue, { color: COLORS.primary, fontSize: 18 }]}>
                {stats.totalRevenue.toLocaleString('vi-VN')} đ
              </Text>
            </View>
            <Text style={styles.statLabel}>Tổng viện phí đã thu</Text>
          </View>
        </View>

        {/* TÌM KIẾM & BỘ LỌC NGÀY GIỜ (Ở TAB ĐÃ THANH TOÁN) */}
        <View style={styles.filterSection}>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Tìm theo tên khách, SĐT, tên thú cưng, mã hóa đơn..."
              placeholderTextColor={COLORS.textTertiary || '#94A3B8'}
              style={styles.searchInput}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {paidOnly && (
            <DateTimeFilterBar
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              selectedTime={selectedTime}
              onTimeChange={setSelectedTime}
              showTimeFilter={true}
              allowAllDates={true}
              dateLabel="Ngày thanh toán:"
              timeLabel="Giờ thanh toán:"
              style={{ marginTop: 6 }}
            />
          )}
        </View>

        {/* DANH SÁCH HÓA ĐƠN / CA KHÁM */}
        {loading ? (
          <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
        ) : filteredEntries.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="receipt-outline" size={42} color="#94A3B8" style={{ marginBottom: 10 }} />
            <Text style={styles.emptyText}>
              Không có hóa đơn hoặc ca khám nào trong mục này.
            </Text>
          </View>
        ) : (
          <View style={[styles.grid, isTabletOrDesktop && styles.gridDesktop]}>
            {filteredEntries.map((entry) => {
              if (entry.entryType === 'appointment') {
                const appointment = entry.appointment;
                const isPaid = entry.isPaid;
                const totalAmount = Number(
                  appointment.invoice_id ? appointment.invoice_total : appointment.price || 0
                );
                const depositAmount = Number(
                  appointment.invoice_deposit_amount || appointment.deposit_amount || 0
                );
                const remainingAmount = Math.max(0, totalAmount - depositAmount);
                const dateObj = new Date(appointment.appointment_datetime);

                return (
                  <TouchableOpacity
                    key={entry.entryKey}
                    style={[styles.card, isTabletOrDesktop && styles.cardDesktop]}
                    onPress={() => openAppointmentPaymentModal(appointment, true)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.cardHeader}>
                      <View style={styles.codeBadge}>
                        <Text style={styles.codeBadgeText}>
                          {appointment.invoice_code || `CA KHÁM #${appointment.id}`}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {depositAmount > 0 && (
                          <View
                            style={{
                              backgroundColor: '#FEF3C7',
                              borderWidth: 1,
                              borderColor: '#FDE68A',
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 999,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#B45309' }}>
                              Đã cọc 50%: {depositAmount.toLocaleString('vi-VN')}đ
                            </Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.paymentStatusBadge,
                            isPaid ? styles.paymentStatusPaid : styles.paymentStatusPending,
                          ]}
                        >
                          <Ionicons
                            name={isPaid ? 'checkmark-circle' : 'qr-code-outline'}
                            size={13}
                            color={isPaid ? '#16A34A' : '#D97706'}
                          />
                          <Text
                            style={[
                              styles.paymentStatusText,
                              { color: isPaid ? '#16A34A' : '#D97706' },
                            ]}
                          >
                            {isPaid ? 'Đã thanh toán' : 'Chờ thanh toán'}
                          </Text>
                        </View>
                        {String(appointment.notes || '').includes('[Khách vãng lai]') ? (
                          <View style={styles.typeBadgeWalkIn}>
                            <Text style={styles.typeBadgeWalkInText}>Khách vãng lai</Text>
                          </View>
                        ) : (
                          <View style={styles.typeBadgeAppointment}>
                            <Text style={styles.typeBadgeAppointmentText}>Đặt lịch</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.petRow}>
                      <View style={styles.petAvatar}>
                        <FontAwesome5
                          name={getSpeciesIconName(appointment.species)}
                          size={18}
                          color={COLORS.primaryDark}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.petName}>{appointment.pet_name}</Text>
                        <Text style={styles.customerSub}>
                          Chủ nuôi: {appointment.customer_info}
                        </Text>
                      </View>
                      <View style={styles.amountPill}>
                        <Text style={styles.amountLabel}>
                          {!isPaid && depositAmount > 0 ? 'Còn phải thu' : 'Tổng thanh toán'}
                        </Text>
                        <Text style={styles.amountValue}>
                          {(!isPaid && depositAmount > 0 ? remainingAmount : totalAmount).toLocaleString('vi-VN')} đ
                        </Text>
                        {depositAmount > 0 && (
                          <Text style={{ fontSize: 10.5, color: '#B45309', fontWeight: '700', marginTop: 2 }}>
                            Tổng: {totalAmount.toLocaleString('vi-VN')}đ (Cọc: -{depositAmount.toLocaleString('vi-VN')}đ)
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.detailsBox}>
                      <View style={styles.detailRow}>
                        <FontAwesome5 name="stethoscope" size={12} color={COLORS.primary} />
                        <Text style={styles.detailText} numberOfLines={2}>
                          Dịch vụ tự động gộp: {appointment.service_name || 'Khám tổng quát'}
                        </Text>
                      </View>
                      <View style={styles.detailRow}>
                        <Ionicons name="business-outline" size={13} color={COLORS.textSecondary} />
                        <Text style={styles.detailSubText}>
                          Phòng tiếp nhận: {appointment.room_code} - {appointment.room_name} ·{' '}
                          {dateObj.toLocaleString('vi-VN')}
                        </Text>
                      </View>
                      {isPaid && entry.paidTime && (
                        <View style={styles.detailRow}>
                          <Ionicons name="checkmark-done-circle-outline" size={14} color="#16A34A" />
                          <Text style={[styles.detailSubText, { color: '#15803D', fontWeight: '700' }]}>
                            Thời gian thanh toán: {new Date(entry.paidTime).toLocaleString('vi-VN')}
                          </Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.cardFooter}>
                      {!isPaid ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            style={styles.payNowBtn}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              openAppointmentPaymentModal(appointment, true);
                            }}
                          >
                            <Ionicons name="qr-code-outline" size={15} color="#fff" />
                            <Text style={styles.payNowBtnText}>Xuất Mã QR & Thu tiền</Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.adjustServiceBtn}
                            onPress={(e) => {
                              e?.stopPropagation?.();
                              openAppointmentPaymentModal(appointment, false);
                            }}
                          >
                            <Ionicons name="options-outline" size={15} color={COLORS.primaryDark} />
                            <Text style={styles.adjustServiceBtnText}>Điều chỉnh DV</Text>
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <View />
                      )}
                      <Text style={styles.cardHint}>
                        {isPaid ? 'Xem hóa đơn →' : 'Mở QR →'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }

              // Đơn khách vãng lai
              const inv = entry.invoice;
              const isPaid = entry.isPaid;
              return (
                <TouchableOpacity
                  key={entry.entryKey}
                  style={[styles.card, isTabletOrDesktop && styles.cardDesktop]}
                  onPress={() => openExistingWalkInInvoice(inv)}
                  activeOpacity={0.85}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.codeBadge}>
                      <Text style={styles.codeBadgeText}>{inv.invoice_code}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <View
                        style={[
                          styles.paymentStatusBadge,
                          isPaid ? styles.paymentStatusPaid : styles.paymentStatusPending,
                        ]}
                      >
                        <Ionicons
                          name={isPaid ? 'checkmark-circle' : 'qr-code-outline'}
                          size={13}
                          color={isPaid ? '#16A34A' : '#D97706'}
                        />
                        <Text
                          style={[
                            styles.paymentStatusText,
                            { color: isPaid ? '#16A34A' : '#D97706' },
                          ]}
                        >
                          {isPaid ? 'Đã thanh toán' : 'Chờ thanh toán'}
                        </Text>
                      </View>
                      <View style={styles.typeBadgeWalkIn}>
                        <Text style={styles.typeBadgeWalkInText}>Khách vãng lai</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.petRow}>
                    <View style={[styles.petAvatar, { backgroundColor: '#E0F2FE' }]}>
                      <FontAwesome5
                        name={getSpeciesIconName(inv.pet_species)}
                        size={18}
                        color="#0369A1"
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.petName}>
                        {inv.customer_name}
                        {inv.customer_phone ? ` (${inv.customer_phone})` : ''}
                      </Text>
                      <Text style={styles.customerSub}>
                        {inv.pet_name
                          ? `Thú cưng: ${inv.pet_name} (${formatSpeciesLabel(inv.pet_species)})`
                          : `Loài khám: ${formatSpeciesLabel(inv.pet_species)}`}
                      </Text>
                    </View>
                    <View style={styles.amountPill}>
                      <Text style={styles.amountLabel}>Tổng thanh toán</Text>
                      <Text style={styles.amountValue}>
                        {Number(inv.total_amount || 0).toLocaleString('vi-VN')} đ
                      </Text>
                    </View>
                  </View>

                  <View style={styles.detailsBox}>
                    <View style={styles.detailRow}>
                      <FontAwesome5 name="hospital" size={12} color={COLORS.primary} />
                      <Text style={styles.detailText} numberOfLines={2}>
                        Dịch vụ: {(inv.items || []).map((i) => i.service_name).join(', ') || 'Khám dịch vụ'}
                      </Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Ionicons name="time-outline" size={13} color={COLORS.textSecondary} />
                      <Text style={styles.detailSubText}>
                        Thời gian lập: {new Date(inv.created_at).toLocaleString('vi-VN')}
                      </Text>
                    </View>
                    {isPaid && entry.paidTime && (
                      <View style={styles.detailRow}>
                        <Ionicons name="checkmark-done-circle-outline" size={14} color="#16A34A" />
                        <Text style={[styles.detailSubText, { color: '#15803D', fontWeight: '700' }]}>
                          Thời gian thanh toán: {new Date(entry.paidTime).toLocaleString('vi-VN')}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.cardFooter}>
                    {!isPaid ? (
                      <TouchableOpacity
                        style={styles.payNowBtn}
                        onPress={(e) => {
                          e?.stopPropagation?.();
                          openExistingWalkInInvoice(inv);
                        }}
                      >
                        <Ionicons name="qr-code-outline" size={15} color="#fff" />
                        <Text style={styles.payNowBtnText}>Xuất Mã QR & Thu tiền</Text>
                      </TouchableOpacity>
                    ) : (
                      <View />
                    )}
                    <Text style={styles.cardHint}>Xem chi tiết đơn →</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* MODAL TẠO / ĐIỀU CHỈNH HÓA ĐƠN & MÃ QR THANH TOÁN */}
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
                      ? 'Hóa Đơn Viện Phí & Mã QR Thanh Toán'
                      : invoiceMode === 'appointment'
                      ? 'Điều chỉnh Dịch vụ Khám (Đa phòng)'
                      : 'Tạo Hóa đơn Vãng lai (Đa phòng)'}
                  </Text>
                </View>
                <Text style={styles.modalSubtitle}>
                  {invoiceStep === 'qr_view'
                    ? `Mã hóa đơn: ${createdInvoice?.invoice_code || ''} · Thanh toán 1 lần cho toàn bộ dịch vụ`
                    : invoiceMode === 'appointment'
                    ? 'Các dịch vụ bác sĩ chỉ định đã được tích sẵn. Thu ngân có thể kiểm tra hoặc điều chỉnh nếu cần.'
                    : 'Tìm theo SĐT khách hàng (nếu đã có tài khoản) hoặc nhập tên khách và chọn dịch vụ của các phòng.'}
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
                  Đang đồng bộ hóa đơn và danh mục dịch vụ...
                </Text>
              </View>
            ) : invoiceStep === 'select_services' ? (
              <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                {invoiceMode === 'appointment' && invoiceTargetAppointment ? (
                  <View style={styles.summaryBox}>
                    <InfoRow label="Khách hàng" value={invoiceTargetAppointment.customer_info} />
                    <InfoRow
                      label="Thú cưng"
                      value={`${invoiceTargetAppointment.pet_name} (${formatSpeciesLabel(
                        invoiceTargetAppointment.species
                      )})`}
                    />
                    <InfoRow
                      label="Dịch vụ Bác sĩ đã chỉ định"
                      value={invoiceTargetAppointment.service_name || 'Chưa có'}
                    />
                  </View>
                ) : (
                  <View style={styles.walkInFormBox}>
                    <Text style={styles.fieldLabel}>
                      Tìm theo Số điện thoại khách hàng (không bắt buộc)
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                      <TextInput
                        value={walkInPhoneSearch}
                        onChangeText={setWalkInPhoneSearch}
                        onSubmitEditing={handleLookupWalkInPhone}
                        placeholder="Nhập SĐT khách đã có tài khoản..."
                        placeholderTextColor="#94A3B8"
                        keyboardType="phone-pad"
                        style={[styles.input, { flex: 1 }]}
                      />
                      <TouchableOpacity
                        style={[styles.lookupBtn, walkInPhoneSearching && { opacity: 0.7 }]}
                        onPress={handleLookupWalkInPhone}
                        disabled={walkInPhoneSearching}
                      >
                        {walkInPhoneSearching ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <>
                            <Ionicons name="search-outline" size={16} color="#fff" />
                            <Text style={styles.lookupBtnText}>Tìm SĐT</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>

                    {walkInMatchedUser && (
                      <View style={styles.matchedAccountBox}>
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
                                    style={[
                                      styles.petSelectChip,
                                      isPetSelected && styles.petSelectChipActive,
                                    ]}
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

                    <Text style={styles.fieldLabel}>Tên người dùng (Khách hàng) *</Text>
                    <TextInput
                      value={walkInCustomerName}
                      onChangeText={setWalkInCustomerName}
                      placeholder="Nhập họ tên khách hàng..."
                      placeholderTextColor="#94A3B8"
                      style={[styles.input, { marginBottom: 12 }]}
                    />

                    <Text style={styles.fieldLabel}>Loài thú cưng khám *</Text>
                    <View style={styles.speciesSelectorRow}>
                      {SPECIES_OPTIONS.map((opt) => {
                        const active = walkInSpecies === opt.value;
                        return (
                          <TouchableOpacity
                            key={opt.value}
                            style={[styles.speciesOptionBtn, active && styles.speciesOptionBtnActive]}
                            onPress={() => setWalkInSpecies(opt.value)}
                          >
                            <FontAwesome5
                              name={opt.icon}
                              size={15}
                              color={active ? '#fff' : COLORS.textSecondary}
                            />
                            <Text style={[styles.speciesOptionText, active && styles.speciesOptionTextActive]}>
                              {opt.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {/* LỌC DỊCH VỤ THEO PHÒNG KHÁM */}
                {allRooms.length > 0 && (
                  <View style={{ marginBottom: 12 }}>
                    <Text style={[styles.fieldLabel, { marginBottom: 8 }]}>
                      Lọc dịch vụ theo phòng khám:
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.chip, serviceRoomFilter === 'all' && styles.chipSelected]}
                        onPress={() => setServiceRoomFilter('all')}
                      >
                        <Text style={serviceRoomFilter === 'all' ? styles.chipTextSelected : styles.chipText}>
                          Tất cả phòng ({allServices.length})
                        </Text>
                      </TouchableOpacity>
                      {allRooms.map((r) => {
                        const active = Number(serviceRoomFilter) === Number(r.id);
                        return (
                          <TouchableOpacity
                            key={r.id}
                            style={[styles.chip, active && styles.chipSelected]}
                            onPress={() => setServiceRoomFilter(r.id)}
                          >
                            <Text style={active ? styles.chipTextSelected : styles.chipText}>
                              {r.room_code} - {r.room_name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                <View style={styles.serviceHeaderRow}>
                  <Text style={styles.fieldLabel}>
                    Chọn các dịch vụ thanh toán ({selectedServiceIds.length} dịch vụ) *
                  </Text>
                  {invoiceMode === 'appointment' && bookedServiceIds.length > 0 && (
                    <TouchableOpacity
                      onPress={() => setSelectedServiceIds([...bookedServiceIds])}
                      style={styles.resetBtn}
                    >
                      <Ionicons name="refresh-outline" size={13} color={COLORS.primaryDark} />
                      <Text style={styles.resetBtnText}>Theo chỉ định Bác sĩ</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.serviceListWrap}>
                  {displayedServicesForModal.map((service) => {
                    const sId = Number(service.id);
                    const isChecked = selectedServiceIds.includes(sId);
                    const wasBooked = bookedServiceIds.includes(sId);

                    return (
                      <TouchableOpacity
                        key={service.id}
                        style={[styles.serviceItem, isChecked && styles.serviceItemActive]}
                        onPress={() => toggleInvoiceService(sId)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                          {isChecked && <Ionicons name="checkmark" size={15} color="#fff" />}
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <Text style={[styles.serviceName, isChecked && styles.serviceNameActive]}>
                              {service.service_name}
                            </Text>
                            {service.room_code ? (
                              <View style={styles.roomBadgeTag}>
                                <Text style={styles.roomBadgeTagText}>
                                  {service.room_code} · {service.room_name}
                                </Text>
                              </View>
                            ) : null}
                            {invoiceMode === 'appointment' && wasBooked && (
                              <View style={styles.assignedBadgeTag}>
                                <Text style={styles.assignedBadgeTagText}>BS chỉ định</Text>
                              </View>
                            )}
                          </View>
                        </View>
                        <Text style={[styles.servicePrice, isChecked && styles.servicePriceActive]}>
                          {Number(service.price || 0).toLocaleString('vi-VN')} đ
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={styles.fieldLabel}>Ghi chú hóa đơn (không bắt buộc)</Text>
                <TextInput
                  value={invoiceNotes}
                  onChangeText={setInvoiceNotes}
                  placeholder="VD: Thanh toán gộp các phòng, khách chuyển khoản QR..."
                  placeholderTextColor="#94A3B8"
                  style={[styles.input, { marginBottom: 14 }]}
                />

                <View style={styles.totalPreviewBox}>
                  <View>
                    <Text style={styles.totalPreviewLabel}>Tổng viện phí cần thu</Text>
                    <Text style={styles.totalPreviewSub}>
                      Gộp {selectedServiceIds.length} dịch vụ thực hiện
                    </Text>
                  </View>
                  <Text style={styles.totalPreviewValue}>
                    {invoiceCalculatedTotal.toLocaleString('vi-VN')} đ
                  </Text>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, invoiceSaving && { opacity: 0.7 }]}
                  onPress={submitInvoice}
                  disabled={invoiceSaving}
                >
                  {invoiceSaving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Ionicons name="qr-code-outline" size={19} color="#fff" />
                      <Text style={styles.saveText}>Xác nhận & Xuất Mã QR Thanh Toán</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </ScrollView>
            ) : (
              createdInvoice && (() => {
                const invoiceTotalAmount = Number(createdInvoice.total_amount || 0);
                const invoiceDepositAmount = Number(
                  createdInvoice.deposit_amount ||
                    invoiceTargetAppointment?.invoice_deposit_amount ||
                    invoiceTargetAppointment?.deposit_amount ||
                    0
                );
                const remainingAmountToPay = Math.max(0, invoiceTotalAmount - invoiceDepositAmount);

                return (
                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  <View style={styles.qrShowcaseCard}>
                    <View style={styles.qrBadgeHeader}>
                      <Ionicons name="shield-checkmark" size={15} color="#0F766E" />
                      <Text style={styles.qrBadgeHeaderText}>
                        {invoiceDepositAmount > 0
                          ? 'QUÉT MÃ QR THANH TOÁN PHẦN CÒN LẠI (ĐÃ TRỪ CỌC 50%)'
                          : 'QUÉT MÃ QR ĐỂ THANH TOÁN VIỆN PHÍ'}
                      </Text>
                    </View>

                    <View style={styles.qrImageFrame}>
                      <Image
                        source={{
                          uri: `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
                            `PETCARE_HOSPITAL|MA_HD:${createdInvoice.invoice_code}|KHACH:${createdInvoice.customer_name}|SO_TIEN:${remainingAmountToPay}VND`
                          )}`,
                        }}
                        style={styles.qrImage}
                        resizeMode="contain"
                      />
                    </View>

                    <Text style={styles.qrBankTitle}>BỆNH VIỆN THÚ Y ĐA KHOA PETCARE</Text>
                    <Text style={styles.qrAmountBig}>
                      {remainingAmountToPay.toLocaleString('vi-VN')} đ
                    </Text>
                    {invoiceDepositAmount > 0 && (
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#B45309', marginBottom: 6 }}>
                        Tổng viện phí: {invoiceTotalAmount.toLocaleString('vi-VN')} đ • Đã đặt cọc 50%: -{invoiceDepositAmount.toLocaleString('vi-VN')} đ
                      </Text>
                    )}
                    <View style={styles.qrTransferNotePill}>
                      <Text style={styles.qrTransferNoteText}>
                        Nội dung CK: <Text style={{ fontWeight: '800' }}>{createdInvoice.invoice_code}</Text>
                      </Text>
                    </View>
                  </View>

                  <View style={styles.invoiceOrderDetailBox}>
                    <Text style={styles.invoiceOrderSectionTitle}>Thông tin hóa đơn</Text>
                    <InfoRow label="Mã hóa đơn" value={createdInvoice.invoice_code} />
                    <InfoRow
                      label="Loại hóa đơn"
                      value={
                        createdInvoice.invoice_type === 'walk_in'
                          ? 'Khám trực tiếp (Vãng lai)'
                          : 'Khám theo lịch hẹn (Tự động đồng bộ)'
                      }
                    />
                    <InfoRow
                      label="Khách hàng"
                      value={
                        createdInvoice.customer_phone
                          ? `${createdInvoice.customer_name} (${createdInvoice.customer_phone})`
                          : createdInvoice.customer_name
                      }
                    />
                    {createdInvoice.pet_name ? (
                      <InfoRow
                        label="Thú cưng"
                        value={`${createdInvoice.pet_name} (${formatSpeciesLabel(createdInvoice.pet_species)})`}
                      />
                    ) : (
                      <InfoRow label="Loài khám" value={formatSpeciesLabel(createdInvoice.pet_species)} />
                    )}
                    <InfoRow
                      label="Trạng thái"
                      value={
                        createdInvoice.payment_status !== 'pending'
                          ? 'Đã thanh toán'
                          : 'Chờ khách quét QR thanh toán'
                      }
                    />
                    {createdInvoice.payment_status !== 'pending' && (
                      <InfoRow
                        label="Thời gian thanh toán"
                        value={new Date(
                          createdInvoice.paid_at || createdInvoice.updated_at || createdInvoice.created_at
                        ).toLocaleString('vi-VN')}
                      />
                    )}

                    <View style={styles.invoiceItemsDivider} />
                    <Text style={styles.invoiceOrderSectionTitle}>
                      Danh mục dịch vụ thanh toán 1 lần ({(createdInvoice.items || []).length})
                    </Text>

                    {(createdInvoice.items || []).map((item, index) => (
                      <View key={item.id || index} style={styles.invoiceBillItemRow}>
                        <Text style={styles.invoiceBillItemName}>
                          {index + 1}. {item.service_name}
                        </Text>
                        <Text style={styles.invoiceBillItemPrice}>
                          {Number(item.unit_price || 0).toLocaleString('vi-VN')} đ
                        </Text>
                      </View>
                    ))}

                    {invoiceDepositAmount > 0 && (
                      <>
                        <View style={[styles.invoiceBillItemRow, { marginTop: 8 }]}>
                          <Text style={[styles.invoiceBillItemName, { fontWeight: '700' }]}>
                            Tổng chi phí dịch vụ
                          </Text>
                          <Text style={styles.invoiceBillItemPrice}>
                            {invoiceTotalAmount.toLocaleString('vi-VN')} đ
                          </Text>
                        </View>
                        <View style={styles.invoiceBillItemRow}>
                          <Text style={[styles.invoiceBillItemName, { color: '#B45309', fontWeight: '700' }]}>
                            Đã đặt cọc trước (50% khi đặt lịch)
                          </Text>
                          <Text style={[styles.invoiceBillItemPrice, { color: '#D97706', fontWeight: '800' }]}>
                            -{invoiceDepositAmount.toLocaleString('vi-VN')} đ
                          </Text>
                        </View>
                      </>
                    )}

                    <View style={styles.invoiceBillTotalRow}>
                      <Text style={styles.invoiceBillTotalLabel}>
                        {invoiceDepositAmount > 0 ? 'CÒN PHẢI THU TẠI QUẦY' : 'TỔNG THANH TOÁN'}
                      </Text>
                      <Text style={styles.invoiceBillTotalValue}>
                        {remainingAmountToPay.toLocaleString('vi-VN')} đ
                      </Text>
                    </View>
                  </View>

                  {createdInvoice.payment_status === 'pending' && (
                    <View style={styles.qrFooterButtonRow}>
                      {invoiceMode === 'appointment' && invoiceTargetAppointment && (
                        <TouchableOpacity
                          style={styles.qrSecondaryBtn}
                          onPress={() => setInvoiceStep('select_services')}
                          disabled={invoiceSaving}
                        >
                          <Ionicons name="options-outline" size={17} color={COLORS.primaryDark} />
                          <Text style={styles.qrSecondaryBtnText}>Điều chỉnh lại dịch vụ</Text>
                        </TouchableOpacity>
                      )}

                      <TouchableOpacity
                        style={[styles.qrPrimaryDoneBtn, invoiceSaving && { opacity: 0.7 }]}
                        onPress={completeInvoicePayment}
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
                );
              })()
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20 },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  createWalkInInvoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    ...SHADOWS.small,
  },
  createWalkInInvoiceBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: COLORS.surface,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  statTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  statValue: { fontSize: 22, fontWeight: '800' },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  filterSection: { marginBottom: 18, gap: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: COLORS.text,
  },
  chipRow: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipText: { fontSize: 12, fontWeight: '700', color: COLORS.textSecondary },
  chipTextSelected: { fontSize: 12, fontWeight: '800', color: '#fff' },
  emptyContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 36,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
  grid: { gap: 14 },
  gridDesktop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  cardDesktop: {
    width: '48.8%',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 6,
  },
  codeBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  codeBadgeText: { fontSize: 12, fontWeight: '800', color: COLORS.text },
  paymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  paymentStatusPending: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FDE68A',
  },
  paymentStatusPaid: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  paymentStatusText: { fontSize: 11, fontWeight: '800' },
  typeBadgeAppointment: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeAppointmentText: { fontSize: 11, fontWeight: '700', color: '#0F766E' },
  typeBadgeWalkIn: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeBadgeWalkInText: { fontSize: 11, fontWeight: '700', color: '#0369A1' },
  petRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  petAvatar: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#CCFBF1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  petName: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  customerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  amountPill: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'flex-end',
  },
  amountLabel: { fontSize: 10, color: COLORS.primaryDark, fontWeight: '700' },
  amountValue: { fontSize: 14, color: COLORS.primaryDark, fontWeight: '900' },
  detailsBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 10,
    gap: 6,
    marginBottom: 12,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 12, fontWeight: '700', color: COLORS.text, flex: 1 },
  detailSubText: { fontSize: 11, color: COLORS.textSecondary, flex: 1 },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  payNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  payNowBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  adjustServiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  adjustServiceBtnText: { color: COLORS.primaryDark, fontSize: 12, fontWeight: '700' },
  cardHint: { fontSize: 12, fontWeight: '700', color: COLORS.primaryDark },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 16,
  },
  modal: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    maxHeight: '90%',
    padding: 20,
    ...SHADOWS.medium,
  },
  modalCentered: {
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '800', color: COLORS.text },
  modalSubtitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScroll: { maxHeight: 540 },
  summaryBox: {
    backgroundColor: '#F0FDFA',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginBottom: 14,
  },
  walkInFormBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: COLORS.text,
  },
  lookupBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 14,
    borderRadius: 10,
    justifyContent: 'center',
  },
  lookupBtnText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  matchedAccountBox: {
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  petSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  petSelectChipActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  speciesSelectorRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  speciesOptionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  speciesOptionBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  speciesOptionText: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  speciesOptionTextActive: { color: '#fff' },
  serviceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  resetBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.primaryDark },
  serviceListWrap: { gap: 8, marginBottom: 14 },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: '#fff',
  },
  serviceItemActive: {
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDFA',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#94A3B8',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  serviceName: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  serviceNameActive: { color: COLORS.primaryDark, fontWeight: '800' },
  roomBadgeTag: {
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roomBadgeTagText: { fontSize: 10, fontWeight: '700', color: '#0369A1' },
  assignedBadgeTag: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  assignedBadgeTagText: { fontSize: 10, fontWeight: '700', color: '#16A34A' },
  servicePrice: { fontSize: 13, fontWeight: '800', color: COLORS.textSecondary },
  servicePriceActive: { color: COLORS.primaryDark },
  totalPreviewBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  totalPreviewLabel: { fontSize: 13, fontWeight: '800', color: COLORS.primaryDark },
  totalPreviewSub: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  totalPreviewValue: { fontSize: 18, fontWeight: '900', color: COLORS.primaryDark },
  saveButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  saveText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  qrShowcaseCard: {
    backgroundColor: '#F0FDFA',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#99F6E4',
    marginBottom: 16,
  },
  qrBadgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: 12,
  },
  qrBadgeHeaderText: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  qrImageFrame: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
  },
  qrImage: { width: 200, height: 200 },
  qrBankTitle: { fontSize: 12, fontWeight: '800', color: COLORS.textSecondary },
  qrAmountBig: { fontSize: 24, fontWeight: '900', color: COLORS.primaryDark, marginVertical: 4 },
  qrTransferNotePill: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  qrTransferNoteText: { fontSize: 12, color: COLORS.text },
  invoiceOrderDetailBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
  },
  invoiceOrderSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primaryDark,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    gap: 10,
  },
  infoRowLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  infoRowValue: { fontSize: 12, color: COLORS.text, fontWeight: '700', flex: 1, textAlign: 'right' },
  invoiceItemsDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 10,
  },
  invoiceBillItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  invoiceBillItemName: { fontSize: 13, color: COLORS.text, fontWeight: '600', flex: 1 },
  invoiceBillItemPrice: { fontSize: 13, color: COLORS.text, fontWeight: '800' },
  invoiceBillTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  invoiceBillTotalLabel: { fontSize: 13, fontWeight: '900', color: COLORS.primaryDark },
  invoiceBillTotalValue: { fontSize: 17, fontWeight: '900', color: COLORS.primaryDark },
  qrFooterButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  qrSecondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: '#F0FDFA',
  },
  qrSecondaryBtnText: { color: COLORS.primaryDark, fontWeight: '800', fontSize: 13 },
  qrPrimaryDoneBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: COLORS.success,
  },
  qrPrimaryDoneBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
