import client from './client';

/**
 * List all doctor accounts with their assigned room (admin only)
 */
export const listDoctorsApi = () => client.get('/admin/doctors');

/**
 * Create a doctor account, optionally assigning a room (admin only)
 */
export const createDoctorApi = (payload) => client.post('/admin/doctors', payload);

/**
 * Update a doctor's profile (admin only)
 */
export const updateDoctorApi = (id, payload) => client.put(`/admin/doctors/${id}`, payload);

/**
 * Lock/unlock a doctor account (admin only)
 */
export const setDoctorActiveApi = (id, isActive) => client.patch(`/admin/doctors/${id}/active`, { is_active: isActive });

export const listPharmacistsApi = () => client.get('/admin/pharmacists');

export const createPharmacistApi = (payload) => client.post('/admin/pharmacists', payload);

export const setPharmacistActiveApi = (id, isActive) => client.patch(`/admin/pharmacists/${id}/active`, { is_active: isActive });
