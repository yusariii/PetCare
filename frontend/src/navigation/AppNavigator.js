import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../constants/theme';

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
    Home: '🏠', DoctorDashboard: '🩺', DoctorCompleted: '✅', AdminDoctors: '👨‍⚕️',
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
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textSecondary,
                tabBarStyle: {
                    backgroundColor: COLORS.surface,
                    borderTopColor: COLORS.border,
                    height: 65,
                    paddingBottom: 10,
                    paddingTop: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 10,
                    marginTop: 2,
                },
                tabBarIcon: ({ focused }) => (
                    <Text style={{ fontSize: focused ? 22 : 18 }}>{ICONS[route.name] || '🏠'}</Text>
                ),
            })}
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