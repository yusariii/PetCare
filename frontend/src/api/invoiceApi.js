import client from './client';

/**
 * Lấy thông tin phòng khám + danh sách dịch vụ của bác sĩ đang đăng nhập
 */
export const getMyRoomServicesApi = async (roomId) => {
  return client.get('/invoices/my-room-services', {
    params: roomId ? { room_id: roomId } : undefined,
  });
};

/**
 * Tra cứu khách hàng đã có tài khoản theo Số điện thoại (trả về user + danh sách thú cưng)
 */
export const lookupCustomerByPhoneApi = async (phone) => {
  return client.get('/invoices/lookup-customer', {
    params: { phone },
  });
};

/**
 * Lấy danh sách hóa đơn của phòng bác sĩ
 */
export const getInvoicesApi = async (params) => {
  return client.get('/invoices', { params });
};

/**
 * Lấy chi tiết hóa đơn theo appointment_id
 */
export const getInvoiceByAppointmentApi = async (appointmentId) => {
  return client.get(`/invoices/appointment/${appointmentId}`);
};

/**
 * Tạo / cập nhật hóa đơn thanh toán cho ca khám đã hoàn thành (có điều chỉnh dịch vụ)
 * payload: { appointment_id, service_ids: [1, 2], notes }
 */
export const createOrUpdateAppointmentInvoiceApi = async (payload) => {
  return client.post('/invoices/appointment', payload);
};

/**
 * Tạo hóa đơn thanh toán cho khách vãng lai (khám không đặt lịch trước)
 * payload: { customer_name, pet_species, service_ids: [1, 2], notes, room_id? }
 */
export const createWalkInInvoiceApi = async (payload) => {
  return client.post('/invoices/walk-in', payload);
};

/**
 * Xác nhận hoàn tất thanh toán hóa đơn
 */
export const confirmInvoicePaymentApi = async (invoiceId) => {
  return client.patch(`/invoices/${invoiceId}/pay`);
};
