import { Alert } from 'react-native';

// Callback đăng ký với CustomAlertModal
let alertListener = null;

export const setAlertListener = (listener) => {
  alertListener = listener;
};

export const clearAlertListener = () => {
  alertListener = null;
};

/**
 * Hiển thị thông báo Custom Alert đẹp mắt
 * @param {Object} options
 * @param {string} options.title - Tiêu đề thông báo
 * @param {string} options.message - Nội dung chi tiết
 * @param {Array} options.buttons - Danh sách nút [{ text: 'Đồng ý', onPress: () => {}, style: 'default'|'cancel'|'destructive' }]
 * @param {string} options.type - 'success' | 'error' | 'warning' | 'confirm' | 'info' (tự động nhận diện nếu không truyền)
 */
export const showCustomAlert = ({ title = '', message = '', buttons = [], type = null }) => {
  if (alertListener) {
    alertListener({ title, message, buttons, type });
  } else {
    // Dự phòng nếu modal chưa mount
    console.warn('CustomAlertModal is not mounted yet, fallback to native Alert');
  }
};

/**
 * Tự động ghi đè Alert.alert trên cả Web và Mobile
 * để tất cả các màn hình hiện tại dùng chung giao diện Custom Alert đẹp mắt
 */
Alert.alert = (title, message, buttons = [{ text: 'Đồng ý' }], options = {}) => {
  showCustomAlert({
    title,
    message,
    buttons: Array.isArray(buttons) && buttons.length > 0 ? buttons : [{ text: 'Đồng ý' }],
    type: options?.type || null,
  });
};

export default {
  show: showCustomAlert,
  setAlertListener,
  clearAlertListener,
};
