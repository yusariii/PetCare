const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.post('/', requireRole('customer'), reviewController.createReview);
router.get('/', requireRole('doctor', 'admin'), reviewController.listReviews);

module.exports = router;
