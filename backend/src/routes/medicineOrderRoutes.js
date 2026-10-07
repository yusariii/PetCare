const express = require('express');
const router = express.Router();
const medicineOrderController = require('../controllers/medicineOrderController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.post('/', requireRole('customer'), medicineOrderController.createOrder);
router.get('/my', requireRole('customer'), medicineOrderController.getMyOrders);
router.get('/', requireRole('pharmacist'), medicineOrderController.listOrders);
router.patch('/:id/status', requireRole('pharmacist'), medicineOrderController.updateOrderStatus);

module.exports = router;
