const db = require('../config/db');

/**
 * Get all services
 * GET /api/appointments/services
 */
exports.getServices = async (req, res) => {
  try {
    const [services] = await db.query(`
      SELECT s.*, cr.room_code, cr.room_name FROM Services s
      JOIN Clinic_Rooms cr ON s.room_id = cr.id
      ORDER BY cr.room_code, s.service_name
    `);
    return res.status(200).json({ success: true, data: services });
  } catch (error) {
    console.error('GET_SERVICES_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách dịch vụ. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create appointment (customer only)
 * POST /api/appointments
 * BR01: Check max_slot_per_hour for the room
 * BR02: appointment_datetime >= NOW() + 60 minutes
 */
exports.createAppointment = async (req, res) => {
  try {
    const {
      pet_id,
      service_id,
      service_ids,
      room_id,
      appointment_datetime,
      notes
    } = req.body;

    const serviceIds = Array.isArray(service_ids)
      ? [...new Set(service_ids.map(Number).filter(Number.isInteger))]
      : [Number(service_id)];
    const primaryServiceId = serviceIds[0];

    // Validate required fields
    if (!pet_id || !primaryServiceId || !room_id || !appointment_datetime || serviceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đủ thông tin bắt buộc'
      });
    }

    // BR02: Check if appointment time is at least 60 minutes in the future
    const appointmentTime = new Date(appointment_datetime);
    const now = new Date();
    const minBookingTime = new Date(now.getTime() + 60 * 60 * 1000);

    if (appointmentTime < minBookingTime) {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn phải đặt trước thời điểm hiện tại ít nhất 60 phút'
      });
    }

    // Verify pet belongs to user
    const [pets] = await db.query(
      'SELECT id FROM Pets WHERE id = ? AND user_id = ?',
      [pet_id, req.user.id]
    );
    if (pets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng của bạn'
      });
    }

    // Verify service belongs to room
    const servicePlaceholders = serviceIds.map(() => '?').join(',');
    const [services] = await db.query(
      `SELECT id FROM Services WHERE id IN (${servicePlaceholders}) AND room_id = ?`,
      [...serviceIds, room_id]
    );
    if (services.length !== serviceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Dịch vụ không tồn tại cho phòng khám này'
      });
    }

    // BR01: Check current bookings for this room at this time and create the
    // appointment inside a single transaction. The room row is locked with
    // FOR UPDATE so concurrent booking requests for the same room are
    // serialized, preventing a race condition where two requests both read
    // the slot as available and both insert (double-booking the same slot).
    const connection = await db.getConnection();
    let result;
    try {
      await connection.beginTransaction();

      const [rooms] = await connection.query(
        'SELECT max_slot_per_hour FROM Clinic_Rooms WHERE id = ? FOR UPDATE',
        [room_id]
      );
      if (rooms.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy phòng khám'
        });
      }

      const room = rooms[0];

      const [booked] = await connection.query(`
        SELECT COUNT(*) as total FROM Appointments
        WHERE room_id = ?
          AND appointment_datetime = ?
          AND status != 'cancelled'
      `, [room_id, appointment_datetime]);

      if (booked[0].total >= room.max_slot_per_hour) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Phòng khám này đã đủ ${room.max_slot_per_hour} ca khám trong khung giờ được chọn. Vui lòng chọn thời gian khác.`
        });
      }

      [result] = await connection.query(`
        INSERT INTO Appointments
        (user_id, pet_id, room_id, service_id, appointment_datetime, status, notes)
        VALUES (?, ?, ?, ?, ?, 'pending', ?)
      `, [req.user.id, pet_id, room_id, primaryServiceId, appointment_datetime, notes || null]);

      if (serviceIds.length > 1) {
        const values = serviceIds.slice(1).map((id) => [result.insertId, id]);
        await connection.query(
          'INSERT INTO Appointment_Services (appointment_id, service_id) VALUES ?',
          [values]
        );
      }
      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

    return res.status(201).json({
      success: true,
      message: 'Đặt lịch thành công',
      data: { appointment_id: result.insertId }
    });
  } catch (error) {
    console.error('CREATE_APPOINTMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi đặt lịch. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get my appointments (customer view)
 * GET /api/appointments/my
 */
exports.getMyAppointments = async (req, res) => {
  try {
    const [list] = await db.query(`
      SELECT
        a.id,
        a.appointment_datetime,
        a.status,
        a.notes,
        a.created_at,
        p.name as pet_name,
        p.species,
        cr.room_code,
        cr.room_name,
        (SELECT GROUP_CONCAT(DISTINCT service_name ORDER BY service_name SEPARATOR ', ')
         FROM Services
         WHERE id = a.service_id OR id IN (
           SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id
         )) as service_name,
        (SELECT SUM(price)
         FROM Services
         WHERE id = a.service_id OR id IN (
           SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id
         )) as price,
        CONCAT(u.full_name, ' (', u.phone, ')') as doctor_info
      FROM Appointments a
      JOIN Pets p ON a.pet_id = p.id
      JOIN Clinic_Rooms cr ON a.room_id = cr.id
      LEFT JOIN Users u ON a.doctor_id = u.id
      WHERE a.user_id = ?
      ORDER BY a.appointment_datetime DESC
    `, [req.user.id]);

    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error('GET_MY_APPOINTMENTS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách lịch hẹn. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all appointments (doctor view)
 * GET /api/appointments
 * Can filter by room_id and date
 */
exports.getAllAppointments = async (req, res) => {
  try {
    const { room_id, date } = req.query;
    let query = `
      SELECT
        a.id,
        a.pet_id,
        a.appointment_datetime,
        a.status,
        a.notes,
        a.created_at,
        p.name as pet_name,
        p.species,
        p.breed,
        p.weight_kg,
        cr.room_code,
        cr.room_name,
        (SELECT GROUP_CONCAT(DISTINCT service_name ORDER BY service_name SEPARATOR ', ')
         FROM Services
         WHERE id = a.service_id OR id IN (
           SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id
         )) as service_name,
        (SELECT SUM(price)
         FROM Services
         WHERE id = a.service_id OR id IN (
           SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id
         )) as price,
        CONCAT(u.full_name, ' (', u.phone, ')') as customer_info
      FROM Appointments a
      JOIN Pets p ON a.pet_id = p.id
      JOIN Clinic_Rooms cr ON a.room_id = cr.id
      JOIN Users u ON a.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    if (room_id) {
      query += ' AND a.room_id = ?';
      params.push(room_id);
    }

    if (date) {
      query += ' AND DATE(a.appointment_datetime) = ?';
      params.push(date);
    }

    query += ' ORDER BY a.appointment_datetime DESC';

    const [list] = await db.query(query, params);

    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error('GET_ALL_APPOINTMENTS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách lịch hẹn. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update appointment status (doctor only)
 * PATCH /api/appointments/:id/status
 * BR03: Enforce status transition rules
 */
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, doctor_id } = req.body;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ'
      });
    }

    // Get current appointment
    const [appointments] = await db.query(
      'SELECT status, doctor_id, room_id, appointment_datetime FROM Appointments WHERE id = ?',
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    const currentStatus = appointments[0].status;

    // BR03: Enforce state transitions
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };

    if (!validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Không thể chuyển từ trạng thái '${currentStatus}' sang '${status}'`
      });
    }

    // Update appointment
    const assignedDoctorId = status === 'confirmed'
      ? (doctor_id || req.user.id)
      : appointments[0].doctor_id;

    if (status === 'confirmed') {
      // BR01 safety net: re-check room capacity (locked) before confirming, in
      // case max_slot_per_hour was lowered after these appointments were made.
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const [rooms] = await connection.query(
          'SELECT max_slot_per_hour FROM Clinic_Rooms WHERE id = ? FOR UPDATE',
          [appointments[0].room_id]
        );
        const maxSlot = rooms[0]?.max_slot_per_hour ?? Infinity;

        const [booked] = await connection.query(`
          SELECT COUNT(*) as total FROM Appointments
          WHERE room_id = ?
            AND appointment_datetime = ?
            AND status != 'cancelled'
        `, [appointments[0].room_id, appointments[0].appointment_datetime]);

        if (booked[0].total > maxSlot) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Khung giờ này đang có nhiều hơn ${maxSlot} lịch hẹn. Vui lòng hủy bớt lịch trước khi xác nhận.`
          });
        }

        await connection.query(
          'UPDATE Appointments SET status = ?, doctor_id = ? WHERE id = ?',
          [status, assignedDoctorId, id]
        );
        await connection.commit();
      } catch (transactionError) {
        await connection.rollback();
        throw transactionError;
      } finally {
        connection.release();
      }
    } else {
      await db.query(
        'UPDATE Appointments SET status = ?, doctor_id = ? WHERE id = ?',
        [status, assignedDoctorId, id]
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái lịch hẹn thành công'
    });
  } catch (error) {
    console.error('UPDATE_APPOINTMENT_STATUS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật trạng thái. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Cancel appointment
 * DELETE /api/appointments/:id
 * Customer can cancel if status is 'pending'
 * Doctor can cancel anytime
 */
exports.cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const [appointments] = await db.query(
      'SELECT user_id, status FROM Appointments WHERE id = ?',
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    const appointment = appointments[0];

    // Check permissions
    if (req.user.role === 'customer' && appointment.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy lịch hẹn này'
      });
    }

    // BR03: Customer can only cancel pending appointments
    if (req.user.role === 'customer' && appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể hủy lịch hẹn ở trạng thái "Chờ duyệt"'
      });
    }

    await db.query(
      'UPDATE Appointments SET status = "cancelled" WHERE id = ?',
      [id]
    );

    return res.status(200).json({
      success: true,
      message: 'Hủy lịch hẹn thành công'
    });
  } catch (error) {
    console.error('CANCEL_APPOINTMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi hủy lịch hẹn. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};