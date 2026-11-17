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
router.delete('/cancelled/all', appointmentController.deleteAllCancelledAppointments);
router.delete('/cancelled/:id', appointmentController.deleteCancelledAppointment);
router.delete('/:id', appointmentController.cancelAppointment);

/**
 * Doctor, Cashier & Admin routes
 */
router.get('/analytics', requireRole('admin'), appointmentController.getHospitalAnalytics);
router.post('/walk-in', requireRole('doctor', 'cashier', 'admin'), appointmentController.createWalkInAppointment);
router.get('/', requireRole('doctor', 'cashier', 'admin'), appointmentController.getAllAppointments);
router.patch('/:id/status', requireRole('doctor', 'admin'), appointmentController.updateStatus);
router.put('/:id/services', requireRole('doctor', 'cashier', 'admin'), appointmentController.updateAppointmentServices);

module.exports = router;
