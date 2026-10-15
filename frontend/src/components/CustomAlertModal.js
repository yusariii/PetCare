import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS } from '../constants/theme';
import { setAlertListener, clearAlertListener } from '../utils/customAlert';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const getAlertConfig = (type, title = '', message = '', buttons = []) => {
  let detectedType = type;

  if (!detectedType) {
    const combined = `${title} ${message}`.toLowerCase();
    const hasDestructive = buttons.some((b) => b?.style === 'destructive');

    if (hasDestructive || combined.includes('chắc chắn') || combined.includes('xác nhận') || combined.includes('hủy lịch')) {
      detectedType = 'warning';
    } else if (combined.includes('thành công') || combined.includes('hoàn tất') || combined.includes('cảm ơn')) {
      detectedType = 'success';
    } else if (combined.includes('lỗi') || combined.includes('thất bại') || combined.includes('không thể') || combined.includes('thiếu thông tin')) {
      detectedType = 'error';
    } else {
      detectedType = 'info';
    }
  }

  switch (detectedType) {
    case 'success':
      return {
        icon: 'checkmark-circle',
        iconColor: '#10B981',
        iconBg: '#D1FAE5',
        defaultButtonColor: COLORS.primary,
      };
    case 'error':
      return {
        icon: 'close-circle',
        iconColor: '#EF4444',
        iconBg: '#FEE2E2',
        defaultButtonColor: '#EF4444',
      };
    case 'warning':
    case 'confirm':
      return {
        icon: 'alert-circle',
        iconColor: '#F59E0B',
        iconBg: '#FEF3C7',
        defaultButtonColor: COLORS.primary,
      };
    case 'info':
    default:
      return {
        icon: 'information-circle',
        iconColor: COLORS.primary,
        iconBg: COLORS.primaryLight,
        defaultButtonColor: COLORS.primary,
      };
  }
};

export default function CustomAlertModal() {
  const [visible, setVisible] = useState(false);
  const [alertData, setAlertData] = useState({
    title: '',
    message: '',
    buttons: [],
    type: null,
  });

  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setAlertListener((data) => {
      setAlertData({
        title: data?.title || '',
        message: data?.message || '',
        buttons: Array.isArray(data?.buttons) && data.buttons.length > 0 ? data.buttons : [{ text: 'Đồng ý' }],
        type: data?.type || null,
      });
      setVisible(true);

      Animated.parallel([
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    });

    return () => {
      clearAlertListener();
    };
  }, []);

  const handleClose = (callback) => {
    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      if (typeof callback === 'function') {
        callback();
      }
    });
  };

  if (!visible) return null;

  const { title, message, buttons, type } = alertData;
  const config = getAlertConfig(type, title, message, buttons);
  const isMultipleButtons = buttons.length >= 2;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={() => handleClose()}>
      <View style={styles.overlay}>
        {/* Backdrop click (chỉ cho phép đóng khi chỉ có 1 nút thông báo thường) */}
        {!isMultipleButtons && (
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => handleClose(buttons[0]?.onPress)}
          />
        )}

        <Animated.View
          style={[
            styles.alertCard,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          {/* Nút X đóng nhanh */}
          <TouchableOpacity
            style={styles.closeIconBtn}
            onPress={() => {
              const cancelBtn = buttons.find((b) => b?.style === 'cancel') || buttons[0];
              handleClose(cancelBtn?.onPress);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={20} color={COLORS.textMuted || '#94A3B8'} />
          </TouchableOpacity>

          {/* Icon tròn nghệ thuật */}
          <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
            <Ionicons name={config.icon} size={36} color={config.iconColor} />
          </View>

          {/* Tiêu đề */}
          {Boolean(title) && <Text style={styles.titleText}>{title}</Text>}

          {/* Nội dung thông báo */}
          {Boolean(message) && <Text style={styles.messageText}>{message}</Text>}

          {/* Khu vực nút bấm */}
          <View style={[styles.buttonContainer, isMultipleButtons && buttons.length === 2 ? styles.buttonRow : styles.buttonColumn]}>
            {buttons.map((btn, index) => {
              const isCancel = btn?.style === 'cancel';
              const isDestructive = btn?.style === 'destructive';

              let btnBg = config.defaultButtonColor;
              let textColor = '#FFFFFF';

              if (isCancel) {
                btnBg = COLORS.surfaceSubtle || '#F1F5F9';
                textColor = COLORS.textSecondary || '#475569';
              } else if (isDestructive) {
                btnBg = COLORS.danger || '#EF4444';
                textColor = '#FFFFFF';
              }

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    isMultipleButtons && buttons.length === 2 && styles.buttonInRow,
                    { backgroundColor: btnBg },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => handleClose(btn?.onPress)}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: textColor },
                      isCancel && styles.buttonTextCancel,
                    ]}
                    numberOfLines={1}
                  >
                    {btn?.text || 'Đồng ý'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 99999,
  },
  alertCard: {
    width: '100%',
    maxWidth: 390,
    backgroundColor: COLORS.surface || '#FFFFFF',
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 22,
    paddingHorizontal: 22,
    alignItems: 'center',
    ...SHADOWS.lg,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 20px 45px -10px rgba(15, 23, 42, 0.25), 0 8px 16px -6px rgba(15, 23, 42, 0.1)',
        }
      : {}),
  },
  closeIconBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.surfaceSubtle || '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  iconCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  titleText: {
    color: COLORS.text || '#0F172A',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 10,
    letterSpacing: -0.2,
  },
  messageText: {
    color: COLORS.textSecondary || '#475569',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  buttonContainer: {
    width: '100%',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonColumn: {
    flexDirection: 'column',
    gap: 10,
  },
  button: {
    width: '100%',
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonInRow: {
    flex: 1,
    width: 'auto',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  buttonTextCancel: {
    fontWeight: '600',
  },
});
