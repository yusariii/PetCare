const express = require('express');
const router = express.Router();
const medicineController = require('../controllers/medicineController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.use(verifyToken);

// Doctor chỉ đọc để kê đơn; admin và dược sĩ quản lý kho
router.get('/', requireRole('doctor', 'admin', 'pharmacist'), medicineController.listMedicines);
router.post('/', requireRole('admin', 'pharmacist'), medicineController.createMedicine);
router.put('/:id', requireRole('admin', 'pharmacist'), medicineController.updateMedicine);
router.patch('/:id/stock', requireRole('admin', 'pharmacist'), medicineController.adjustStock);
router.get('/:id/movements', requireRole('admin', 'pharmacist'), medicineController.listMovements);

module.exports = router;
