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
 * Get all appointments (doctor view)
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
 * BR09: Hospital analytics dashboard (doctor only)
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
