const express = require('express');
const router = express.Router();
const petController = require('../controllers/petController');
const { verifyToken } = require('../middlewares/authMiddleware');

// All routes require authentication
router.use(verifyToken);

// Pet CRUD operations
router.get('/', petController.getMyPets);                    // GET /api/pets
router.post('/', petController.createPet);                   // POST /api/pets
router.get('/:id', petController.getPetDetail);              // GET /api/pets/:id
router.patch('/:id', petController.updatePet);               // PATCH /api/pets/:id
router.delete('/:id', petController.deletePet);              // DELETE /api/pets/:id

module.exports = router;