const db = require('../config/db');
const { getOwnRoomId } = require('../utils/doctorScope');

let tablesEnsured = false;

/**
 * Đảm bảo bảng Invoices và Invoice_Items luôn tồn tại kể cả khi server chưa khởi động lại
 */
const ensureInvoiceTables = async () => {
  if (tablesEnsured) return;
  await db.query(`
    CREATE TABLE IF NOT EXISTS Invoices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_code VARCHAR(30) NOT NULL UNIQUE,
      invoice_type ENUM('appointment', 'walk_in') NOT NULL DEFAULT 'appointment',
      appointment_id INT NULL UNIQUE,
      user_id INT NULL,
      pet_id INT NULL,
      room_id INT NOT NULL,
      doctor_id INT NOT NULL,
      customer_name VARCHAR(100) NOT NULL,
      customer_phone VARCHAR(20) NULL,
      pet_name VARCHAR(50) NULL,
      pet_species ENUM('dog', 'cat', 'other') NOT NULL DEFAULT 'dog',
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      payment_status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES Appointments(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
      FOREIGN KEY (pet_id) REFERENCES Pets(id) ON DELETE SET NULL,
      FOREIGN KEY (room_id) REFERENCES Clinic_Rooms(id) ON DELETE RESTRICT,
      FOREIGN KEY (doctor_id) REFERENCES Users(id) ON DELETE RESTRICT,
      INDEX idx_invoice_type (invoice_type),
      INDEX idx_room_created (room_id, created_at),
      INDEX idx_doctor_id (doctor_id),
      INDEX idx_user_id (user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const alterQueries = [
    "ALTER TABLE Invoices ADD COLUMN payment_status ENUM('pending', 'paid') NOT NULL DEFAULT 'paid' AFTER total_amount",
    'ALTER TABLE Invoices ADD COLUMN user_id INT NULL AFTER appointment_id',
    'ALTER TABLE Invoices ADD COLUMN pet_id INT NULL AFTER user_id'
  ];
  for (const q of alterQueries) {
    try {
      await db.query(q);
    } catch (alterError) {
      if (alterError.code !== 'ER_DUP_FIELDNAME') {
        // ignore
      }
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS Invoice_Items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      invoice_id INT NOT NULL,
      service_id INT NOT NULL,
      service_name VARCHAR(100) NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (invoice_id) REFERENCES Invoices(id) ON DELETE CASCADE,
      FOREIGN KEY (service_id) REFERENCES Services(id) ON DELETE RESTRICT,
      INDEX idx_invoice_id (invoice_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  tablesEnsured = true;
};

exports.ensureInvoiceTables = ensureInvoiceTables;

/**
 * Tạo mã hóa đơn duy nhất: HD-YYYYMMDD-XXXX
 */
const generateInvoiceCode = (prefix = 'HD') => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}${d}-${rand}`;
};

/**
 * Helper lấy chi tiết đầy đủ 1 hóa đơn theo ID
 */
const fetchFullInvoice = async (invoiceId, conn = db) => {
  const [invoices] = await conn.query(
    `SELECT
       inv.*,
       cr.room_code,
       cr.room_name,
       u.full_name as doctor_name
     FROM Invoices inv
     JOIN Clinic_Rooms cr ON cr.id = inv.room_id
     LEFT JOIN Users u ON u.id = inv.doctor_id
     WHERE inv.id = ?`,
    [invoiceId]
  );

  if (invoices.length === 0) return null;
  const invoice = invoices[0];

  const [items] = await conn.query(
    `SELECT id, service_id, service_name, unit_price
     FROM Invoice_Items
     WHERE invoice_id = ?
     ORDER BY id ASC`,
    [invoiceId]
  );

  invoice.items = items;
  return invoice;
};

/**
 * Lấy thông tin phòng khám của bác sĩ đang đăng nhập kèm danh sách dịch vụ của phòng đó
 * GET /api/invoices/my-room-services
 */
exports.getMyRoomServices = async (req, res) => {
  try {
    await ensureInvoiceTables();
    let roomId = req.query.room_id ? Number(req.query.room_id) : null;

    if (req.user.role === 'doctor') {
      const ownRoomId = await getOwnRoomId(req.user.id);
      if (!ownRoomId) {
        return res.status(404).json({
          success: false,
          message: 'Bạn chưa được phân công phụ trách phòng khám nào'
        });
      }
      roomId = ownRoomId;
    }

    if (!roomId) {
      const [firstRoom] = await db.query('SELECT id FROM Clinic_Rooms ORDER BY id ASC LIMIT 1');
      if (firstRoom.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy phòng khám'
        });
      }
      roomId = firstRoom[0].id;
    }

    const [rooms] = await db.query(
      `SELECT cr.id, cr.room_code, cr.room_name, cr.floor, cr.description,
              cr.doctor_id, u.full_name as doctor_name
       FROM Clinic_Rooms cr
       LEFT JOIN Users u ON u.id = cr.doctor_id
       WHERE cr.id = ?`,
      [roomId]
    );

    if (rooms.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy phòng khám'
      });
    }

    const [services] = await db.query(
      `SELECT id, room_id, service_name, description, price, duration_minutes
       FROM Services
       WHERE room_id = ?
       ORDER BY id ASC`,
      [roomId]
    );

    return res.status(200).json({
      success: true,
      data: {
        room: rooms[0],
        services
      }
    });
  } catch (error) {
    console.error('GET_MY_ROOM_SERVICES_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tải danh sách dịch vụ phòng khám',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Tạo hoặc cập nhật hóa đơn cho lịch khám đã hoàn thành
 * POST /api/invoices/appointment
 * Body: { appointment_id, service_ids: [1, 2], notes }
 */
exports.createOrUpdateAppointmentInvoice = async (req, res) => {
  let connection;
  try {
    await ensureInvoiceTables();
    const { appointment_id, service_ids, notes } = req.body;

    if (!appointment_id) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu mã lịch khám (appointment_id)'
      });
    }

    const uniqueServiceIds = Array.isArray(service_ids)
      ? [...new Set(service_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
      : [];

    if (uniqueServiceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 dịch vụ để tạo hóa đơn thanh toán'
      });
    }

    const [appointments] = await db.query(
      `SELECT
         a.id, a.room_id, a.status, a.pet_id, a.user_id,
         p.name as pet_name, p.species as pet_species,
         u.full_name as customer_name, u.phone as customer_phone
       FROM Appointments a
       JOIN Pets p ON p.id = a.pet_id
       JOIN Users u ON u.id = a.user_id
       WHERE a.id = ?`,
      [appointment_id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch khám'
      });
    }

    const appointment = appointments[0];

    if (req.user.role === 'doctor') {
      const ownRoomId = await getOwnRoomId(req.user.id);
      if (!ownRoomId || ownRoomId !== appointment.room_id) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chỉ có thể tạo hóa đơn cho ca khám thuộc phòng mình phụ trách'
        });
      }
    }

    if (appointment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể tạo hóa đơn cho ca khám đã hoàn thành'
      });
    }

    const placeholders = uniqueServiceIds.map(() => '?').join(',');
    const [services] = await db.query(
      `SELECT id, room_id, service_name, price
       FROM Services
       WHERE id IN (${placeholders}) AND room_id = ?
       ORDER BY id ASC`,
      [...uniqueServiceIds, appointment.room_id]
    );

    if (services.length !== uniqueServiceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Có dịch vụ không hợp lệ hoặc không thuộc phòng khám của ca này'
      });
    }

    const totalAmount = services.reduce((sum, s) => sum + Number(s.price || 0), 0);
    const normalizedSpecies = ['dog', 'cat', 'other'].includes(appointment.pet_species)
      ? appointment.pet_species
      : 'other';

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Kiểm tra xem lịch khám đã có hóa đơn chưa
    const [existingInvoices] = await connection.query(
      'SELECT id, invoice_code, payment_status FROM Invoices WHERE appointment_id = ?',
      [appointment.id]
    );

    if (existingInvoices.length > 0 && existingInvoices[0].payment_status === 'paid') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Hóa đơn của lịch khám này đã hoàn tất thanh toán, không thể chỉnh sửa'
      });
    }

    // Đồng bộ lại các dịch vụ thực tế đã làm cho lịch khám này
    await connection.query(
      'UPDATE Appointments SET service_id = ? WHERE id = ?',
      [uniqueServiceIds[0], appointment.id]
    );
    await connection.query(
      'DELETE FROM Appointment_Services WHERE appointment_id = ?',
      [appointment.id]
    );
    const appointmentServiceValues = uniqueServiceIds.map((sid) => [appointment.id, sid]);
    await connection.query(
      'INSERT IGNORE INTO Appointment_Services (appointment_id, service_id) VALUES ?',
      [appointmentServiceValues]
    );

    let invoiceId;
    if (existingInvoices.length > 0) {
      invoiceId = existingInvoices[0].id;
      await connection.query(
        `UPDATE Invoices
         SET user_id = ?,
             pet_id = ?,
             doctor_id = ?,
             customer_name = ?,
             customer_phone = ?,
             pet_name = ?,
             pet_species = ?,
             total_amount = ?,
             payment_status = 'pending',
             notes = ?
         WHERE id = ?`,
        [
          appointment.user_id || null,
          appointment.pet_id || null,
          req.user.id,
          appointment.customer_name,
          appointment.customer_phone || null,
          appointment.pet_name || null,
          normalizedSpecies,
          totalAmount,
          notes ? notes.trim() : null,
          invoiceId
        ]
      );
      await connection.query('DELETE FROM Invoice_Items WHERE invoice_id = ?', [invoiceId]);
    } else {
      const invoiceCode = generateInvoiceCode('HD');
      const [insertRes] = await connection.query(
        `INSERT INTO Invoices (
           invoice_code, invoice_type, appointment_id, user_id, pet_id, room_id, doctor_id,
           customer_name, customer_phone, pet_name, pet_species, total_amount, payment_status, notes
         ) VALUES (?, 'appointment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          invoiceCode,
          appointment.id,
          appointment.user_id || null,
          appointment.pet_id || null,
          appointment.room_id,
          req.user.id,
          appointment.customer_name,
          appointment.customer_phone || null,
          appointment.pet_name || null,
          normalizedSpecies,
          totalAmount,
          notes ? notes.trim() : null
        ]
      );
      invoiceId = insertRes.insertId;
    }

    const itemValues = services.map((s) => [invoiceId, s.id, s.service_name, Number(s.price)]);
    await connection.query(
      'INSERT INTO Invoice_Items (invoice_id, service_id, service_name, unit_price) VALUES ?',
      [itemValues]
    );

    await connection.commit();

    const fullInvoice = await fetchFullInvoice(invoiceId);

    return res.status(200).json({
      success: true,
      message: 'Tạo hóa đơn thanh toán thành công',
      data: fullInvoice
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('CREATE_APPOINTMENT_INVOICE_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo hóa đơn thanh toán. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Tra cứu khách hàng đã có tài khoản theo Số điện thoại kèm danh sách thú cưng của họ
 * GET /api/invoices/lookup-customer?phone=090...
 */
exports.lookupCustomerByPhone = async (req, res) => {
  try {
    await ensureInvoiceTables();
    const rawPhone = req.query.phone ? String(req.query.phone).trim() : '';
    if (!rawPhone) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập số điện thoại cần tra cứu'
      });
    }

    const cleanDigits = rawPhone.replace(/\s+/g, '');
    const [users] = await db.query(
      `SELECT id, full_name, email, phone, role
       FROM Users
       WHERE REPLACE(phone, ' ', '') = ? AND is_active = TRUE
       ORDER BY (role = 'customer') DESC, id ASC
       LIMIT 1`,
      [cleanDigits]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy tài khoản khách hàng với số điện thoại này'
      });
    }

    const customer = users[0];
    const [pets] = await db.query(
      `SELECT id, name, species, breed, weight_kg, birth_date, gender
       FROM Pets
       WHERE user_id = ?
       ORDER BY id ASC`,
      [customer.id]
    );

    return res.status(200).json({
      success: true,
      data: {
        user: customer,
        pets
      }
    });
  } catch (error) {
    console.error('LOOKUP_CUSTOMER_BY_PHONE_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tra cứu thông tin khách hàng'
    });
  }
};

/**
 * Tạo hóa đơn cho khách khám vãng lai (không đặt lịch trước)
 * Hỗ trợ liên kết tài khoản (user_id, pet_id) nếu tra cứu qua SĐT
 * POST /api/invoices/walk-in
 * Body: { customer_name, customer_phone?, user_id?, pet_id?, pet_name?, pet_species, service_ids: [1, 2], notes, room_id? }
 */
exports.createWalkInInvoice = async (req, res) => {
  let connection;
  try {
    await ensureInvoiceTables();
    const {
      customer_name,
      customer_phone,
      user_id,
      pet_id,
      pet_name,
      pet_species,
      service_ids,
      notes,
      room_id
    } = req.body;

    if (!customer_name || !String(customer_name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên khách hàng'
      });
    }

    let linkedUserId = user_id ? Number(user_id) : null;
    let linkedPetId = pet_id ? Number(pet_id) : null;
    let finalCustomerName = String(customer_name).trim();
    let finalCustomerPhone = customer_phone && String(customer_phone).trim() ? String(customer_phone).trim() : null;
    let finalPetName = pet_name && String(pet_name).trim() ? String(pet_name).trim() : null;
    let normalizedSpecies = ['dog', 'cat', 'other'].includes(pet_species) ? pet_species : 'other';

    if (linkedUserId) {
      const [uRows] = await db.query('SELECT id, full_name, phone FROM Users WHERE id = ?', [linkedUserId]);
      if (uRows.length > 0) {
        finalCustomerName = finalCustomerName || uRows[0].full_name;
        finalCustomerPhone = finalCustomerPhone || uRows[0].phone || null;
      } else {
        linkedUserId = null;
      }
    }

    if (linkedPetId) {
      const [pRows] = await db.query('SELECT id, user_id, name, species FROM Pets WHERE id = ?', [linkedPetId]);
      if (pRows.length > 0) {
        finalPetName = pRows[0].name;
        if (['dog', 'cat', 'other'].includes(pRows[0].species)) {
          normalizedSpecies = pRows[0].species;
        }
        if (!linkedUserId && pRows[0].user_id) {
          linkedUserId = pRows[0].user_id;
        }
      } else {
        linkedPetId = null;
      }
    }

    const uniqueServiceIds = Array.isArray(service_ids)
      ? [...new Set(service_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
      : [];

    if (uniqueServiceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 dịch vụ đã thực hiện'
      });
    }

    let targetRoomId = room_id ? Number(room_id) : null;
    if (req.user.role === 'doctor') {
      const ownRoomId = await getOwnRoomId(req.user.id);
      if (!ownRoomId) {
        return res.status(400).json({
          success: false,
          message: 'Bạn chưa được phân công phụ trách phòng khám nào'
        });
      }
      targetRoomId = ownRoomId;
    }

    if (!targetRoomId) {
      return res.status(400).json({
        success: false,
        message: 'Không xác định được phòng khám để tạo hóa đơn'
      });
    }

    const placeholders = uniqueServiceIds.map(() => '?').join(',');
    const [services] = await db.query(
      `SELECT id, room_id, service_name, price
       FROM Services
       WHERE id IN (${placeholders}) AND room_id = ?
       ORDER BY id ASC`,
      [...uniqueServiceIds, targetRoomId]
    );

    if (services.length !== uniqueServiceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Có dịch vụ không hợp lệ hoặc không thuộc phòng khám hiện tại'
      });
    }

    const totalAmount = services.reduce((sum, s) => sum + Number(s.price || 0), 0);

    connection = await db.getConnection();
    await connection.beginTransaction();

    const invoiceCode = generateInvoiceCode('VL');
    const [insertRes] = await connection.query(
      `INSERT INTO Invoices (
         invoice_code, invoice_type, appointment_id, user_id, pet_id, room_id, doctor_id,
         customer_name, customer_phone, pet_name, pet_species, total_amount, payment_status, notes
       ) VALUES (?, 'walk_in', NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        invoiceCode,
        linkedUserId,
        linkedPetId,
        targetRoomId,
        req.user.id,
        finalCustomerName,
        finalCustomerPhone,
        finalPetName,
        normalizedSpecies,
        totalAmount,
        notes ? String(notes).trim() : null
      ]
    );

    const invoiceId = insertRes.insertId;
    const itemValues = services.map((s) => [invoiceId, s.id, s.service_name, Number(s.price)]);
    await connection.query(
      'INSERT INTO Invoice_Items (invoice_id, service_id, service_name, unit_price) VALUES ?',
      [itemValues]
    );

    await connection.commit();

    const fullInvoice = await fetchFullInvoice(invoiceId);

    return res.status(201).json({
      success: true,
      message: 'Tạo hóa đơn khách vãng lai thành công',
      data: fullInvoice
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('CREATE_WALKIN_INVOICE_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo hóa đơn thanh toán. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Xác nhận hoàn tất thanh toán cho hóa đơn
 * PATCH /api/invoices/:id/pay
 */
exports.confirmInvoicePayment = async (req, res) => {
  try {
    await ensureInvoiceTables();
    const { id } = req.params;

    const [rows] = await db.query(
      'SELECT id, room_id, payment_status FROM Invoices WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hóa đơn'
      });
    }

    if (req.user.role === 'doctor') {
      const ownRoomId = await getOwnRoomId(req.user.id);
      if (!ownRoomId || ownRoomId !== rows[0].room_id) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xác nhận hóa đơn của phòng khám khác'
        });
      }
    }

    await db.query(
      "UPDATE Invoices SET payment_status = 'paid' WHERE id = ?",
      [id]
    );

    const fullInvoice = await fetchFullInvoice(id);
    return res.status(200).json({
      success: true,
      message: 'Đã xác nhận hoàn tất thanh toán hóa đơn',
      data: fullInvoice
    });
  } catch (error) {
    console.error('CONFIRM_INVOICE_PAYMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xác nhận thanh toán hóa đơn',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Lấy hóa đơn theo appointment_id
 * GET /api/invoices/appointment/:appointmentId
 */
exports.getInvoiceByAppointment = async (req, res) => {
  try {
    await ensureInvoiceTables();
    const { appointmentId } = req.params;

    const [rows] = await db.query(
      'SELECT id FROM Invoices WHERE appointment_id = ?',
      [appointmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Lịch khám này chưa có hóa đơn'
      });
    }

    const invoice = await fetchFullInvoice(rows[0].id);
    return res.status(200).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    console.error('GET_INVOICE_BY_APPOINTMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tải hóa đơn',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Lấy danh sách hóa đơn của phòng bác sĩ (hoặc toàn viện nếu admin)
 * GET /api/invoices
 */
exports.getInvoices = async (req, res) => {
  try {
    await ensureInvoiceTables();
    const { invoice_type, date } = req.query;
    let roomId = req.query.room_id ? Number(req.query.room_id) : null;

    if (req.user.role === 'doctor') {
      const ownRoomId = await getOwnRoomId(req.user.id);
      if (!ownRoomId) {
        return res.status(200).json({ success: true, data: [] });
      }
      roomId = ownRoomId;
    }

    let query = `
      SELECT
        inv.*,
        cr.room_code,
        cr.room_name,
        u.full_name as doctor_name
      FROM Invoices inv
      JOIN Clinic_Rooms cr ON cr.id = inv.room_id
      LEFT JOIN Users u ON u.id = inv.doctor_id
      WHERE 1=1
    `;
    const params = [];

    if (roomId) {
      query += ' AND inv.room_id = ?';
      params.push(roomId);
    }

    if (invoice_type && ['appointment', 'walk_in'].includes(invoice_type)) {
      query += ' AND inv.invoice_type = ?';
      params.push(invoice_type);
    }

    if (date) {
      query += ' AND DATE(inv.created_at) = ?';
      params.push(date);
    }

    query += ' ORDER BY inv.created_at DESC LIMIT 50';

    const [invoices] = await db.query(query, params);

    if (invoices.length > 0) {
      const invoiceIds = invoices.map((i) => i.id);
      const placeholders = invoiceIds.map(() => '?').join(',');
      const [items] = await db.query(
        `SELECT id, invoice_id, service_id, service_name, unit_price
         FROM Invoice_Items
         WHERE invoice_id IN (${placeholders})
         ORDER BY id ASC`,
        invoiceIds
      );

      const itemsByInvoice = {};
      items.forEach((item) => {
        if (!itemsByInvoice[item.invoice_id]) itemsByInvoice[item.invoice_id] = [];
        itemsByInvoice[item.invoice_id].push(item);
      });

      invoices.forEach((inv) => {
        inv.items = itemsByInvoice[inv.id] || [];
      });
    }

    return res.status(200).json({
      success: true,
      data: invoices
    });
  } catch (error) {
    console.error('GET_INVOICES_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tải danh sách hóa đơn',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
