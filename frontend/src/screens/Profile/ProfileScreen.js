import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS } from '../../constants/theme';
import ResponsiveContainer from '../../components/ResponsiveContainer';
import { useResponsive } from '../../utils/responsive';

const ROLE_DISPLAY = {
  admin: { label: 'Quản trị viên hệ thống', bg: '#FEF3C7', color: '#B45309', icon: '🛡️' },
  doctor: { label: 'Bác sĩ chuyên khoa', bg: '#E0F2FE', color: '#0369A1', icon: '🩺' },
  pharmacist: { label: 'Dược sĩ quầy thuốc', bg: '#EDE9FE', color: '#6D28D9', icon: '💊' },
  customer: { label: 'Khách hàng thành viên', bg: '#E6FFFA', color: '#0F766E', icon: '🐾' },
};

export default function ProfileScreen({ onLogout }) {
  const { isTabletOrDesktop } = useResponsive();
  const [user, setUser] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('user').then((u) => u && setUser(JSON.parse(u)));
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.clear();
    onLogout();
  };

  const roleMeta = ROLE_DISPLAY[user?.role] || ROLE_DISPLAY.customer;

  return (
    <ResponsiveContainer style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Tài Khoản Cá Nhân 👤</Text>
          <Text style={styles.subtitle}>Quản lý thông tin hồ sơ và hỗ trợ bệnh viện</Text>
        </View>

        <View style={[styles.profileLayout, isTabletOrDesktop && styles.profileLayoutDesktop]}>
          {/* Card Thông tin người dùng */}
          <View style={[styles.profileCard, isTabletOrDesktop && styles.profileCardDesktop]}>
            <View style={styles.avatar}>
              <Text style={{ fontSize: 36 }}>{roleMeta.icon}</Text>
            </View>
            <Text style={styles.name}>{user?.full_name || 'Người dùng'}</Text>
            <Text style={styles.email}>{user?.email}</Text>

            <View style={[styles.roleBadge, { backgroundColor: roleMeta.bg }]}>
              <Text style={[styles.roleText, { color: roleMeta.color }]}>{roleMeta.label}</Text>
            </View>

            <View style={styles.infoDivider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Số điện thoại:</Text>
              <Text style={styles.infoValue}>{user?.phone || 'Chưa cập nhật'}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vai trò:</Text>
              <Text style={styles.infoValue}>{user?.role || 'customer'}</Text>
            </View>

            <TouchableOpacity style={styles.btnLogout} onPress={handleLogout} activeOpacity={0.8}>
              <Text style={styles.logoutText}>🚪 Đăng Xuất Khỏi Thiết Bị</Text>
            </TouchableOpacity>
          </View>

          {/* Card Thông tin Bệnh viện & Trợ giúp */}
          <View style={[styles.supportCard, isTabletOrDesktop && styles.supportCardDesktop]}>
            <Text style={styles.supportTitle}>🏥 Bệnh Viện Thú Y PetCare</Text>
            
            <View style={styles.supportItem}>
              <Text style={styles.supportIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportLabel}>Địa chỉ:</Text>
                <Text style={styles.supportValue}>Tòa nhà PetCare, Khu Công Nghệ Cao, TP.HCM</Text>
              </View>
            </View>

            <View style={styles.supportItem}>
              <Text style={styles.supportIcon}>⏰</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportLabel}>Giờ hoạt động:</Text>
                <Text style={styles.supportValue}>08:00 - 20:00 (Thứ 2 - Chủ Nhật)</Text>
              </View>
            </View>

            <View style={styles.supportItem}>
              <Text style={styles.supportIcon}>📞</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.supportLabel}>Hotline cấp cứu 24/7:</Text>
                <Text style={[styles.supportValue, { color: COLORS.primaryDark, fontWeight: 'bold' }]}>1900 8888 (Miễn phí)</Text>
              </View>
            </View>

            <View style={styles.supportItem}>
              <Text style={styles.supportIcon}>🤖</Text>
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
  btnLogout: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    width: '100%',
    marginTop: 18,
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
});