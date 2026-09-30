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
import DoctorDashboardScreen from '../screens/Doctor/DoctorDashboardScreen';
import DoctorAnalyticsScreen from '../screens/Doctor/DoctorAnalyticsScreen';
import KnowledgeBaseScreen from '../screens/Doctor/KnowledgeBaseScreen';

const Tab = createBottomTabNavigator();

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
                tabBarIcon: ({ focused }) => {
                    let icon = '🏠';
                    if (route.name === 'Home' || route.name === 'DoctorDashboard') icon = isDoctor ? '🩺' : '🏠';
                    if (route.name === 'Hospital') icon = '🏥';
                    if (route.name === 'Booking') icon = '📅';
                    if (route.name === 'AIChat') icon = '🤖';
                    if (route.name === 'Appointments') icon = '📋';
                    if (route.name === 'DoctorAnalytics') icon = '📊';
                    if (route.name === 'KnowledgeBase') icon = '📚';
                    if (route.name === 'Profile') icon = '👤';
                    return <Text style={{ fontSize: focused ? 22 : 18 }}>{icon}</Text>;
                },
            })}
        >
            {isDoctor ? (
                <>
                    <Tab.Screen name="DoctorDashboard" component={DoctorDashboardScreen} options={{ tabBarLabel: 'Ca khám' }} />
                    <Tab.Screen name="DoctorAnalytics" component={DoctorAnalyticsScreen} options={{ tabBarLabel: 'Thống Kê' }} />
                    <Tab.Screen name="KnowledgeBase" component={KnowledgeBaseScreen} options={{ tabBarLabel: 'Tri thức AI' }} />
                </>
            ) : (
                <>
                    <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Trang chủ' }} />
                    <Tab.Screen name="Hospital" component={HospitalMapScreen} options={{ tabBarLabel: 'Bản đồ' }} />
                    <Tab.Screen name="Booking" component={BookingScreen} options={{ tabBarLabel: 'Đặt lịch' }} />
                    <Tab.Screen name="AIChat" component={AIChatScreen} options={{ tabBarLabel: 'Bác sĩ AI' }} />
                    <Tab.Screen name="Appointments" component={AppointmentsScreen} options={{ tabBarLabel: 'Lịch hẹn' }} />
                </>
            )}
            <Tab.Screen name="Profile" options={{ tabBarLabel: 'Tài khoản' }}>
                {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
}