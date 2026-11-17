const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Lấy thông tin toàn bộ phòng khám + danh sách dịch vụ (phục vụ Bác sĩ chỉ định dịch vụ & Thu ngân thanh toán)
router.get('/my-room-services', requireRole('doctor', 'cashier', 'admin'), invoiceController.getMyRoomServices);

// Tra cứu khách hàng đã có tài khoản theo Số điện thoại (kèm danh sách thú cưng)
router.get('/lookup-customer', requireRole('cashier', 'pharmacist', 'doctor', 'admin'), invoiceController.lookupCustomerByPhone);

// Danh sách hóa đơn toàn viện (Thu ngân & Admin)
router.get('/', requireRole('cashier', 'admin', 'doctor'), invoiceController.getInvoices);

// Lấy chi tiết hóa đơn theo appointment_id
router.get('/appointment/:appointmentId', requireRole('cashier', 'admin', 'doctor', 'customer'), invoiceController.getInvoiceByAppointment);

// Tạo / cập nhật hóa đơn cho lịch khám đã hoàn thành (Thu ngân & Admin)
router.post('/appointment', requireRole('cashier', 'admin'), invoiceController.createOrUpdateAppointmentInvoice);

// Tạo hóa đơn cho khách vãng lai (Thu ngân & Admin)
router.post('/walk-in', requireRole('cashier', 'admin'), invoiceController.createWalkInInvoice);

// Xác nhận hoàn tất thanh toán hóa đơn (Thu ngân & Admin)
router.patch('/:id/pay', requireRole('cashier', 'admin'), invoiceController.confirmInvoicePayment);

module.exports = router;
