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
const { verifyToken } = require('../middlewares/authMiddleware');

router.get('/:id/availability', verifyToken, roomController.getRoomAvailability);

module.exports = router;
