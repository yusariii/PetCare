const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Lấy thông tin phòng khám + danh sách dịch vụ của bác sĩ đang đăng nhập
router.get('/my-room-services', requireRole('doctor', 'admin'), invoiceController.getMyRoomServices);

// Tra cứu khách hàng đã có tài khoản theo Số điện thoại (kèm danh sách thú cưng)
router.get('/lookup-customer', requireRole('doctor', 'pharmacist', 'admin'), invoiceController.lookupCustomerByPhone);

// Danh sách hóa đơn của phòng khám
router.get('/', requireRole('doctor', 'admin'), invoiceController.getInvoices);

// Lấy chi tiết hóa đơn theo appointment_id
router.get('/appointment/:appointmentId', requireRole('doctor', 'admin', 'customer'), invoiceController.getInvoiceByAppointment);

// Tạo / cập nhật hóa đơn cho lịch khám đã hoàn thành (có điều chỉnh dịch vụ)
router.post('/appointment', requireRole('doctor', 'admin'), invoiceController.createOrUpdateAppointmentInvoice);

// Tạo hóa đơn cho khách vãng lai (khám không đặt lịch trước)
router.post('/walk-in', requireRole('doctor', 'admin'), invoiceController.createWalkInInvoice);

// Xác nhận hoàn tất thanh toán hóa đơn
router.patch('/:id/pay', requireRole('doctor', 'admin'), invoiceController.confirmInvoicePayment);

module.exports = router;
