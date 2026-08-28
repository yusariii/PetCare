import client from './client';

export const getMyPetsApi = () => client.get('/pets');
export const createPetApi = (data) => client.post('/pets', data);
export const getPetDetailApi = (id) => client.get(`/pets/${id}`);
export const addHealthRecordApi = (id, data) => client.post(`/pets/${id}/records`, data);