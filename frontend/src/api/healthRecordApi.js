import client from './client';

/**
 * Create health record (doctor only)
 */
export const createHealthRecordApi = async (data) => {
  return client.post('/health-records', data);
};

/**
 * Get pet health records
 */
export const getPetHealthRecordsApi = async (petId) => {
  return client.get(`/health-records/pet/${petId}`);
};

/**
 * Get pet reminders
 */
export const getPetRemindersApi = async (petId) => {
  return client.get(`/health-records/reminders/${petId}`);
};

/**
 * Get pending reminders (for cron/internal use)
 */
export const getPendingRemindersApi = async () => {
  return client.get('/health-records/reminders/pending/today');
};

/**
 * Mark reminder as sent
 */
export const markReminderAsSentApi = async (reminderId) => {
  return client.patch(`/health-records/reminders/${reminderId}/mark-sent`);
};
