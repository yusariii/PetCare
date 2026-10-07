const express = require('express');
const router = express.Router();
const prescriptionController = require('../controllers/prescriptionController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.post('/', requireRole('doctor'), prescriptionController.createPrescription);
router.get('/pet/:pet_id', prescriptionController.getPetPrescriptions);
router.get('/:id', prescriptionController.getPrescriptionDetail);

module.exports = router;
