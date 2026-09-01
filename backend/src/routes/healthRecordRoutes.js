const express = require('express');
const router = express.Router();
const healthRecordController = require('../controllers/healthRecordController');
const { verifyToken, requireRole } = require('../middlewares/authMiddleware');

/**
 * Protected routes (cần xác thực)
 */
router.use(verifyToken);

/**
 * Doctor only - Create health record
 */
router.post('/', requireRole('doctor'), healthRecordController.createHealthRecord);

/**
 * Get pet health records (customer sees own pet, doctor sees all)
 */
router.get('/pet/:pet_id', healthRecordController.getPetHealthRecords);

/**
 * Get pet reminders
 */
router.get('/reminders/:pet_id', healthRecordController.getPetReminders);

/**
 * Internal API - Get pending reminders for today
 */
router.get('/reminders/pending/today', healthRecordController.getPendingReminders);

/**
 * Internal API - Mark reminder as sent
 */
router.patch('/reminders/:reminder_id/mark-sent', healthRecordController.markReminderAsSent);

module.exports = router;
