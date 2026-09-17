const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.use(verifyToken);
// AI consultation is a pet-owner feature; doctors use the doctor dashboard.
router.use(requireRole('customer'));
router.post('/consult', aiController.askHealthAssistant);
router.get('/history/:pet_id', aiController.getConsultationHistory);

module.exports = router;