import client from './client';

export const listMedicinesApi = () => client.get('/medicines');

export const createMedicineApi = (payload) => client.post('/medicines', payload);

export const updateMedicineApi = (id, payload) => client.put(`/medicines/${id}`, payload);

export const adjustMedicineStockApi = (id, delta, note) => client.patch(`/medicines/${id}/stock`, { delta, note });

export const getMedicineMovementsApi = (id) => client.get(`/medicines/${id}/movements`);
