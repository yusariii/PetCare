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
 * List all medicine orders, optionally filter by status (pharmacist/admin)
 */
export const listMedicineOrdersApi = (status) => client.get('/medicine-orders', { params: status ? { status } : {} });

/**
 * Điều chỉnh danh sách thuốc & số lượng thực tế khách lấy trước khi hiển thị QR thanh toán
 */
export const updateMedicineOrderItemsApi = (id, payload) => client.put(`/medicine-orders/${id}/items`, payload);

/**
 * Tạo hóa đơn bán thuốc trực tiếp cho khách vãng lai (pharmacist/admin)
 */
export const createWalkInMedicineOrderApi = (payload) => client.post('/medicine-orders/walk-in', payload);

/**
 * Confirm payment or cancel a reservation at the counter (pharmacist/admin)
 */
export const updateMedicineOrderStatusApi = (id, status) => client.patch(`/medicine-orders/${id}/status`, { status });
