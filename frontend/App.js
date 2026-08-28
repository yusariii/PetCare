import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

import LoginScreen from './src/screens/Auth/LoginScreen';
import AppNavigator from './src/navigation/AppNavigator';

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
            <NavigationContainer>
                {isAuthenticated ? (
                    <AppNavigator onLogout={() => setIsAuthenticated(false)} />
                ) : (
                    <LoginScreen onLoginSuccess={() => setIsAuthenticated(true)} />
                )}
            </NavigationContainer>
        </SafeAreaProvider>
    );
}