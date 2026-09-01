import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/Auth/LoginScreen';
import RegisterScreen from './src/screens/Auth/RegisterScreen';
import AppNavigator from './src/navigation/AppNavigator';

const AuthStack = createNativeStackNavigator();

// Deep Linking Configuration - URL will sync with navigation
const linking = {
  prefixes: ['petcare://', 'https://petcare.app', 'http://localhost:19006'],
  config: {
    screens: {
      Login: 'login',
      Register: 'register',
      Home: 'home',
      Hospital: 'hospital',
      Booking: 'booking/:roomId?',
      AIChat: 'ai-chat',
      Appointments: 'appointments',
      Profile: 'profile',
      NotFound: '*',
    },
  },
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('token').then((token) => {
      if (token) setIsAuthenticated(true);
      setLoading(false);
    });
  }, []);

  if (loading) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer linking={linking} fallback={<></>}>
        {isAuthenticated ? (
          <AppNavigator onLogout={() => setIsAuthenticated(false)} />
        ) : (
          <AuthStack.Navigator screenOptions={{ headerShown: false }}>
            <AuthStack.Screen name="Login">
              {(props) => <LoginScreen {...props} onLoginSuccess={() => setIsAuthenticated(true)} />}
            </AuthStack.Screen>
            <AuthStack.Screen name="Register" component={RegisterScreen} />
          </AuthStack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}