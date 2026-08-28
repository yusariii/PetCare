import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { COLORS } from '../constants/theme';

import HomeScreen from '../screens/Home/HomeScreen';
import BookingScreen from '../screens/Booking/BookingScreen';
import AIChatScreen from '../screens/AIChat/AIChatScreen';
import ProfileScreen from '../screens/Profile/ProfileScreen';

const Tab = createBottomTabNavigator();

export default function AppNavigator({ onLogout }) {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.textSecondary,
                tabBarStyle: {
                    backgroundColor: COLORS.surface,
                    borderTopColor: COLORS.border,
                    height: 60,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
                tabBarIcon: ({ focused }) => {
                    let icon = '🏠';
                    if (route.name === 'Home') icon = '🏠';
                    if (route.name === 'Booking') icon = '📅';
                    if (route.name === 'AIChat') icon = '🤖';
                    if (route.name === 'Profile') icon = '👤';
                    return <Text style={{ fontSize: focused ? 22 : 18 }}>{icon}</Text>;
                },
            })}
        >
            <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Trang chủ' }} />
            <Tab.Screen name="Booking" component={BookingScreen} options={{ tabBarLabel: 'Đặt lịch' }} />
            <Tab.Screen name="AIChat" component={AIChatScreen} options={{ tabBarLabel: 'Bác sĩ AI' }} />
            <Tab.Screen name="Profile" options={{ tabBarLabel: 'Tài khoản' }}>
                {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
            </Tab.Screen>
        </Tab.Navigator>
    );
}