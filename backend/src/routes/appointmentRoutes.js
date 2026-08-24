const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointmentController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.get('/services', appointmentController.getServices);

router.use(verifyToken);
router.get('/my-appointments', appointmentController.getMyAppointments);
router.post('/', appointmentController.createAppointment);
router.post('/review', appointmentController.reviewAppointment);
router.patch('/:id/status', requireRole('admin', 'staff'), appointmentController.updateStatus);

module.exports = router;