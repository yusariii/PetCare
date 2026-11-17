import client from './client';

/**
 * Get all services (public)
 */
export const getServicesApi = async () => {
  return client.get('/appointments/services');
};

/**
 * Create appointment
 */
export const createAppointmentApi = async (data) => {
  return client.post('/appointments', data);
};

/**
 * Get my appointments (customer view)
 */
export const getMyAppointmentsApi = async () => {
  return client.get('/appointments/my');
};

/**
 * Get all appointments (doctor/cashier/admin view)
 */
export const getAllAppointmentsApi = async (params) => {
  return client.get('/appointments', { params });
};

/**
 * Update appointment status (doctor only)
 */
export const updateAppointmentStatusApi = async (appointmentId, data) => {
  return client.patch(`/appointments/${appointmentId}/status`, data);
};

/**
 * Cập nhật / chỉ định dịch vụ thực tế của ca khám (hỗ trợ dịch vụ đa phòng)
 */
export const updateAppointmentServicesApi = async (appointmentId, payloadOrIds) => {
  const serviceIds = Array.isArray(payloadOrIds)
    ? payloadOrIds
    : Array.isArray(payloadOrIds?.service_ids)
    ? payloadOrIds.service_ids
    : [];
  return client.put(`/appointments/${appointmentId}/services`, { service_ids: serviceIds });
};

/**
 * Tiếp nhận ca khám vãng lai trực tiếp tại phòng khám (Doctor / Cashier / Admin)
 */
export const createWalkInAppointmentApi = async (payload) => {
  return client.post('/appointments/walk-in', payload);
};

/**
 * BR09: Hospital analytics dashboard (admin only)
 */
export const getHospitalAnalyticsApi = async () => {
  return client.get('/appointments/analytics');
};

/**
 * Cancel appointment
 */
export const cancelAppointmentApi = async (appointmentId) => {
  return client.delete(`/appointments/${appointmentId}`);
};

/**
 * Xóa vĩnh viễn 1 lịch hẹn đã hủy
 */
export const deleteCancelledAppointmentApi = async (appointmentId) => {
  return client.delete(`/appointments/cancelled/${appointmentId}`);
};

/**
 * Xóa tất cả lịch hẹn đã hủy của người dùng
 */
export const deleteAllCancelledAppointmentsApi = async () => {
  return client.delete('/appointments/cancelled/all');
};
