const db = require('../config/db');

/**
 * Create a new health record (doctor only)
 * POST /api/health-records
 */
exports.createHealthRecord = async (req, res) => {
  try {
    const {
      pet_id,
      record_type,
      title,
      diagnosis,
      treatment_plan,
      performed_date,
      next_due_date
    } = req.body;

    // Validate required fields
    if (!pet_id || !record_type || !title || !diagnosis || !performed_date) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đủ thông tin bắt buộc'
      });
    }

    // Validate record_type
    const validTypes = ['vaccine', 'medical', 'deworming', 'surgery'];
    if (!validTypes.includes(record_type)) {
      return res.status(400).json({
        success: false,
        message: 'Loại bệnh án không hợp lệ'
      });
    }

    // Verify pet exists
    const [pets] = await db.query('SELECT id FROM Pets WHERE id = ?', [pet_id]);
    if (pets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng'
      });
    }

    // Create health record
    const [result] = await db.query(`
      INSERT INTO Health_Records 
      (pet_id, doctor_id, record_type, title, diagnosis, treatment_plan, performed_date, next_due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      pet_id,
      req.user.id,
      record_type,
      title,
      diagnosis,
      treatment_plan || null,
      performed_date,
      next_due_date || null
    ]);

    // BR04: If next_due_date is set, create reminder automatically
    if (next_due_date) {
      await db.query(`
        INSERT INTO Reminders (pet_id, title, remind_date, is_sent)
        VALUES (?, ?, ?, FALSE)
      `, [
        pet_id,
        `Nhắc tái khám: ${title}`,
        next_due_date
      ]);
    }

    return res.status(201).json({
      success: true,
      message: 'Lập bệnh án thành công',
      data: { record_id: result.insertId }
    });
  } catch (error) {
    console.error('CREATE_HEALTH_RECORD_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lập bệnh án. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get health records for a pet
 * GET /api/health-records/pet/:pet_id
 */
exports.getPetHealthRecords = async (req, res) => {
  try {
    const { pet_id } = req.params;

    // Verify pet belongs to user (if customer)
    if (req.user.role === 'customer') {
      const [pets] = await db.query(
        'SELECT id FROM Pets WHERE id = ? AND user_id = ?',
        [pet_id, req.user.id]
      );
      if (pets.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền truy cập thông tin này'
        });
      }
    } else {
      // Verify pet exists for doctor
      const [pets] = await db.query('SELECT id FROM Pets WHERE id = ?', [pet_id]);
      if (pets.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy thú cưng'
        });
      }
    }

    const [records] = await db.query(`
      SELECT 
        hr.*,
        CONCAT(u.full_name, ' (', u.email, ')') as doctor_info
      FROM Health_Records hr
      JOIN Users u ON hr.doctor_id = u.id
      WHERE hr.pet_id = ?
      ORDER BY hr.performed_date DESC, hr.created_at DESC
    `, [pet_id]);

    return res.status(200).json({
      success: true,
      data: records
    });
  } catch (error) {
    console.error('GET_HEALTH_RECORDS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử bệnh án. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all reminders for a pet
 * GET /api/health-records/reminders/:pet_id
 */
exports.getPetReminders = async (req, res) => {
  try {
    const { pet_id } = req.params;

    // Verify pet belongs to user (if customer)
    if (req.user.role === 'customer') {
      const [pets] = await db.query(
        'SELECT id FROM Pets WHERE id = ? AND user_id = ?',
        [pet_id, req.user.id]
      );
      if (pets.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền truy cập thông tin này'
        });
      }
    }

    const [reminders] = await db.query(`
      SELECT * FROM Reminders
      WHERE pet_id = ?
      ORDER BY remind_date DESC
    `, [pet_id]);

    return res.status(200).json({
      success: true,
      data: reminders
    });
  } catch (error) {
    console.error('GET_REMINDERS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách nhắc lịch. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get pending reminders for today (for cron job)
 * GET /api/health-records/reminders/pending/today
 */
exports.getPendingReminders = async (req, res) => {
  try {
    const [reminders] = await db.query(`
      SELECT 
        r.*,
        p.name as pet_name,
        CONCAT(u.full_name, ' (', u.phone, ')') as owner_info,
        u.id as user_id
      FROM Reminders r
      JOIN Pets p ON r.pet_id = p.id
      JOIN Users u ON p.user_id = u.id
      WHERE r.remind_date = CURDATE()
        AND r.is_sent = FALSE
    `);

    return res.status(200).json({
      success: true,
      data: reminders
    });
  } catch (error) {
    console.error('GET_PENDING_REMINDERS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách nhắc lịch chờ xử lý.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Mark reminder as sent (for cron job)
 * PATCH /api/health-records/reminders/:reminder_id/mark-sent
 */
exports.markReminderAsSent = async (req, res) => {
  try {
    const { reminder_id } = req.params;

    const [result] = await db.query(
      'UPDATE Reminders SET is_sent = TRUE WHERE id = ?',
      [reminder_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhắc lịch'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Nhắc lịch đã được đánh dấu là đã gửi'
    });
  } catch (error) {
    console.error('MARK_REMINDER_SENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật trạng thái nhắc lịch.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
