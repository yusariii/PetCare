import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';
import { getProfileApi, updateProfileApi } from '../../api/authApi';

const ROLE_DISPLAY = {
  admin: { label: 'Quản trị viên hệ thống', bg: '#FEF3C7', color: '#B45309' },
  doctor: { label: 'Bác sĩ chuyên khoa', bg: '#E0F2FE', color: '#0369A1' },
  pharmacist: { label: 'Dược sĩ quầy thuốc', bg: '#EDE9FE', color: '#6D28D9' },
  customer: { label: 'Khách hàng thành viên', bg: '#E6FFFA', color: '#0F766E' },
};

const renderRoleIcon = (role) => {
  switch (role) {
    case 'admin':
      return <Ionicons name="shield-checkmark" size={36} color="#B45309" />;
    case 'doctor':
      return <FontAwesome5 name="user-md" size={34} color="#0369A1" />;
    case 'pharmacist':
      return <MaterialCommunityIcons name="pill" size={38} color="#6D28D9" />;
    case 'customer':
      return <FontAwesome5 name="paw" size={32} color="#0F766E" />;
    default:
      return <Ionicons name="person" size={36} color={COLORS.primary} />;
  }
};

export default function ProfileScreen({ onLogout }) {
  const { isTabletOrDesktop } = useResponsive();
  const [user, setUser] = useState(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editFullName, setEditFullName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const loadProfile = async () => {
    try {
      const cached = await AsyncStorage.getItem('user');
      if (cached) {
        setUser(JSON.parse(cached));
      }
      const res = await getProfileApi();
      if (res.data?.success && res.data.data) {
        const freshUser = res.data.data;
        setUser(freshUser);
        await AsyncStorage.setItem('user', JSON.stringify(freshUser));
      }
    } catch (e) {
      // Giữ thông tin từ AsyncStorage nếu lỗi mạng
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const openEditModal = () => {
    setEditFullName(user?.full_name || '');
    setEditPhone(user?.phone || '');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editFullName.trim()) {
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập họ và tên.');
      return;
    }
    try {
      setSaving(true);
      const res = await updateProfileApi({
        full_name: editFullName.trim(),
        phone: editPhone.trim() || null,
      });
      if (res.data?.success && res.data.data) {
        const updatedUser = res.data.data;
        setUser(updatedUser);
        await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
        setEditModalVisible(false);
        Alert.alert('Thành công', 'Đã cập nhật thông tin cá nhân.');
      }
    } catch (error) {
      Alert.alert('Lỗi', error.response?.data?.message || 'Không thể cập nhật thông tin cá nhân.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.clear();
    onLogout();
  };

  const roleMeta = ROLE_DISPLAY[user?.role] || ROLE_DISPLAY.customer;

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={styles.title}>Tài Khoản Cá Nhân</Text>
            <Ionicons name="person-circle-outline" size={26} color={COLORS.primary} />
          </View>
          <Text style={styles.subtitle}>Quản lý thông tin hồ sơ và hỗ trợ bệnh viện</Text>
        </View>

        <View style={[styles.profileLayout, isTabletOrDesktop && styles.profileLayoutDesktop]}>
          {/* Card Thông tin người dùng */}
          <View style={[styles.profileCard, isTabletOrDesktop && styles.profileCardDesktop]}>
            <View style={styles.avatar}>
              {renderRoleIcon(user?.role)}
            </View>
            <Text style={styles.name}>{user?.full_name || 'Người dùng'}</Text>
            <Text style={styles.email}>{user?.email}</Text>

            <View style={[styles.roleBadge, { backgroundColor: roleMeta.bg }]}>
              <Text style={[styles.roleText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Số điện thoại:</Text>
              <Text style={[styles.infoValue, !user?.phone && { color: COLORS.textSecondary, fontStyle: 'italic' }]}>
                {user?.phone || 'Chưa cập nhật'}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vai trò:</Text>
              <Text style={styles.infoValue}>{user?.role || 'customer'}</Text>
            </View>

            <TouchableOpacity style={styles.btnEditProfile} onPress={openEditModal} activeOpacity={0.85}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="create-outline" size={18} color={COLORS.primaryDark} />
                <Text style={styles.editProfileText}>Cập Nhật Thông Tin & SĐT</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} activeOpacity={0.8}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <Ionicons name="log-out-outline" size={18} color="#B91C1C" />
                <Text style={styles.logoutText}>Đăng Xuất Khỏi Thiết Bị</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Card Thông tin Bệnh viện & Trợ giúp */}
          <View style={[styles.supportCard, isTabletOrDesktop && styles.supportCardDesktop]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <FontAwesome5 name="hospital" size={18} color={COLORS.primaryDark} />
              <Text style={styles.supportTitle}>Bệnh Viện Thú Y PetCare</Text>
            </View>
            
            <View style={styles.supportItem}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.supportLabel}>Địa chỉ:</Text>
                <Text style={styles.supportValue}>Tòa nhà PetCare, Khu Công Nghệ Cao, TP.HCM</Text>
              </View>
            </View>

            <View style={styles.supportItem}>
              <Ionicons name="time-outline" size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.supportLabel}>Giờ hoạt động:</Text>
                <Text style={styles.supportValue}>08:00 - 20:00 (Thứ 2 - Chủ Nhật)</Text>
              </View>
            </View>

            <View style={styles.supportItem}>
              <Ionicons name="call-outline" size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.supportLabel}>Hotline cấp cứu 24/7:</Text>
                <Text style={[styles.supportValue, { color: COLORS.primaryDark, fontWeight: 'bold' }]}>1900 8888 (Miễn phí)</Text>
              </View>
            </View>

            <View style={styles.supportItem}>
              <MaterialCommunityIcons name="robot" size={20} color={COLORS.primary} style={{ marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <Text style={styles.supportLabel}>Trợ lý AI Gemini:</Text>
                <Text style={styles.supportValue}>Tư vấn sơ bộ triệu chứng có kiểm chứng RAG</Text>
              </View>
            </View>

            <View style={styles.versionBox}>
              <Text style={styles.versionText}>Phiên bản PetCare v1.0.0 (Đồ án tốt nghiệp)</Text>
            </View>
          </View>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Modal Chỉnh sửa thông tin cá nhân & Số điện thoại */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, isTabletOrDesktop && styles.modalContentDesktop]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Ionicons name="person-outline" size={20} color={COLORS.primary} />
                <Text style={styles.modalTitle}>Cập nhật thông tin cá nhân</Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Họ và tên *</Text>
            <TextInput
              value={editFullName}
              onChangeText={setEditFullName}
              placeholder="Nhập họ và tên của bạn..."
              placeholderTextColor={COLORS.textMuted || '#94A3B8'}
              style={styles.input}
            />

            <Text style={styles.fieldLabel}>Số điện thoại liên hệ</Text>
            <TextInput
              value={editPhone}
              onChangeText={setEditPhone}
              placeholder="VD: 0901234567"
              placeholderTextColor={COLORS.textMuted || '#94A3B8'}
              keyboardType="phone-pad"
              style={styles.input}
            />

            <Text style={styles.fieldHint}>
              Cập nhật số điện thoại giúp bác sĩ và dược sĩ tra cứu nhanh hồ sơ thú cưng của bạn tại quầy.
            </Text>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setEditModalVisible(false)}
                disabled={saving}
              >
                <Text style={styles.cancelBtnText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Lưu thay đổi</Text>
                )}
              </TouchableOpacity>
            </View>
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
  },
  profileLayout: {
    flexDirection: 'column',
    gap: 16,
  },
  profileLayoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  profileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  profileCardDesktop: {
    flex: 1,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  email: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  roleBadge: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    marginTop: 10,
  },
  roleText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoDivider: {
    height: 1,
    width: '100%',
    backgroundColor: COLORS.borderLight,
    marginVertical: 18,
  },
  infoRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  btnEditProfile: {
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 14,
  },
  editProfileText: {
    color: COLORS.primaryDark,
    fontWeight: 'bold',
    fontSize: 14,
  },
  btnLogout: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 10,
  },
  logoutText: {
    color: '#B91C1C',
    fontWeight: 'bold',
    fontSize: 14,
  },
  supportCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 14,
    ...SHADOWS.sm,
  },
  supportCardDesktop: {
    flex: 1.2,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 6,
  },
  supportItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  supportIcon: {
    fontSize: 18,
  },
  supportLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  supportValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.text,
    marginTop: 2,
    lineHeight: 18,
  },
  versionBox: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    alignItems: 'center',
  },
  versionText: {
    fontSize: 12,
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    width: '100%',
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...SHADOWS.sm,
  },
  modalContentDesktop: {
    maxWidth: 460,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 12,
  },
  fieldHint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
    marginBottom: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  saveBtn: {
    flex: 1.5,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});
