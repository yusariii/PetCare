const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

/**
 * Public routes
 */
router.get('/services', appointmentController.getServices);

/**
 * Protected routes - require authentication
 */
router.use(verifyToken);

/**
 * Customer routes
 */
router.get('/my', appointmentController.getMyAppointments);
router.post('/', requireRole('customer'), appointmentController.createAppointment);
router.delete('/:id', appointmentController.cancelAppointment);

/**
 * Doctor & Admin routes
 * Doctor: chỉ thấy/ cập nhật được lịch của phòng khám mình phụ trách (lọc ở controller)
 * Admin: xem toàn viện
 */
router.get('/analytics', requireRole('admin'), appointmentController.getHospitalAnalytics);
router.get('/', requireRole('doctor', 'admin'), appointmentController.getAllAppointments);
router.patch('/:id/status', requireRole('doctor', 'admin'), appointmentController.updateStatus);

module.exports = router;