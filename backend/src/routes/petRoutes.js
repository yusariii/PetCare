const express = require('express');
const router = express.Router();
const petController = require('../controllers/petController');
const { verifyToken } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.get('/', petController.getMyPets);
router.post('/', petController.createPet);
router.get('/:id', petController.getPetDetail);
router.post('/:id/records', petController.addHealthRecord);

module.exports = router;