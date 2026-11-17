const db = require('../config/db');
const { getOwnRoomId } = require('../utils/doctorScope');

let tablesEnsured = false;

/**
 * Đảm bảo bảng Invoices và Invoice_Items luôn tồn tại và hỗ trợ đầy đủ đa phòng + thu ngân
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
      room_id INT NULL,
      doctor_id INT NULL,
      cashier_id INT NULL,
      customer_name VARCHAR(100) NOT NULL,
      customer_phone VARCHAR(20) NULL,
      pet_name VARCHAR(50) NULL,
      pet_species ENUM('dog', 'cat', 'other') NOT NULL DEFAULT 'dog',
      total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
      payment_status ENUM('pending', 'paid') NOT NULL DEFAULT 'pending',
      paid_at TIMESTAMP NULL,
      notes TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (appointment_id) REFERENCES Appointments(id) ON DELETE SET NULL,
      FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
      FOREIGN KEY (pet_id) REFERENCES Pets(id) ON DELETE SET NULL,
      FOREIGN KEY (room_id) REFERENCES Clinic_Rooms(id) ON DELETE SET NULL,
      FOREIGN KEY (doctor_id) REFERENCES Users(id) ON DELETE SET NULL,
      FOREIGN KEY (cashier_id) REFERENCES Users(id) ON DELETE SET NULL,
      INDEX idx_invoice_type (invoice_type),
      INDEX idx_room_created (room_id, created_at),
      INDEX idx_doctor_id (doctor_id),
      INDEX idx_user_id (user_id),
      INDEX idx_payment_status (payment_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const alterQueries = [
    "ALTER TABLE Invoices ADD COLUMN payment_status ENUM('pending', 'paid') NOT NULL DEFAULT 'paid' AFTER total_amount",
    'ALTER TABLE Invoices ADD COLUMN paid_at TIMESTAMP NULL AFTER payment_status',
    'ALTER TABLE Invoices ADD COLUMN user_id INT NULL AFTER appointment_id',
    'ALTER TABLE Invoices ADD COLUMN pet_id INT NULL AFTER user_id',
    'ALTER TABLE Invoices MODIFY COLUMN room_id INT NULL',
    'ALTER TABLE Invoices MODIFY COLUMN doctor_id INT NULL',
    'ALTER TABLE Invoices ADD COLUMN cashier_id INT NULL AFTER doctor_id',
    'ALTER TABLE Invoices ADD COLUMN deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER total_amount',
    'ALTER TABLE Appointments ADD COLUMN deposit_amount DECIMAL(12,2) NOT NULL DEFAULT 0 AFTER notes',
    "ALTER TABLE Appointments ADD COLUMN deposit_status ENUM('none', 'paid', 'refunded', 'forfeited') NOT NULL DEFAULT 'none' AFTER deposit_amount",
    "ALTER TABLE Appointments MODIFY COLUMN deposit_status ENUM('none', 'paid', 'refunded', 'forfeited') NOT NULL DEFAULT 'none'",
    "ALTER TABLE Users MODIFY COLUMN role ENUM('customer', 'doctor', 'admin', 'pharmacist', 'cashier') NOT NULL DEFAULT 'customer'"
  ];
  for (const q of alterQueries) {
    try {
      await db.query(q);
    } catch (alterError) {
      // ignore if already exists
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

  await db.query(`
    CREATE TABLE IF NOT EXISTS Appointment_Room_Steps (
      id INT AUTO_INCREMENT PRIMARY KEY,
      appointment_id INT NOT NULL,
      room_id INT NOT NULL,
      referred_by_room_id INT NULL,
      status ENUM('in_progress', 'completed') NOT NULL DEFAULT 'in_progress',
      completed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_app_room (appointment_id, room_id),
      FOREIGN KEY (appointment_id) REFERENCES Appointments(id) ON DELETE CASCADE,
      FOREIGN KEY (room_id) REFERENCES Clinic_Rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (referred_by_room_id) REFERENCES Clinic_Rooms(id) ON DELETE SET NULL,
      INDEX idx_app_steps (appointment_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS User_Cancellation_Logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      appointment_id INT NULL,
      log_type ENUM('cancelled', 'no_show') NOT NULL DEFAULT 'cancelled',
      penalty_weight INT NOT NULL DEFAULT 1,
      cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_user_cancel_date (user_id, cancelled_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const cancelLogAlterQueries = [
    "ALTER TABLE User_Cancellation_Logs ADD COLUMN log_type ENUM('cancelled', 'no_show') NOT NULL DEFAULT 'cancelled' AFTER appointment_id",
    'ALTER TABLE User_Cancellation_Logs ADD COLUMN penalty_weight INT NOT NULL DEFAULT 1 AFTER log_type'
  ];
  for (const q of cancelLogAlterQueries) {
    try {
      await db.query(q);
    } catch (e) {
      // ignore if already exists
    }
  }

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
 * Helper lấy chi tiết đầy đủ 1 hóa đơn theo ID (kèm thông tin phòng của từng dịch vụ)
 */
const fetchFullInvoice = async (invoiceId, conn = db) => {
  const [invoices] = await conn.query(
    `SELECT
       inv.*,
       cr.room_code,
       cr.room_name,
       u.full_name as doctor_name,
       cu.full_name as cashier_name
     FROM Invoices inv
     LEFT JOIN Clinic_Rooms cr ON cr.id = inv.room_id
     LEFT JOIN Users u ON u.id = inv.doctor_id
     LEFT JOIN Users cu ON cu.id = inv.cashier_id
     WHERE inv.id = ?`,
    [invoiceId]
  );

  if (invoices.length === 0) return null;
  const invoice = invoices[0];

  const [items] = await conn.query(
    `SELECT
       ii.id,
       ii.service_id,
       ii.service_name,
       ii.unit_price,
       s.room_id as service_room_id,
       scr.room_code as service_room_code,
       scr.room_name as service_room_name
     FROM Invoice_Items ii
     LEFT JOIN Services s ON s.id = ii.service_id
     LEFT JOIN Clinic_Rooms scr ON scr.id = s.room_id
     WHERE ii.invoice_id = ?
     ORDER BY ii.id ASC`,
    [invoiceId]
  );

  invoice.items = items;
  return invoice;
};

exports.fetchFullInvoice = fetchFullInvoice;

/**
 * Helper tự động đồng bộ / tạo hóa đơn chờ thanh toán (pending) cho 1 lịch khám
 * Được gọi tự động khi Bác sĩ chỉ định dịch vụ hoặc đánh dấu Hoàn thành ca khám,
 * giúp Thu ngân mở màn hình lên là thấy ngay hóa đơn với đầy đủ các dịch vụ đã làm ở tất cả các phòng.
 */
const syncAppointmentPendingInvoice = async (appointmentId, actorId = null, existingConn = null) => {
  await ensureInvoiceTables();
  const conn = existingConn || db;

  const [appointments] = await conn.query(
    `SELECT
       a.id, a.room_id, a.doctor_id, a.service_id, a.status, a.pet_id, a.user_id,
       COALESCE(a.deposit_amount, 0) as deposit_amount, a.deposit_status,
       p.name as pet_name, p.species as pet_species,
       u.full_name as customer_name, u.phone as customer_phone
     FROM Appointments a
     JOIN Pets p ON p.id = a.pet_id
     JOIN Users u ON u.id = a.user_id
     WHERE a.id = ?`,
    [appointmentId]
  );

  if (appointments.length === 0) return null;
  const appointment = appointments[0];

  // Lấy toàn bộ service_ids hiện gắn với lịch khám (có thể thuộc nhiều phòng khác nhau)
  const [appServiceRows] = await conn.query(
    `SELECT DISTINCT id, service_name, price
     FROM Services
     WHERE id = ? OR id IN (
       SELECT service_id FROM Appointment_Services WHERE appointment_id = ?
     )
     ORDER BY id ASC`,
    [appointment.service_id, appointment.id]
  );

  if (appServiceRows.length === 0) return null;

  const totalAmount = appServiceRows.reduce((sum, s) => sum + Number(s.price || 0), 0);
  const depositAmount = appointment.deposit_status === 'paid' ? Number(appointment.deposit_amount || 0) : 0;
  const normalizedSpecies = ['dog', 'cat', 'other'].includes(appointment.pet_species)
    ? appointment.pet_species
    : 'other';

  const [existingInvoices] = await conn.query(
    'SELECT id, payment_status FROM Invoices WHERE appointment_id = ?',
    [appointment.id]
  );

  // Nếu hóa đơn đã thanh toán (paid) thì không ghi đè nữa
  if (existingInvoices.length > 0 && existingInvoices[0].payment_status === 'paid') {
    return fetchFullInvoice(existingInvoices[0].id, conn);
  }

  let invoiceId;
  const doctorIdToSave = appointment.doctor_id || actorId || null;

  if (existingInvoices.length > 0) {
    invoiceId = existingInvoices[0].id;
    await conn.query(
      `UPDATE Invoices
       SET user_id = ?,
           pet_id = ?,
           room_id = ?,
           doctor_id = COALESCE(doctor_id, ?),
           customer_name = ?,
           customer_phone = ?,
           pet_name = ?,
           pet_species = ?,
           total_amount = ?,
           deposit_amount = ?,
           payment_status = 'pending'
       WHERE id = ?`,
      [
        appointment.user_id || null,
        appointment.pet_id || null,
        appointment.room_id,
        doctorIdToSave,
        appointment.customer_name,
        appointment.customer_phone || null,
        appointment.pet_name || null,
        normalizedSpecies,
        totalAmount,
        depositAmount,
        invoiceId
      ]
    );
    await conn.query('DELETE FROM Invoice_Items WHERE invoice_id = ?', [invoiceId]);
  } else {
    const invoiceCode = generateInvoiceCode('HD');
    const [insertRes] = await conn.query(
      `INSERT INTO Invoices (
         invoice_code, invoice_type, appointment_id, user_id, pet_id, room_id, doctor_id,
         customer_name, customer_phone, pet_name, pet_species, total_amount, deposit_amount, payment_status, notes
       ) VALUES (?, 'appointment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NULL)`,
      [
        invoiceCode,
        appointment.id,
        appointment.user_id || null,
        appointment.pet_id || null,
        appointment.room_id,
        doctorIdToSave,
        appointment.customer_name,
        appointment.customer_phone || null,
        appointment.pet_name || null,
        normalizedSpecies,
        totalAmount,
        depositAmount
      ]
    );
    invoiceId = insertRes.insertId;
  }

  const itemValues = appServiceRows.map((s) => [
    invoiceId,
    s.id,
    s.service_name,
    Number(s.price)
  ]);
  await conn.query(
    'INSERT INTO Invoice_Items (invoice_id, service_id, service_name, unit_price) VALUES ?',
    [itemValues]
  );

  return fetchFullInvoice(invoiceId, conn);
};

exports.syncAppointmentPendingInvoice = syncAppointmentPendingInvoice;

/**
 * Lấy danh sách toàn bộ phòng khám và dịch vụ toàn viện (phục vụ Bác sĩ chỉ định dịch vụ đa phòng & Thu ngân thanh toán)
 * GET /api/invoices/my-room-services
 */
exports.getMyRoomServices = async (req, res) => {
  try {
    await ensureInvoiceTables();
    let ownRoomId = null;

    if (req.user.role === 'doctor') {
      ownRoomId = await getOwnRoomId(req.user.id);
    }

    const [rooms] = await db.query(
      `SELECT cr.id, cr.room_code, cr.room_name, cr.floor, cr.description,
              cr.doctor_id, u.full_name as doctor_name
       FROM Clinic_Rooms cr
       LEFT JOIN Users u ON u.id = cr.doctor_id
       ORDER BY cr.room_code ASC`
    );

    const [allServices] = await db.query(
      `SELECT s.id, s.room_id, s.service_name, s.description, s.price, s.duration_minutes,
              cr.room_code, cr.room_name
       FROM Services s
       JOIN Clinic_Rooms cr ON cr.id = s.room_id
       ORDER BY cr.room_code ASC, s.id ASC`
    );

    const currentRoom = ownRoomId
      ? rooms.find((r) => Number(r.id) === Number(ownRoomId)) || rooms[0] || null
      : rooms[0] || null;

    return res.status(200).json({
      success: true,
      data: {
        room: currentRoom,
        rooms,
        services: allServices
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
 * Tạo hoặc cập nhật hóa đơn cho lịch khám đã hoàn thành (Thu ngân / Admin điều chỉnh dịch vụ đa phòng và tạo mã QR)
 * POST /api/invoices/appointment
 * Body: { appointment_id, service_ids: [1, 2, 15], notes }
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
         a.id, a.room_id, a.doctor_id, a.status, a.pet_id, a.user_id,
         COALESCE(a.deposit_amount, 0) as deposit_amount, a.deposit_status,
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

    if (appointment.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể xuất hóa đơn thanh toán cho ca khám đã hoàn thành'
      });
    }

    // Cho phép chọn dịch vụ thuộc BẤT KỲ phòng khám nào trong viện (để thanh toán gộp 1 lần)
    const placeholders = uniqueServiceIds.map(() => '?').join(',');
    const [services] = await db.query(
      `SELECT s.id, s.room_id, s.service_name, s.price, cr.room_code, cr.room_name
       FROM Services s
       JOIN Clinic_Rooms cr ON cr.id = s.room_id
       WHERE s.id IN (${placeholders})
       ORDER BY cr.room_code ASC, s.id ASC`,
      uniqueServiceIds
    );

    if (services.length !== uniqueServiceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Có dịch vụ không tồn tại trong hệ thống'
      });
    }

    const totalAmount = services.reduce((sum, s) => sum + Number(s.price || 0), 0);
    const depositAmount = appointment.deposit_status === 'paid' ? Number(appointment.deposit_amount || 0) : 0;
    const normalizedSpecies = ['dog', 'cat', 'other'].includes(appointment.pet_species)
      ? appointment.pet_species
      : 'other';

    connection = await db.getConnection();
    await connection.beginTransaction();

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
             cashier_id = ?,
             customer_name = ?,
             customer_phone = ?,
             pet_name = ?,
             pet_species = ?,
             total_amount = ?,
             deposit_amount = ?,
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
          depositAmount,
          notes ? notes.trim() : null,
          invoiceId
        ]
      );
      await connection.query('DELETE FROM Invoice_Items WHERE invoice_id = ?', [invoiceId]);
    } else {
      const invoiceCode = generateInvoiceCode('HD');
      const [insertRes] = await connection.query(
        `INSERT INTO Invoices (
           invoice_code, invoice_type, appointment_id, user_id, pet_id, room_id, doctor_id, cashier_id,
           customer_name, customer_phone, pet_name, pet_species, total_amount, deposit_amount, payment_status, notes
         ) VALUES (?, 'appointment', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        [
          invoiceCode,
          appointment.id,
          appointment.user_id || null,
          appointment.pet_id || null,
          appointment.room_id,
          appointment.doctor_id || null,
          req.user.id,
          appointment.customer_name,
          appointment.customer_phone || null,
          appointment.pet_name || null,
          normalizedSpecies,
          totalAmount,
          depositAmount,
          notes ? notes.trim() : null
        ]
      );
      invoiceId = insertRes.insertId;
    }

    const itemValues = services.map((s) => [
      invoiceId,
      s.id,
      `${s.service_name} (${s.room_code})`,
      Number(s.price)
    ]);
    await connection.query(
      'INSERT INTO Invoice_Items (invoice_id, service_id, service_name, unit_price) VALUES ?',
      [itemValues]
    );

    await connection.commit();

    const fullInvoice = await fetchFullInvoice(invoiceId);

    return res.status(200).json({
      success: true,
      message: 'Cập nhật hóa đơn thanh toán thành công',
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
 * Tạo hóa đơn cho khách khám vãng lai tại Quầy Thu ngân (hỗ trợ chọn dịch vụ từ nhiều phòng khám cùng lúc)
 * POST /api/invoices/walk-in
 * Body: { customer_name, customer_phone?, user_id?, pet_id?, pet_name?, pet_species, service_ids: [1, 2], notes }
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
      notes
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

    const placeholders = uniqueServiceIds.map(() => '?').join(',');
    const [services] = await db.query(
      `SELECT s.id, s.room_id, s.service_name, s.price, cr.room_code, cr.room_name
       FROM Services s
       JOIN Clinic_Rooms cr ON cr.id = s.room_id
       WHERE s.id IN (${placeholders})
       ORDER BY cr.room_code ASC, s.id ASC`,
      uniqueServiceIds
    );

    if (services.length !== uniqueServiceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Có dịch vụ không hợp lệ'
      });
    }

    const primaryRoomId = services[0].room_id;
    const totalAmount = services.reduce((sum, s) => sum + Number(s.price || 0), 0);

    connection = await db.getConnection();
    await connection.beginTransaction();

    const invoiceCode = generateInvoiceCode('VL');
    const [insertRes] = await connection.query(
      `INSERT INTO Invoices (
         invoice_code, invoice_type, appointment_id, user_id, pet_id, room_id, doctor_id, cashier_id,
         customer_name, customer_phone, pet_name, pet_species, total_amount, payment_status, notes
       ) VALUES (?, 'walk_in', NULL, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        invoiceCode,
        linkedUserId,
        linkedPetId,
        primaryRoomId,
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
    const itemValues = services.map((s) => [
      invoiceId,
      s.id,
      `${s.service_name} (${s.room_code})`,
      Number(s.price)
    ]);
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
 * Xác nhận hoàn tất thanh toán cho hóa đơn (Thu ngân / Admin)
 * PATCH /api/invoices/:id/pay
 */
exports.confirmInvoicePayment = async (req, res) => {
  try {
    await ensureInvoiceTables();
    const { id } = req.params;

    const [rows] = await db.query(
      'SELECT id, payment_status FROM Invoices WHERE id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy hóa đơn'
      });
    }

    await db.query(
      "UPDATE Invoices SET payment_status = 'paid', paid_at = NOW(), cashier_id = COALESCE(cashier_id, ?) WHERE id = ?",
      [req.user.id, id]
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
      // Nếu ca khám đã hoàn thành mà chưa có hóa đơn chờ thì tự động tạo luôn cho Thu ngân
      const synced = await syncAppointmentPendingInvoice(appointmentId, req.user.id);
      if (synced) {
        return res.status(200).json({
          success: true,
          data: synced
        });
      }
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
 * Lấy danh sách hóa đơn toàn viện (Thu ngân / Admin)
 * GET /api/invoices
 */
exports.getInvoices = async (req, res) => {
  try {
    await ensureInvoiceTables();
    const { invoice_type, payment_status, date } = req.query;

    let query = `
      SELECT
        inv.*,
        cr.room_code,
        cr.room_name,
        u.full_name as doctor_name,
        cu.full_name as cashier_name
      FROM Invoices inv
      LEFT JOIN Clinic_Rooms cr ON cr.id = inv.room_id
      LEFT JOIN Users u ON u.id = inv.doctor_id
      LEFT JOIN Users cu ON cu.id = inv.cashier_id
      WHERE 1=1
    `;
    const params = [];

    if (invoice_type && ['appointment', 'walk_in'].includes(invoice_type)) {
      query += ' AND inv.invoice_type = ?';
      params.push(invoice_type);
    }

    if (payment_status && ['pending', 'paid'].includes(payment_status)) {
      query += ' AND inv.payment_status = ?';
      params.push(payment_status);
    }

    if (date) {
      query += ' AND DATE(inv.created_at) = ?';
      params.push(date);
    }

    query += ' ORDER BY inv.created_at DESC LIMIT 100';

    const [invoices] = await db.query(query, params);

    if (invoices.length > 0) {
      const invoiceIds = invoices.map((i) => i.id);
      const placeholders = invoiceIds.map(() => '?').join(',');
      const [items] = await db.query(
        `SELECT
           ii.id,
           ii.invoice_id,
           ii.service_id,
           ii.service_name,
           ii.unit_price,
           s.room_id as service_room_id,
           scr.room_code as service_room_code,
           scr.room_name as service_room_name
         FROM Invoice_Items ii
         LEFT JOIN Services s ON s.id = ii.service_id
         LEFT JOIN Clinic_Rooms scr ON scr.id = s.room_id
         WHERE ii.invoice_id IN (${placeholders})
         ORDER BY ii.id ASC`,
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
