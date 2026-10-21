const express = require('express');
const router = express.Router();
const medicineOrderController = require('../controllers/medicineOrderController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.post('/', requireRole('customer'), medicineOrderController.createOrder);
router.get('/my', requireRole('customer'), medicineOrderController.getMyOrders);
router.get('/', requireRole('pharmacist', 'admin'), medicineOrderController.listOrders);
router.post('/walk-in', requireRole('pharmacist', 'admin'), medicineOrderController.createWalkInOrder);
router.put('/:id/items', requireRole('pharmacist', 'admin'), medicineOrderController.updateOrderItems);
router.patch('/:id/status', requireRole('pharmacist', 'admin'), medicineOrderController.updateOrderStatus);

module.exports = router;
