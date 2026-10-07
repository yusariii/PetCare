const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');

/**
 * Public routes (không cần xác thực)
 */
router.get('/', roomController.getAllRooms);
router.get('/live-occupancy', roomController.getLiveRoomsOccupancy);
router.get('/:id/services', roomController.getRoomServices);

/**
 * Protected routes (cần xác thực)
 */
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.get('/:id/availability', verifyToken, roomController.getRoomAvailability);

/**
 * Doctor route - phòng khám do chính bác sĩ phụ trách
 */
router.get('/my-room', verifyToken, requireRole('doctor'), roomController.getMyRoom);

/**
 * Admin routes - quản lý phòng khám và phân công bác sĩ
 */
router.post('/', verifyToken, requireRole('admin'), roomController.createRoom);
router.put('/:id', verifyToken, requireRole('admin'), roomController.updateRoom);
router.patch('/:id/assign-doctor', verifyToken, requireRole('admin'), roomController.assignDoctor);

module.exports = router;
