const bcrypt = require('bcryptjs');
const db = require('../config/db');

/**
 * List all doctor accounts with their assigned room (admin only)
 * GET /api/admin/doctors
 */
exports.listDoctors = async (req, res) => {
  try {
    const [doctors] = await db.query(`
      SELECT u.id, u.full_name, u.email, u.phone, u.is_active, u.created_at,
        cr.id as room_id, cr.room_code, cr.room_name
      FROM Users u
      LEFT JOIN Clinic_Rooms cr ON cr.doctor_id = u.id
      WHERE u.role = 'doctor'
      ORDER BY u.created_at DESC
    `);
    return res.status(200).json({ success: true, data: doctors });
  } catch (error) {
    console.error('LIST_DOCTORS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách bác sĩ. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create a doctor account, optionally assigning a clinic room right away (admin only)
 * POST /api/admin/doctors
 */
exports.createDoctor = async (req, res) => {
  try {
    const { full_name, email, password, phone, room_id } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đủ thông tin' });
    }

    const [existing] = await db.query('SELECT id FROM Users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email đã tồn tại trên hệ thống' });
    }

    if (room_id) {
      const [roomTaken] = await db.query('SELECT id FROM Clinic_Rooms WHERE id = ? AND doctor_id IS NOT NULL', [room_id]);
      if (roomTaken.length > 0) {
        return res.status(400).json({ success: false, message: 'Phòng khám này đã có bác sĩ phụ trách' });
      }
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO Users (full_name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, "doctor")',
      [full_name, email, password_hash, phone || null]
    );

    if (room_id) {
      await db.query('UPDATE Clinic_Rooms SET doctor_id = ? WHERE id = ?', [result.insertId, room_id]);
    }

    return res.status(201).json({
      success: true,
      message: 'Tạo tài khoản bác sĩ thành công',
      data: { doctor_id: result.insertId }
    });
  } catch (error) {
    console.error('CREATE_DOCTOR_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo tài khoản bác sĩ. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update a doctor's profile info (admin only)
 * PUT /api/admin/doctors/:id
 */
exports.updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, phone } = req.body;

    const [result] = await db.query(
      `UPDATE Users SET full_name = COALESCE(?, full_name), phone = COALESCE(?, phone)
       WHERE id = ? AND role = 'doctor'`,
      [full_name || null, phone || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản bác sĩ' });
    }

    return res.status(200).json({ success: true, message: 'Cập nhật thông tin bác sĩ thành công' });
  } catch (error) {
    console.error('UPDATE_DOCTOR_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật thông tin bác sĩ. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Lock/unlock a doctor account (admin only)
 * PATCH /api/admin/doctors/:id/active
 * body: { is_active }
 */
exports.setDoctorActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp trạng thái is_active hợp lệ' });
    }

    const [result] = await db.query(
      "UPDATE Users SET is_active = ? WHERE id = ? AND role = 'doctor'",
      [is_active, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản bác sĩ' });
    }

    return res.status(200).json({
      success: true,
      message: is_active ? 'Đã mở khóa tài khoản bác sĩ' : 'Đã khóa tài khoản bác sĩ'
    });
  } catch (error) {
    console.error('SET_DOCTOR_ACTIVE_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật trạng thái tài khoản. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * List pharmacist accounts (admin only)
 * GET /api/admin/pharmacists
 */
exports.listPharmacists = async (req, res) => {
  try {
    const [pharmacists] = await db.query(`
      SELECT id, full_name, email, phone, is_active, created_at
      FROM Users
      WHERE role = 'pharmacist'
      ORDER BY created_at DESC
    `);
    return res.status(200).json({ success: true, data: pharmacists });
  } catch (error) {
    console.error('LIST_PHARMACISTS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách dược sĩ. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create a pharmacist account (admin only)
 * POST /api/admin/pharmacists
 */
exports.createPharmacist = async (req, res) => {
  try {
    const { full_name, email, password, phone } = req.body;
    if (!full_name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Vui lòng điền đủ thông tin' });
    }

    const [existing] = await db.query('SELECT id FROM Users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Email đã tồn tại trên hệ thống' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const [result] = await db.query(
      'INSERT INTO Users (full_name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, "pharmacist")',
      [full_name, email, password_hash, phone || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Tạo tài khoản dược sĩ thành công',
      data: { pharmacist_id: result.insertId }
    });
  } catch (error) {
    console.error('CREATE_PHARMACIST_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo tài khoản dược sĩ. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Lock/unlock a pharmacist account (admin only)
 * PATCH /api/admin/pharmacists/:id/active
 */
exports.setPharmacistActive = async (req, res) => {
  try {
    const { id } = req.params;
    const { is_active } = req.body;

    if (typeof is_active !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Vui lòng cung cấp trạng thái is_active hợp lệ' });
    }

    const [result] = await db.query(
      "UPDATE Users SET is_active = ? WHERE id = ? AND role = 'pharmacist'",
      [is_active, id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản dược sĩ' });
    }

    return res.status(200).json({
      success: true,
      message: is_active ? 'Đã mở khóa tài khoản dược sĩ' : 'Đã khóa tài khoản dược sĩ'
    });
  } catch (error) {
    console.error('SET_PHARMACIST_ACTIVE_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật trạng thái tài khoản. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
