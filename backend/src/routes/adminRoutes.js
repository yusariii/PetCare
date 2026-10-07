const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(requireRole('admin'));

router.get('/doctors', adminController.listDoctors);
router.post('/doctors', adminController.createDoctor);
router.put('/doctors/:id', adminController.updateDoctor);
router.patch('/doctors/:id/active', adminController.setDoctorActive);

router.get('/pharmacists', adminController.listPharmacists);
router.post('/pharmacists', adminController.createPharmacist);
router.patch('/pharmacists/:id/active', adminController.setPharmacistActive);

module.exports = router;
