import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const BASE_URL = Platform.OS === 'android' 
  ? 'http://10.0.2.2:1008/api' 
  : 'http://localhost:1008/api';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

const authFailureListeners = new Set();

export const onAuthFailure = (listener) => {
  authFailureListeners.add(listener);
  return () => authFailureListeners.delete(listener);
};

// Request interceptor - Add token to all requests
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor - Handle 401 errors
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isExpiredToken = error.response?.status === 401
      || (error.response?.status === 403 && error.response?.data?.message?.includes('Token'));
    if (isExpiredToken) {
      // Token expired or invalid
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      console.warn('Token expired, user will be logged out');
      authFailureListeners.forEach((listener) => listener());
    }
    return Promise.reject(error);
  }
);

export default client;