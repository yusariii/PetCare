import client from './client';

/**
 * Get all pets for current user
 */
export const getMyPetsApi = async () => {
  return client.get('/pets');
};

/**
 * Create a new pet
 */
export const createPetApi = async (data) => {
  return client.post('/pets', data);
};

/**
 * Get specific pet details with health records
 */
export const getPetDetailApi = async (id) => {
  return client.get(`/pets/${id}`);
};

/**
 * Update pet information
 */
export const updatePetApi = async (id, data) => {
  return client.patch(`/pets/${id}`, data);
};

/**
 * Delete a pet
 */
export const deletePetApi = async (id) => {
  return client.delete(`/pets/${id}`);
};

/**
 * Add health record (doctor only)
 */
export const addHealthRecordApi = async (id, data) => {
  return client.post(`/pets/${id}/records`, data);
};