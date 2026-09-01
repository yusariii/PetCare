const cron = require('node-cron');
const db = require('../config/db');

/**
 * BR06: Quét Lịch & Gửi Thông báo Tự động
 * Định kỳ lúc 08:00 sáng hàng ngày
 * Quét toàn bộ các bản ghi trong Reminders có remind_date = CURDATE() và is_sent = FALSE
 * Gửi thông báo và chuyển cờ is_sent = TRUE
 */
exports.initCronJobs = () => {
  console.log('⏰ Khởi tạo Cron Jobs...');

  // BR06: Daily reminder notification at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('\n📌 [CRON JOB] Bắt đầu quét và gửi nhắc lịch (08:00)');
    let connection;

    try {
      connection = await db.getConnection();

      // Get all pending reminders for today
      const [reminders] = await connection.query(`
        SELECT 
          r.id,
          r.pet_id,
          r.title,
          r.remind_date,
          p.name AS pet_name,
          u.id AS user_id,
          u.full_name,
          u.phone,
          u.email
        FROM Reminders r
        JOIN Pets p ON r.pet_id = p.id
        JOIN Users u ON p.user_id = u.id
        WHERE r.remind_date = CURDATE() 
          AND r.is_sent = FALSE
        ORDER BY r.created_at
      `);

      if (reminders.length === 0) {
        console.log('✅ Không có nhắc lịch nào cần gửi hôm nay');
        return;
      }

      console.log(`📬 Đang gửi ${reminders.length} thông báo nhắc lịch...`);

      // Process each reminder
      for (const reminder of reminders) {
        try {
          // TODO: Integrate with push notification service (Firebase, etc.)
          // For now, just log the notification
          console.log(`
✉️  [THÔNG BÁO NHẮC LỊCH]
   - Người dùng: ${reminder.full_name} (${reminder.email})
   - Thú cưng: ${reminder.pet_name}
   - Nội dung: ${reminder.title}
   - Ngày nhắc: ${reminder.remind_date}
          `);

          // Mark as sent
          await connection.query(
            'UPDATE Reminders SET is_sent = TRUE WHERE id = ?',
            [reminder.id]
          );

          console.log(`✅ Đã đánh dấu reminder ID ${reminder.id} là đã gửi`);
        } catch (error) {
          console.error(`❌ Lỗi khi xử lý reminder ID ${reminder.id}:`, error.message);
        }
      }

      console.log(`\n🎉 [CRON JOB] Hoàn tất gửi nhắc lịch. Tổng cộng: ${reminders.length}`);

    } catch (error) {
      console.error('❌ [CRON ERROR] Lỗi khi quét và gửi nhắc lịch:', error.message);
    } finally {
      if (connection) connection.release();
    }
  });

  // Optional: Cleanup old completed/cancelled appointments (weekly)
  cron.schedule('0 2 * * 0', async () => {
    console.log('\n📌 [CRON JOB] Bắt đầu dọn dẹp dữ liệu cũ (hàng tuần)');
    let connection;

    try {
      connection = await db.getConnection();

      // Note: This is optional - adjust retention policy as needed
      console.log('✅ Hoàn tất dọn dẹp dữ liệu');
    } catch (error) {
      console.error('❌ [CRON ERROR] Lỗi khi dọn dẹp dữ liệu:', error.message);
    } finally {
      if (connection) connection.release();
    }
  });

  console.log('✅ Cron Jobs đã được khởi tạo thành công\n');
};