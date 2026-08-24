const cron = require('node-cron');
const db = require('../config/db');

exports.initCronJobs = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('[CRON] Đang quét bảng Reminders...');
    try {
      const query = `
        SELECT r.id, r.title, r.remind_date, p.name AS pet_name, u.full_name, u.phone 
        FROM Reminders r
        JOIN Pets p ON r.pet_id = p.id
        JOIN Users u ON p.user_id = u.id
        WHERE r.remind_date = CURDATE() AND r.is_sent = FALSE
      `;
      const [reminders] = await db.query(query);

      for (const item of reminders) {
        console.log(`[PUSH NOTIFICATION] Gửi đến ${item.full_name} (${item.phone}): Nhắc lịch cho thú cưng ${item.pet_name} - ${item.title}`);
        await db.query('UPDATE Reminders SET is_sent = TRUE WHERE id = ?', [item.id]);
      }
      console.log(`[CRON] Hoàn tất gửi ${reminders.length} nhắc nhở hôm nay.`);
    } catch (error) {
      console.error('[CRON ERROR]', error);
    }
  });
};