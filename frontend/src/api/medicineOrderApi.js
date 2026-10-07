import client from './client';

/**
 * Reserve/order a prescription (customer only) - pay at the counter
 */
export const createMedicineOrderApi = (prescriptionId) => client.post('/medicine-orders', { prescription_id: prescriptionId });

/**
 * Get my medicine orders (customer)
 */
export const getMyMedicineOrdersApi = () => client.get('/medicine-orders/my');

/**
 * List all medicine orders, optionally filter by status (admin only)
 */
export const listMedicineOrdersApi = (status) => client.get('/medicine-orders', { params: status ? { status } : {} });

/**
 * Confirm payment or cancel a reservation at the counter (admin only)
 */
export const updateMedicineOrderStatusApi = (id, status) => client.patch(`/medicine-orders/${id}/status`, { status });
