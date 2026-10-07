const db = require('../config/db');

/**
 * Get all clinic rooms with their services
 * GET /api/rooms
 */
exports.getAllRooms = async (req, res) => {
  try {
    const [rooms] = await db.query(`
      SELECT
        cr.id, cr.room_code, cr.room_name, cr.floor,
        cr.coordinate_x, cr.coordinate_y, cr.max_slot_per_hour, cr.description,
        cr.doctor_id, u.full_name as doctor_name
      FROM Clinic_Rooms cr
      LEFT JOIN Users u ON u.id = cr.doctor_id
      ORDER BY cr.floor, cr.coordinate_x
    `);

    if (rooms.length > 0) {
      const roomIds = rooms.map((room) => room.id);
      const placeholders = roomIds.map(() => '?').join(',');
      const [services] = await db.query(`
        SELECT id, room_id, service_name, description, price, duration_minutes
        FROM Services
        WHERE room_id IN (${placeholders})
        ORDER BY service_name
      `, roomIds);

      const servicesByRoom = services.reduce((grouped, service) => {
        if (!grouped[service.room_id]) grouped[service.room_id] = [];
        grouped[service.room_id].push({
          id: service.id,
          service_name: service.service_name,
          description: service.description,
          price: service.price,
          duration_minutes: service.duration_minutes
        });
        return grouped;
      }, {});

      rooms.forEach((room) => {
        room.services = servicesByRoom[room.id] || [];
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: rooms 
    });
  } catch (error) {
    console.error('GET_ROOMS_ERROR:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi lấy danh sách phòng khám. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get room details with availability
 * GET /api/rooms/:id/availability?date=2024-01-15
 */
exports.getRoomAvailability = async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ 
        success: false, 
        message: 'Vui lòng cung cấp tham số date (YYYY-MM-DD)' 
      });
    }

    // Kiểm tra phòng tồn tại
    const [rooms] = await db.query('SELECT * FROM Clinic_Rooms WHERE id = ?', [id]);
    if (rooms.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Không tìm thấy phòng khám' 
      });
    }

    const room = rooms[0];

    // Lấy các lịch hẹn của ngày đó
    const [appointments] = await db.query(`
      SELECT 
        appointment_datetime,
        COUNT(*) as booked_count
      FROM Appointments
      WHERE room_id = ? 
        AND DATE(appointment_datetime) = ?
        AND status != 'cancelled'
      GROUP BY DATE(appointment_datetime), HOUR(appointment_datetime)
      ORDER BY appointment_datetime
    `, [id, date]);

    // Tính toán các slot trống
    const bookedMap = {};
    appointments.forEach(apt => {
      const hour = new Date(apt.appointment_datetime).toISOString().slice(0, 13);
      bookedMap[hour] = apt.booked_count;
    });

    const availableSlots = [];
    for (let hour = 8; hour < 18; hour++) {
      const hourStr = hour.toString().padStart(2, '0');
      const slotKey = `${date}T${hourStr}`;
      const booked = bookedMap[slotKey] || 0;
      const available = Math.max(0, room.max_slot_per_hour - booked);
      
      availableSlots.push({
        time: `${hourStr}:00`,
        booked,
        available,
        isFull: available === 0
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: {
        room_id: id,
        room_code: room.room_code,
        room_name: room.room_name,
        max_slot_per_hour: room.max_slot_per_hour,
        date,
        slots: availableSlots
      }
    });
  } catch (error) {
    console.error('GET_AVAILABILITY_ERROR:', error.message);
    return res.status(500).json({ 
      success: false, 
      message: 'Lỗi khi kiểm tra lịch trống. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * BR08: Get live occupancy status for all rooms
 * GET /api/rooms/live-occupancy
 */
exports.getLiveRoomsOccupancy = async (req, res) => {
  try {
    const [rooms] = await db.query(`
      SELECT
        id, room_code, room_name, floor,
        coordinate_x, coordinate_y, max_slot_per_hour, description
      FROM Clinic_Rooms
      ORDER BY floor ASC, room_code ASC
    `);

    // Ca hẹn đang hoạt động trong khung ±30 phút quanh thời điểm hiện tại
    const [bookings] = await db.query(`
      SELECT room_id, COUNT(*) as current_bookings
      FROM Appointments
      WHERE status IN ('pending', 'confirmed')
        AND appointment_datetime BETWEEN DATE_SUB(NOW(), INTERVAL 30 MINUTE) AND DATE_ADD(NOW(), INTERVAL 30 MINUTE)
      GROUP BY room_id
    `);

    const bookingsByRoom = bookings.reduce((map, row) => {
      map[row.room_id] = row.current_bookings;
      return map;
    }, {});

    const data = rooms.map((room) => {
      const currentBookings = bookingsByRoom[room.id] || 0;
      const maxSlot = room.max_slot_per_hour || 1;
      const occupancyRatio = maxSlot > 0 ? currentBookings / maxSlot : 0;

      let statusIndicator = 'available';
      let statusLabel = 'Trống chỗ';
      if (occupancyRatio >= 1.0) {
        statusIndicator = 'full';
        statusLabel = 'Kín lịch';
      } else if (occupancyRatio >= 0.5) {
        statusIndicator = 'busy';
        statusLabel = 'Đang tiếp nhận';
      }

      return {
        ...room,
        current_bookings: currentBookings,
        occupancy_ratio: Number(occupancyRatio.toFixed(2)),
        status_indicator: statusIndicator,
        status_label: statusLabel
      };
    });

    return res.status(200).json({
      success: true,
      data
    });
  } catch (error) {
    console.error('GET_LIVE_ROOMS_OCCUPANCY_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tải dữ liệu mật độ phòng khám. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get services for a specific room
 * GET /api/rooms/:id/services
 */
exports.getRoomServices = async (req, res) => {
  try {
    const { id } = req.params;

    const [services] = await db.query(`
      SELECT s.* FROM Services s
      WHERE s.room_id = ?
      ORDER BY s.service_name
    `, [id]);

    if (services.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Phòng khám này không có dịch vụ nào' 
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: services 
    });
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
 * Get the clinic room assigned to the signed-in doctor
 * GET /api/rooms/my-room
 */
exports.getMyRoom = async (req, res) => {
  try {
    const [rooms] = await db.query('SELECT * FROM Clinic_Rooms WHERE doctor_id = ?', [req.user.id]);
    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Bạn chưa được admin phân công phòng khám'
      });
    }
    return res.status(200).json({ success: true, data: rooms[0] });
  } catch (error) {
    console.error('GET_MY_ROOM_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin phòng khám. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create a clinic room (admin only)
 * POST /api/rooms
 */
exports.createRoom = async (req, res) => {
  try {
    const { room_code, room_name, floor, coordinate_x, coordinate_y, max_slot_per_hour, description } = req.body;

    if (!room_code || !room_name) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập mã phòng và tên phòng' });
    }

    const [result] = await db.query(
      `INSERT INTO Clinic_Rooms (room_code, room_name, floor, coordinate_x, coordinate_y, max_slot_per_hour, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [room_code, room_name, floor || 1, coordinate_x || 0, coordinate_y || 0, max_slot_per_hour || 2, description || null]
    );

    return res.status(201).json({ success: true, message: 'Tạo phòng khám thành công', data: { room_id: result.insertId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Mã phòng đã tồn tại' });
    }
    console.error('CREATE_ROOM_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo phòng khám. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update a clinic room (admin only)
 * PUT /api/rooms/:id
 */
exports.updateRoom = async (req, res) => {
  try {
    const { id } = req.params;
    const { room_name, floor, coordinate_x, coordinate_y, max_slot_per_hour, description } = req.body;

    const [result] = await db.query(
      `UPDATE Clinic_Rooms SET
        room_name = COALESCE(?, room_name),
        floor = COALESCE(?, floor),
        coordinate_x = COALESCE(?, coordinate_x),
        coordinate_y = COALESCE(?, coordinate_y),
        max_slot_per_hour = COALESCE(?, max_slot_per_hour),
        description = COALESCE(?, description)
       WHERE id = ?`,
      [room_name || null, floor || null, coordinate_x ?? null, coordinate_y ?? null, max_slot_per_hour || null, description || null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phòng khám' });
    }

    return res.status(200).json({ success: true, message: 'Cập nhật phòng khám thành công' });
  } catch (error) {
    console.error('UPDATE_ROOM_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật phòng khám. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Assign (or unassign) the doctor responsible for a room - 1 doctor : 1 room (admin only)
 * PATCH /api/rooms/:id/assign-doctor
 */
exports.assignDoctor = async (req, res) => {
  try {
    const { id } = req.params;
    const { doctor_id } = req.body;

    const [rooms] = await db.query('SELECT id FROM Clinic_Rooms WHERE id = ?', [id]);
    if (rooms.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy phòng khám' });
    }

    if (doctor_id === null || doctor_id === undefined) {
      await db.query('UPDATE Clinic_Rooms SET doctor_id = NULL WHERE id = ?', [id]);
      return res.status(200).json({ success: true, message: 'Đã gỡ bác sĩ phụ trách khỏi phòng khám' });
    }

    const [doctors] = await db.query("SELECT id FROM Users WHERE id = ? AND role = 'doctor'", [doctor_id]);
    if (doctors.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy tài khoản bác sĩ' });
    }

    const [existingAssignment] = await db.query(
      'SELECT id, room_name FROM Clinic_Rooms WHERE doctor_id = ? AND id != ?',
      [doctor_id, id]
    );
    if (existingAssignment.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bác sĩ này đã phụ trách phòng "${existingAssignment[0].room_name}". Mỗi bác sĩ chỉ được phụ trách 1 phòng.`
      });
    }

    await db.query('UPDATE Clinic_Rooms SET doctor_id = ? WHERE id = ?', [doctor_id, id]);
    return res.status(200).json({ success: true, message: 'Gán bác sĩ phụ trách phòng khám thành công' });
  } catch (error) {
    console.error('ASSIGN_DOCTOR_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi gán bác sĩ phụ trách. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
