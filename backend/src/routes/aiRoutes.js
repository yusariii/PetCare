const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.post('/consult', aiController.askHealthAssistant);
router.get('/history/:pet_id', aiController.getConsultationHistory);

module.exports = router;