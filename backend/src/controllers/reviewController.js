const db = require('../config/db');
const { getOwnRoomId } = require('../utils/doctorScope');

/**
 * Create a review for a completed appointment (customer, owner only)
 * POST /api/reviews
 * body: { appointment_id, rating, comment }
 */
exports.createReview = async (req, res) => {
  try {
    const { appointment_id, rating, comment } = req.body;

    const ratingNum = Number(rating);
    if (!appointment_id || !Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn lịch hẹn và số sao đánh giá từ 1 đến 5' });
    }

    const [appointments] = await db.query(
      'SELECT user_id, status FROM Appointments WHERE id = ?',
      [appointment_id]
    );
    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy lịch hẹn' });
    }
    if (appointments[0].user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn chỉ có thể đánh giá lịch hẹn của chính mình' });
    }
    if (appointments[0].status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể đánh giá sau khi lịch hẹn đã hoàn thành' });
    }

    await db.query(
      'INSERT INTO Appointment_Reviews (appointment_id, rating, comment) VALUES (?, ?, ?)',
      [appointment_id, ratingNum, comment || null]
    );

    return res.status(201).json({ success: true, message: 'Cảm ơn bạn đã đánh giá!' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Bạn đã đánh giá lịch hẹn này rồi' });
    }
    console.error('CREATE_REVIEW_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi gửi đánh giá. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * List reviews (doctor: chỉ đánh giá của phòng khám mình; admin: toàn viện)
 * GET /api/reviews
 */
exports.listReviews = async (req, res) => {
  try {
    let roomFilter = '';
    const params = [];

    if (req.user.role === 'doctor') {
      const ownRoomId = await getOwnRoomId(req.user.id);
      if (!ownRoomId) {
        return res.status(200).json({ success: true, data: [] });
      }
      roomFilter = 'AND a.room_id = ?';
      params.push(ownRoomId);
    }

    const [reviews] = await db.query(`
      SELECT
        ar.id, ar.appointment_id, ar.rating, ar.comment, ar.created_at,
        a.appointment_datetime, a.room_id,
        cr.room_code, cr.room_name,
        p.name as pet_name,
        u.full_name as customer_name
      FROM Appointment_Reviews ar
      JOIN Appointments a ON a.id = ar.appointment_id
      JOIN Clinic_Rooms cr ON cr.id = a.room_id
      JOIN Pets p ON p.id = a.pet_id
      JOIN Users u ON u.id = a.user_id
      WHERE 1=1 ${roomFilter}
      ORDER BY ar.created_at DESC
    `, params);

    return res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    console.error('LIST_REVIEWS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách đánh giá. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
