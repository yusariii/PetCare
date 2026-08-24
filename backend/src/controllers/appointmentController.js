const db = require('../config/db');

exports.getServices = async (req, res) => {
  try {
    const [services] = await db.query('SELECT * FROM Services');
    return res.status(200).json({ success: true, data: services });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createAppointment = async (req, res) => {
  try {
    const { pet_id, service_id, appointment_datetime, notes } = req.body;
    const MAX_CAPACITY_PER_SLOT = 3; // Quy tắc BR02

    const appointmentTime = new Date(appointment_datetime);
    const now = new Date();
    if (appointmentTime.getTime() < now.getTime() + 60 * 60 * 1000) {
      return res.status(400).json({ success: false, message: 'Lịch hẹn phải đặt trước thời điểm hiện tại ít nhất 60 phút' });
    }

    const [countRows] = await db.query(
      'SELECT COUNT(*) AS total FROM Appointments WHERE appointment_datetime = ? AND status != "cancelled"',
      [appointment_datetime]
    );
    if (countRows[0].total >= MAX_CAPACITY_PER_SLOT) {
      return res.status(400).json({ success: false, message: 'Khung giờ này đã kín lịch, vui lòng chọn thời gian khác' });
    }

    const [result] = await db.query(
      'INSERT INTO Appointments (user_id, pet_id, service_id, appointment_datetime, status, notes) VALUES (?, ?, ?, ?, "pending", ?)',
      [req.user.id, pet_id, service_id, appointment_datetime, notes || null]
    );

    return res.status(201).json({ success: true, message: 'Đặt lịch thành công', appointmentId: result.insertId });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyAppointments = async (req, res) => {
  try {
    const query = `
      SELECT a.*, s.service_name, s.price, p.name AS pet_name, r.rating, r.comment
      FROM Appointments a
      JOIN Services s ON a.service_id = s.id
      JOIN Pets p ON a.pet_id = p.id
      LEFT JOIN Reviews r ON a.id = r.appointment_id
      WHERE a.user_id = ?
      ORDER BY a.appointment_datetime DESC
    `;
    const [list] = await db.query(query, [req.user.id]);
    return res.status(200).json({ success: true, data: list });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; 

    await db.query('UPDATE Appointments SET status = ? WHERE id = ?', [status, id]);
    return res.status(200).json({ success: true, message: 'Cập nhật trạng thái thành công' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.reviewAppointment = async (req, res) => {
  try {
    const { appointment_id, rating, comment } = req.body;
    const [appts] = await db.query('SELECT status, user_id FROM Appointments WHERE id = ?', [appointment_id]);
    if (appts.length === 0 || appts[0].user_id !== req.user.id) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
    }
    if (appts[0].status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể đánh giá lịch hẹn đã hoàn thành' });
    }

    await db.query('INSERT INTO Reviews (appointment_id, rating, comment) VALUES (?, ?, ?)', [appointment_id, rating, comment]);
    return res.status(201).json({ success: true, message: 'Gửi đánh giá thành công' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};