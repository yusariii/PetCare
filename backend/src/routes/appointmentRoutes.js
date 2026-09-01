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
 * Doctor routes
 */
router.get('/', requireRole('doctor'), appointmentController.getAllAppointments);
router.patch('/:id/status', requireRole('doctor'), appointmentController.updateStatus);

module.exports = router;