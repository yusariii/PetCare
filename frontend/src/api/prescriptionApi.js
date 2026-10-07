import client from './client';

/**
 * Create a prescription (doctor only)
 */
export const createPrescriptionApi = (payload) => client.post('/prescriptions', payload);

/**
 * Get prescriptions for a pet
 */
export const getPetPrescriptionsApi = (petId) => client.get(`/prescriptions/pet/${petId}`);

/**
 * Get prescription detail (with items)
 */
export const getPrescriptionDetailApi = (id) => client.get(`/prescriptions/${id}`);
