import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SHADOWS } from '../constants/theme';
import { useResponsive } from '../utils/responsive';

import HomeScreen from '../screens/Home/HomeScreen';
import HospitalMapScreen from '../screens/Hospital/HospitalMapScreen';
import BookingScreen from '../screens/Booking/BookingScreen';
import AIChatScreen from '../screens/AIChat/AIChatScreen';
import AppointmentsScreen from '../screens/Appointments/AppointmentsScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';
import PharmacyScreen from '../screens/Pharmacy/PharmacyScreen';
import DoctorDashboardScreen from '../screens/Doctor/DoctorDashboardScreen';
import DoctorAnalyticsScreen from '../screens/Doctor/DoctorAnalyticsScreen';
import KnowledgeBaseScreen from '../screens/Doctor/KnowledgeBaseScreen';
import AdminDoctorsScreen from '../screens/Admin/AdminDoctorsScreen';
import AdminMedicinesScreen from '../screens/Admin/AdminMedicinesScreen';
import AdminMedicineOrdersScreen from '../screens/Admin/AdminMedicineOrdersScreen';

const Tab = createBottomTabNavigator();

const ICONS = {
    Home: '🏠',
    DoctorDashboard: '🩺',
    DoctorCompleted: '✅',
    AdminDoctors: '👨‍⚕️',
    Hospital: '🏥',
    Booking: '📅',
    AIChat: '🤖',
    Appointments: '📋',
    Pharmacy: '💊',
    DoctorAnalytics: '📊',
    KnowledgeBase: '📚',
    AdminMedicines: '📦',
    AdminMedicineOrders: '🧾',
    Profile: '👤',
};

const ROLE_BADGES = {
    admin: { label: 'Quản trị viên', badgeBg: '#FEF3C7', textColor: '#B45309', icon: '🛡️' },
    doctor: { label: 'Bác sĩ', badgeBg: '#E0F2FE', textColor: '#0369A1', icon: '🩺' },
    pharmacist: { label: 'Dược sĩ', badgeBg: '#EDE9FE', textColor: '#6D28D9', icon: '💊' },
    customer: { label: 'Khách hàng', badgeBg: '#E6FFFA', textColor: '#0F766E', icon: '🐾' },
};

function CustomResponsiveTabBar({ state, descriptors, navigation, userRole, onLogout }) {
    const { isTabletOrDesktop } = useResponsive();
    const roleMeta = ROLE_BADGES[userRole] || ROLE_BADGES.customer;

    if (isTabletOrDesktop) {
        // DESKTOP: Sleek Top Navigation Header
        return (
            <View style={styles.desktopHeaderOuter}>
                <View style={styles.desktopHeaderInner}>
                    {/* Brand */}
                    <View style={styles.desktopBrand}>
                        <View style={styles.brandBadge}>
                            <Text style={styles.brandIcon}>🐾</Text>
                        </View>
                        <View>
                            <Text style={styles.brandTitle}>PetCare Hospital</Text>
                            <Text style={styles.brandSubtitle}>Hệ Thống Thú Y Đa Khoa & AI</Text>
                        </View>
                    </View>

                    {/* Nav tabs */}
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.desktopNavTabs}
                    >
                        {state.routes.map((route, index) => {
                            const { options } = descriptors[route.key];
                            const label = options.tabBarLabel !== undefined
                                ? options.tabBarLabel
                                : options.title !== undefined
                                ? options.title
                                : route.name;

                            const isFocused = state.index === index;

                            const onPress = () => {
                                const event = navigation.emit({
                                    type: 'tabPress',
                                    target: route.key,
                                    canPreventDefault: true,
                                });

                                if (!isFocused && !event.defaultPrevented) {
                                    navigation.navigate(route.name);
                                }
                            };

                            return (
                                <TouchableOpacity
                                    key={route.key}
                                    onPress={onPress}
                                    style={[
                                        styles.desktopTabButton,
                                        isFocused && styles.desktopTabButtonActive,
                                    ]}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.desktopTabIcon, isFocused && styles.desktopTabIconActive]}>
                                        {ICONS[route.name] || '🏠'}
                                    </Text>
                                    <Text
                                        style={[
                                            styles.desktopTabLabel,
                                            isFocused && styles.desktopTabLabelActive,
                                        ]}
                                    >
                                        {label}
                                    </Text>
                                    {isFocused && <View style={styles.activeDot} />}
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    {/* Right User & Logout Area */}
                    <View style={styles.desktopUserArea}>
                        <View style={[styles.roleChip, { backgroundColor: roleMeta.badgeBg }]}>
                            <Text style={[styles.roleChipText, { color: roleMeta.textColor }]}>
                                {roleMeta.icon} {roleMeta.label}
                            </Text>
                        </View>
                        {onLogout && (
                            <TouchableOpacity
                                style={styles.desktopLogoutBtn}
                                onPress={onLogout}
                                activeOpacity={0.7}
                            >
                                <Text style={styles.desktopLogoutText}>🚪 Thoát</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </View>
        );
    }

    // MOBILE: Clean Modern Bottom Tab Bar
    return (
        <View style={styles.mobileTabBar}>
            {state.routes.map((route, index) => {
                const { options } = descriptors[route.key];
                const label = options.tabBarLabel !== undefined
                    ? options.tabBarLabel
                    : options.title !== undefined
                    ? options.title
                    : route.name;

                const isFocused = state.index === index;

                const onPress = () => {
                    const event = navigation.emit({
                        type: 'tabPress',
                        target: route.key,
                        canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name);
                    }
                };

                return (
                    <TouchableOpacity
                        key={route.key}
                        onPress={onPress}
                        style={styles.mobileTabButton}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.mobileIconPill, isFocused && styles.mobileIconPillActive]}>
                            <Text style={{ fontSize: isFocused ? 20 : 18 }}>
                                {ICONS[route.name] || '🏠'}
                            </Text>
                        </View>
                        <Text
                            style={[
                                styles.mobileTabLabel,
                                isFocused && styles.mobileTabLabelActive,
                            ]}
                            numberOfLines={1}
                        >
                            {label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export default function AppNavigator({ onLogout }) {
    const [userRole, setUserRole] = useState('customer');
    const [roleLoading, setRoleLoading] = useState(true);

    useEffect(() => {
        AsyncStorage.getItem('user').then((value) => {
            if (value) setUserRole(JSON.parse(value).role || 'customer');
        }).catch(() => setUserRole('customer')).finally(() => setRoleLoading(false));
    }, []);

    if (roleLoading) return null;

    const isDoctor = userRole === 'doctor';
    const isAdmin = userRole === 'admin';
    const isPharmacist = userRole === 'pharmacist';

    return (
        <Tab.Navigator
            tabBar={(props) => (
                <CustomResponsiveTabBar
                    {...props}
                    userRole={userRole}
                    onLogout={onLogout}
                />
            )}
            screenOptions={{
                headerShown: false,
            }}
        >
            {isAdmin ? (
                <>
                    <Tab.Screen name="AdminDoctors" component={AdminDoctorsScreen} options={{ tabBarLabel: 'Nhân sự' }} />
                    <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ tabBarLabel: 'Lịch viện' }} />
                    <Tab.Screen name="DoctorAnalytics" component={DoctorAnalyticsScreen} options={{ tabBarLabel: 'Thống kê' }} />
                    <Tab.Screen name="AdminMedicines" component={AdminMedicinesScreen} options={{ tabBarLabel: 'Kho thuốc' }} />
                    <Tab.Screen name="KnowledgeBase" component={KnowledgeBaseScreen} options={{ tabBarLabel: 'Tri thức AI' }} />
                </>
            ) : isPharmacist ? (
                <>
                    <Tab.Screen name="AdminMedicineOrders" component={AdminMedicineOrdersScreen} options={{ tabBarLabel: 'Quầy thuốc' }} />
                    <Tab.Screen name="AdminMedicines" component={AdminMedicinesScreen} options={{ tabBarLabel: 'Kho thuốc' }} />
                </>
            ) : isDoctor ? (
                <>
                    <Tab.Screen name="DoctorDashboard" component={DoctorDashboardScreen} options={{ tabBarLabel: 'Ca khám' }} />
                    <Tab.Screen name="DoctorCompleted" component={DoctorDashboardScreen} initialParams={{ mode: 'completed' }} options={{ tabBarLabel: 'Đã khám' }} />
                </>
            ) : (
                <>
                    <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Trang chủ' }} />
                    <Tab.Screen name="Hospital" component={HospitalMapScreen} options={{ tabBarLabel: 'Bản đồ' }} />
                    <Tab.Screen name="Booking" component={BookingScreen} options={{ tabBarLabel: 'Đặt lịch' }} />
                    <Tab.Screen name="AIChat" component={AIChatScreen} options={{ tabBarLabel: 'Bác sĩ AI' }} />
                    <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ tabBarLabel: 'Lịch hẹn' }} />
                    <Tab.Screen name="Pharmacy" component={PharmacyScreen} options={{ tabBarLabel: 'Đơn thuốc' }} />
                </>
            )}
            <Tab.Screen name="Profile" options={{ tabBarLabel: 'Tài khoản' }}>
                {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    // Desktop Top Nav Styles
    desktopHeaderOuter: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 72,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        zIndex: 1000,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.md,
    },
    desktopHeaderInner: {
        width: '100%',
        maxWidth: 1280,
        height: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
    },
    desktopBrand: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    brandBadge: {
        width: 42,
        height: 42,
        borderRadius: 12,
        backgroundColor: COLORS.primaryLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    brandIcon: {
        fontSize: 22,
    },
    brandTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        color: COLORS.primaryDark,
        letterSpacing: 0.3,
    },
    brandSubtitle: {
        fontSize: 11,
        color: COLORS.textSecondary,
        fontWeight: '500',
    },
    desktopNavTabs: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
    },
    desktopTabButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
        gap: 8,
    },
    desktopTabButtonActive: {
        backgroundColor: COLORS.primaryLight,
    },
    desktopTabIcon: {
        fontSize: 16,
    },
    desktopTabIconActive: {
        transform: [{ scale: 1.1 }],
    },
    desktopTabLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },
    desktopTabLabelActive: {
        color: COLORS.primaryDark,
        fontWeight: '700',
    },
    activeDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: COLORS.primary,
        marginLeft: 2,
    },
    desktopUserArea: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    roleChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
    },
    roleChipText: {
        fontSize: 12,
        fontWeight: '700',
    },
    desktopLogoutBtn: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: COLORS.surfaceSubtle,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    desktopLogoutText: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.textSecondary,
    },

    // Mobile Bottom Tab Styles
    mobileTabBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        height: 65,
        paddingBottom: 8,
        paddingTop: 6,
        alignItems: 'center',
        justifyContent: 'space-around',
        ...SHADOWS.md,
    },
    mobileTabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mobileIconPill: {
        width: 38,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mobileIconPillActive: {
        backgroundColor: COLORS.primaryLight,
    },
    mobileTabLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.textSecondary,
        marginTop: 2,
    },
    mobileTabLabelActive: {
        color: COLORS.primary,
        fontWeight: '700',
    },
});