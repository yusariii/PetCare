const db = require('../config/db');
const { logStockMovement } = require('../utils/stockLog');

let tablesEnsured = false;

/**
 * Đảm bảo bảng Medicine_Orders và Medicine_Order_Items có đầy đủ cột phục vụ cả 2 loại đơn
 */
const ensureMedicineOrderTables = async () => {
  if (tablesEnsured) return;

  const alterQueries = [
    'ALTER TABLE Medicine_Orders MODIFY COLUMN prescription_id INT NULL',
    'ALTER TABLE Medicine_Orders MODIFY COLUMN user_id INT NULL',
    'ALTER TABLE Medicine_Orders ADD COLUMN order_code VARCHAR(30) NULL UNIQUE AFTER id',
    "ALTER TABLE Medicine_Orders ADD COLUMN order_type ENUM('prescription', 'walk_in') NOT NULL DEFAULT 'prescription' AFTER order_code",
    'ALTER TABLE Medicine_Orders ADD COLUMN pharmacist_id INT NULL AFTER user_id',
    'ALTER TABLE Medicine_Orders ADD COLUMN customer_name VARCHAR(100) NULL AFTER pharmacist_id',
    'ALTER TABLE Medicine_Orders ADD COLUMN customer_phone VARCHAR(20) NULL AFTER customer_name',
    'ALTER TABLE Medicine_Orders ADD COLUMN pet_id INT NULL AFTER customer_phone',
    'ALTER TABLE Medicine_Orders ADD COLUMN pet_name VARCHAR(50) NULL AFTER pet_id',
    "ALTER TABLE Medicine_Orders ADD COLUMN pet_species ENUM('dog', 'cat', 'other') NOT NULL DEFAULT 'dog' AFTER pet_name",
    'ALTER TABLE Medicine_Orders ADD COLUMN notes TEXT NULL AFTER status'
  ];

  for (const q of alterQueries) {
    try {
      await db.query(q);
    } catch (e) {
      if (e.code !== 'ER_DUP_FIELDNAME' && e.code !== 'ER_DUP_KEYNAME') {
        // ignore harmless migration warnings
      }
    }
  }

  await db.query(`
    CREATE TABLE IF NOT EXISTS Medicine_Order_Items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_id INT NOT NULL,
      medicine_id INT NOT NULL,
      medicine_name VARCHAR(150) NOT NULL,
      unit VARCHAR(30) NOT NULL DEFAULT 'viên',
      dosage VARCHAR(200) NULL,
      quantity INT NOT NULL,
      unit_price DECIMAL(10,2) NOT NULL,
      FOREIGN KEY (order_id) REFERENCES Medicine_Orders(id) ON DELETE CASCADE,
      FOREIGN KEY (medicine_id) REFERENCES Medicines(id) ON DELETE RESTRICT,
      INDEX idx_order_id (order_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  tablesEnsured = true;
};

const generateOrderCode = (prefix = 'DT') => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${y}${m}${d}-${rand}`;
};

/**
 * Helper lấy thông tin đầy đủ 1 đơn thuốc (bao gồm items thực tế + prescribed_items ban đầu nếu là đơn bác sĩ kê)
 */
const fetchFullMedicineOrder = async (orderId, conn = db) => {
  const [rows] = await conn.query(
    `SELECT
       mo.*,
       COALESCE(mo.customer_name, u.full_name) as customer_name,
       COALESCE(mo.customer_phone, u.phone) as customer_phone,
       COALESCE(mo.pet_name, pet.name, wpet.name) as pet_name,
       COALESCE(pet.species, wpet.species, mo.pet_species, 'dog') as pet_species,
       ph.full_name as pharmacist_name,
       doc.full_name as doctor_name
     FROM Medicine_Orders mo
     LEFT JOIN Users u ON u.id = mo.user_id
     LEFT JOIN Prescriptions p ON p.id = mo.prescription_id
     LEFT JOIN Pets pet ON pet.id = p.pet_id
     LEFT JOIN Pets wpet ON wpet.id = mo.pet_id
     LEFT JOIN Users ph ON ph.id = mo.pharmacist_id
     LEFT JOIN Users doc ON doc.id = p.doctor_id
     WHERE mo.id = ?`,
    [orderId]
  );

  if (rows.length === 0) return null;
  const order = rows[0];
  if (!order.order_code) {
    order.order_code = `${order.order_type === 'walk_in' ? 'DVL' : 'DT'}-${order.id}`;
  }

  const [orderItems] = await conn.query(
    `SELECT id, order_id, medicine_id, medicine_name, unit, dosage, quantity, unit_price
     FROM Medicine_Order_Items
     WHERE order_id = ?
     ORDER BY id ASC`,
    [orderId]
  );

  let prescribedItems = [];
  if (order.prescription_id) {
    const [pItems] = await conn.query(
      `SELECT
         pi.id,
         pi.medicine_id,
         m.name as medicine_name,
         m.unit,
         pi.dosage,
         pi.quantity,
         pi.unit_price
       FROM Prescription_Items pi
       JOIN Medicines m ON m.id = pi.medicine_id
       WHERE pi.prescription_id = ?
       ORDER BY pi.id ASC`,
      [order.prescription_id]
    );
    prescribedItems = pItems;
  }

  order.prescribed_items = prescribedItems;
  order.items = orderItems.length > 0 ? orderItems : prescribedItems;
  return order;
};

/**
 * Create a reservation order for a prescription - stock is reserved immediately,
 * actual payment happens at the counter (status flips to 'paid' there).
 * POST /api/medicine-orders
 * body: { prescription_id }
 */
exports.createOrder = async (req, res) => {
  try {
    await ensureMedicineOrderTables();
    const { prescription_id } = req.body;
    if (!prescription_id) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn đơn thuốc cần mua' });
    }

    const [prescriptions] = await db.query(
      `SELECT p.id, pt.user_id as pet_owner_id, pt.species as pet_species, u.full_name as owner_name
       FROM Prescriptions p
       JOIN Pets pt ON pt.id = p.pet_id
       JOIN Users u ON u.id = pt.user_id
       WHERE p.id = ?`,
      [prescription_id]
    );

    if (prescriptions.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuốc' });
    }
    if (prescriptions[0].pet_owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền mua đơn thuốc này' });
    }

    const [existingOrders] = await db.query(
      "SELECT id FROM Medicine_Orders WHERE prescription_id = ? AND status IN ('pending', 'paid')",
      [prescription_id]
    );
    if (existingOrders.length > 0) {
      return res.status(400).json({ success: false, message: 'Đơn thuốc này đã được đặt giữ chỗ hoặc đã thanh toán' });
    }

    const [items] = await db.query(
      `SELECT pi.medicine_id, pi.quantity, pi.unit_price, pi.dosage, m.name as medicine_name, m.unit
       FROM Prescription_Items pi
       JOIN Medicines m ON m.id = pi.medicine_id
       WHERE pi.prescription_id = ?`,
      [prescription_id]
    );
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Đơn thuốc không có thuốc nào' });
    }

    const connection = await db.getConnection();
    let orderId;
    try {
      await connection.beginTransaction();

      const medicineIds = items.map((i) => i.medicine_id);
      const placeholders = medicineIds.map(() => '?').join(',');
      const [stocks] = await connection.query(
        `SELECT id, name, stock_quantity FROM Medicines WHERE id IN (${placeholders}) FOR UPDATE`,
        medicineIds
      );
      const stockMap = new Map(stocks.map((s) => [s.id, s]));

      for (const item of items) {
        const medicine = stockMap.get(item.medicine_id);
        if (!medicine || medicine.stock_quantity < item.quantity) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Thuốc "${medicine ? medicine.name : item.medicine_id}" không đủ tồn kho để giữ chỗ`
          });
        }
      }

      for (const item of items) {
        await connection.query(
          'UPDATE Medicines SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [item.quantity, item.medicine_id]
        );
      }

      const totalAmount = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);
      const orderCode = generateOrderCode('DT');
      const normalizedSpecies = ['dog', 'cat', 'other'].includes(prescriptions[0].pet_species)
        ? prescriptions[0].pet_species
        : 'dog';

      const [result] = await connection.query(
        `INSERT INTO Medicine_Orders (
           order_code, order_type, prescription_id, user_id, customer_name, pet_species, total_amount, status
         ) VALUES (?, 'prescription', ?, ?, ?, ?, ?, 'pending')`,
        [orderCode, prescription_id, req.user.id, prescriptions[0].owner_name, normalizedSpecies, totalAmount]
      );
      orderId = result.insertId;

      const itemValues = items.map((item) => [
        orderId,
        item.medicine_id,
        item.medicine_name,
        item.unit || 'viên',
        item.dosage || null,
        Number(item.quantity),
        Number(item.unit_price)
      ]);
      await connection.query(
        `INSERT INTO Medicine_Order_Items (
           order_id, medicine_id, medicine_name, unit, dosage, quantity, unit_price
         ) VALUES ?`,
        [itemValues]
      );

      for (const item of items) {
        await logStockMovement(connection, {
          medicineId: item.medicine_id,
          change: -item.quantity,
          type: 'reserve',
          note: `Giữ chỗ đơn mua #${orderId}`,
          orderId,
          userId: req.user.id
        });
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
      message: 'Giữ chỗ đơn thuốc thành công. Vui lòng đến quầy thuốc để thanh toán và nhận thuốc.',
      data: { order_id: orderId }
    });
  } catch (error) {
    console.error('CREATE_MEDICINE_ORDER_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi đặt giữ chỗ đơn thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get my medicine orders (customer)
 * GET /api/medicine-orders/my
 */
exports.getMyOrders = async (req, res) => {
  try {
    await ensureMedicineOrderTables();
    const [orders] = await db.query(
      `SELECT
         mo.*,
         COALESCE(p.pet_id, mo.pet_id) as pet_id,
         COALESCE(pet.name, mo.pet_name, wpet.name) as pet_name
       FROM Medicine_Orders mo
       LEFT JOIN Prescriptions p ON p.id = mo.prescription_id
       LEFT JOIN Pets pet ON pet.id = p.pet_id
       LEFT JOIN Pets wpet ON wpet.id = mo.pet_id
       WHERE mo.user_id = ?
       ORDER BY mo.created_at DESC`,
      [req.user.id]
    );

    return res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error('GET_MY_MEDICINE_ORDERS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách đơn mua thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * List all medicine orders for counter processing (pharmacist/admin)
 * GET /api/medicine-orders?status=pending
 */
exports.listOrders = async (req, res) => {
  try {
    await ensureMedicineOrderTables();
    const { status } = req.query;
    const params = [];
    let query = `
      SELECT
        mo.*,
        COALESCE(mo.customer_name, u.full_name) as customer_name,
        COALESCE(mo.customer_phone, u.phone) as customer_phone,
        COALESCE(mo.pet_name, pet.name, wpet.name) as pet_name,
        COALESCE(pet.species, wpet.species, mo.pet_species, 'dog') as pet_species,
        ph.full_name as pharmacist_name,
        doc.full_name as doctor_name
      FROM Medicine_Orders mo
      LEFT JOIN Users u ON u.id = mo.user_id
      LEFT JOIN Prescriptions p ON p.id = mo.prescription_id
      LEFT JOIN Pets pet ON pet.id = p.pet_id
      LEFT JOIN Pets wpet ON wpet.id = mo.pet_id
      LEFT JOIN Users ph ON ph.id = mo.pharmacist_id
      LEFT JOIN Users doc ON doc.id = p.doctor_id
      WHERE 1=1
    `;
    if (status && status !== 'all') {
      query += ' AND mo.status = ?';
      params.push(status);
    }
    query += ' ORDER BY mo.created_at DESC';

    const [orders] = await db.query(query, params);

    if (orders.length > 0) {
      const orderIds = orders.map((o) => o.id);
      const orderPlaceholders = orderIds.map(() => '?').join(',');
      const [orderItems] = await db.query(
        `SELECT id, order_id, medicine_id, medicine_name, unit, dosage, quantity, unit_price
         FROM Medicine_Order_Items
         WHERE order_id IN (${orderPlaceholders})
         ORDER BY id ASC`,
        orderIds
      );

      const itemsByOrder = {};
      orderItems.forEach((it) => {
        if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
        itemsByOrder[it.order_id].push(it);
      });

      const prescriptionIds = [
        ...new Set(orders.map((o) => o.prescription_id).filter((pid) => Number.isInteger(pid) && pid > 0))
      ];
      const prescribedByPres = {};
      if (prescriptionIds.length > 0) {
        const presPlaceholders = prescriptionIds.map(() => '?').join(',');
        const [pItems] = await db.query(
          `SELECT
             pi.id,
             pi.prescription_id,
             pi.medicine_id,
             m.name as medicine_name,
             m.unit,
             pi.dosage,
             pi.quantity,
             pi.unit_price
           FROM Prescription_Items pi
           JOIN Medicines m ON m.id = pi.medicine_id
           WHERE pi.prescription_id IN (${presPlaceholders})
           ORDER BY pi.id ASC`,
          prescriptionIds
        );
        pItems.forEach((pi) => {
          if (!prescribedByPres[pi.prescription_id]) prescribedByPres[pi.prescription_id] = [];
          prescribedByPres[pi.prescription_id].push(pi);
        });
      }

      orders.forEach((o) => {
        if (!o.order_code) {
          o.order_code = `${o.order_type === 'walk_in' ? 'DVL' : 'DT'}-${o.id}`;
        }
        const pList = o.prescription_id ? prescribedByPres[o.prescription_id] || [] : [];
        const savedList = itemsByOrder[o.id] || [];
        o.prescribed_items = pList;
        o.items = savedList.length > 0 ? savedList : pList;
      });
    }

    return res.status(200).json({ success: true, data: orders });
  } catch (error) {
    console.error('LIST_MEDICINE_ORDERS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách đơn mua thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Điều chỉnh danh sách thuốc & số lượng thực tế khách lấy trước khi hiển thị mã QR thanh toán
 * PUT /api/medicine-orders/:id/items
 * body: { items: [{ medicine_id, quantity }], notes }
 */
exports.updateOrderItems = async (req, res) => {
  let connection;
  try {
    await ensureMedicineOrderTables();
    const { id } = req.params;
    const { items, notes } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 loại thuốc với số lượng hợp lệ để thanh toán'
      });
    }

    // Gộp các item trùng medicine_id nếu có và lọc quantity > 0
    const normalizedMap = new Map();
    for (const raw of items) {
      const medId = Number(raw.medicine_id);
      const qty = Number(raw.quantity);
      if (!Number.isInteger(medId) || medId <= 0 || !Number.isInteger(qty) || qty <= 0) {
        continue;
      }
      normalizedMap.set(medId, (normalizedMap.get(medId) || 0) + qty);
    }

    if (normalizedMap.size === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 loại thuốc với số lượng lớn hơn 0'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const [orders] = await connection.query(
      'SELECT * FROM Medicine_Orders WHERE id = ? FOR UPDATE',
      [id]
    );
    if (orders.length === 0) {
      await connection.rollback();
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn mua thuốc' });
    }

    const order = orders[0];
    if (order.status !== 'pending') {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        message: 'Đơn thuốc này đã thanh toán hoặc đã hủy, không thể điều chỉnh'
      });
    }

    // Lấy danh sách thuốc hiện đang giữ chỗ của đơn này
    const [existingOrderItems] = await connection.query(
      'SELECT medicine_id, medicine_name, unit, dosage, quantity, unit_price FROM Medicine_Order_Items WHERE order_id = ?',
      [id]
    );

    let currentReservedItems = existingOrderItems;
    if (currentReservedItems.length === 0 && order.prescription_id) {
      const [presItems] = await connection.query(
        `SELECT pi.medicine_id, m.name as medicine_name, m.unit, pi.dosage, pi.quantity, pi.unit_price
         FROM Prescription_Items pi
         JOIN Medicines m ON m.id = pi.medicine_id
         WHERE pi.prescription_id = ?`,
        [order.prescription_id]
      );
      currentReservedItems = presItems;
    }

    // Lấy thông tin gốc từ Prescription_Items (nếu là đơn bác sĩ kê) để giữ đúng đơn giá snapshot & liều dùng
    const prescribedMetaMap = new Map();
    if (order.prescription_id) {
      const [presItems] = await connection.query(
        `SELECT pi.medicine_id, m.name as medicine_name, m.unit, pi.dosage, pi.quantity, pi.unit_price
         FROM Prescription_Items pi
         JOIN Medicines m ON m.id = pi.medicine_id
         WHERE pi.prescription_id = ?`,
        [order.prescription_id]
      );
      presItems.forEach((p) => prescribedMetaMap.set(Number(p.medicine_id), p));
    }

    const currentReservedMap = new Map();
    currentReservedItems.forEach((it) => {
      currentReservedMap.set(Number(it.medicine_id), Number(it.quantity));
      if (!prescribedMetaMap.has(Number(it.medicine_id))) {
        prescribedMetaMap.set(Number(it.medicine_id), it);
      }
    });

    const allMedicineIds = [
      ...new Set([...currentReservedMap.keys(), ...normalizedMap.keys()])
    ];
    const medPlaceholders = allMedicineIds.map(() => '?').join(',');
    const [medicines] = await connection.query(
      `SELECT id, name, unit, price, stock_quantity FROM Medicines WHERE id IN (${medPlaceholders}) FOR UPDATE`,
      allMedicineIds
    );
    const medMap = new Map(medicines.map((m) => [Number(m.id), m]));

    // Kiểm tra và cân đối tồn kho theo chênh lệch (newQty - oldQty)
    for (const medId of allMedicineIds) {
      const oldQty = currentReservedMap.get(medId) || 0;
      const newQty = normalizedMap.get(medId) || 0;
      const diff = newQty - oldQty; // diff > 0: lấy thêm -> trừ kho; diff < 0: bớt thuốc -> hoàn kho

      if (diff > 0) {
        const med = medMap.get(medId);
        if (!med || med.stock_quantity < diff) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Thuốc "${med ? med.name : medId}" không đủ tồn kho để tăng số lượng`
          });
        }
        await connection.query(
          'UPDATE Medicines SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [diff, medId]
        );
        await logStockMovement(connection, {
          medicineId: medId,
          change: -diff,
          type: 'reserve',
          note: `Điều chỉnh tăng thuốc đơn #${id}`,
          orderId: id,
          userId: req.user.id
        });
      } else if (diff < 0) {
        const releaseQty = Math.abs(diff);
        await connection.query(
          'UPDATE Medicines SET stock_quantity = stock_quantity + ? WHERE id = ?',
          [releaseQty, medId]
        );
        await logStockMovement(connection, {
          medicineId: medId,
          change: releaseQty,
          type: 'release',
          note: `Hoàn kho thuốc khách không lấy đơn #${id}`,
          orderId: id,
          userId: req.user.id
        });
      }
    }

    // Lưu lại danh sách Medicine_Order_Items mới và tính lại tổng tiền
    await connection.query('DELETE FROM Medicine_Order_Items WHERE order_id = ?', [id]);

    let newTotalAmount = 0;
    const insertValues = [];

    for (const [medId, qty] of normalizedMap.entries()) {
      const meta = prescribedMetaMap.get(medId);
      const med = medMap.get(medId);
      const medName = meta?.medicine_name || med?.name || `Thuốc #${medId}`;
      const unit = meta?.unit || med?.unit || 'viên';
      const dosage = meta?.dosage || null;
      const unitPrice = Number(meta?.unit_price ?? med?.price ?? 0);

      newTotalAmount += unitPrice * qty;
      insertValues.push([id, medId, medName, unit, dosage, qty, unitPrice]);
    }

    await connection.query(
      `INSERT INTO Medicine_Order_Items (
         order_id, medicine_id, medicine_name, unit, dosage, quantity, unit_price
       ) VALUES ?`,
      [insertValues]
    );

    const finalOrderCode = order.order_code || generateOrderCode(order.order_type === 'walk_in' ? 'DVL' : 'DT');
    await connection.query(
      `UPDATE Medicine_Orders
       SET order_code = ?,
           pharmacist_id = ?,
           total_amount = ?,
           notes = ?
       WHERE id = ?`,
      [finalOrderCode, req.user.id, newTotalAmount, notes ? String(notes).trim() : order.notes, id]
    );

    await connection.commit();

    const updatedOrder = await fetchFullMedicineOrder(id);
    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật danh sách thuốc và tạo mã QR thanh toán',
      data: updatedOrder
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('UPDATE_MEDICINE_ORDER_ITEMS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật hóa đơn thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Tạo hóa đơn bán thuốc trực tiếp cho khách vãng lai (không cần đơn bác sĩ)
 * Hỗ trợ liên kết tài khoản (user_id, pet_id) nếu tra cứu qua SĐT
 * POST /api/medicine-orders/walk-in
 * body: { customer_name, customer_phone?, user_id?, pet_id?, pet_name?, pet_species, items: [{ medicine_id, quantity }], notes }
 */
exports.createWalkInOrder = async (req, res) => {
  let connection;
  try {
    await ensureMedicineOrderTables();
    const {
      customer_name,
      customer_phone,
      user_id,
      pet_id,
      pet_name,
      pet_species,
      items,
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

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 loại thuốc'
      });
    }

    const normalizedMap = new Map();
    for (const raw of items) {
      const medId = Number(raw.medicine_id);
      const qty = Number(raw.quantity);
      if (!Number.isInteger(medId) || medId <= 0 || !Number.isInteger(qty) || qty <= 0) {
        continue;
      }
      normalizedMap.set(medId, (normalizedMap.get(medId) || 0) + qty);
    }

    if (normalizedMap.size === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 loại thuốc với số lượng hợp lệ'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    const medicineIds = [...normalizedMap.keys()];
    const placeholders = medicineIds.map(() => '?').join(',');
    const [medicines] = await connection.query(
      `SELECT id, name, unit, price, stock_quantity FROM Medicines WHERE id IN (${placeholders}) FOR UPDATE`,
      medicineIds
    );
    const medMap = new Map(medicines.map((m) => [Number(m.id), m]));

    for (const [medId, qty] of normalizedMap.entries()) {
      const med = medMap.get(medId);
      if (!med) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Không tìm thấy thuốc #${medId}`
        });
      }
      if (med.stock_quantity < qty) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Thuốc "${med.name}" chỉ còn ${med.stock_quantity} ${med.unit || 'đơn vị'} trong kho`
        });
      }
    }

    let totalAmount = 0;
    for (const [medId, qty] of normalizedMap.entries()) {
      const med = medMap.get(medId);
      totalAmount += Number(med.price) * qty;
    }

    const orderCode = generateOrderCode('DVL');
    const [insertRes] = await connection.query(
      `INSERT INTO Medicine_Orders (
         order_code, order_type, prescription_id, user_id, pharmacist_id,
         customer_name, customer_phone, pet_id, pet_name, pet_species, total_amount, status, notes
       ) VALUES (?, 'walk_in', NULL, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        orderCode,
        linkedUserId,
        req.user.id,
        finalCustomerName,
        finalCustomerPhone,
        linkedPetId,
        finalPetName,
        normalizedSpecies,
        totalAmount,
        notes ? String(notes).trim() : null
      ]
    );

    const orderId = insertRes.insertId;
    const itemValues = [];

    for (const [medId, qty] of normalizedMap.entries()) {
      const med = medMap.get(medId);
      await connection.query(
        'UPDATE Medicines SET stock_quantity = stock_quantity - ? WHERE id = ?',
        [qty, medId]
      );
      await logStockMovement(connection, {
        medicineId: medId,
        change: -qty,
        type: 'reserve',
        note: `Xuất đơn thuốc vãng lai #${orderId}`,
        orderId,
        userId: req.user.id
      });
      itemValues.push([
        orderId,
        medId,
        med.name,
        med.unit || 'viên',
        null,
        qty,
        Number(med.price)
      ]);
    }

    await connection.query(
      `INSERT INTO Medicine_Order_Items (
         order_id, medicine_id, medicine_name, unit, dosage, quantity, unit_price
       ) VALUES ?`,
      [itemValues]
    );

    await connection.commit();

    const fullOrder = await fetchFullMedicineOrder(orderId);
    return res.status(201).json({
      success: true,
      message: 'Tạo hóa đơn thuốc vãng lai thành công',
      data: fullOrder
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('CREATE_WALKIN_MEDICINE_ORDER_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tạo hóa đơn thuốc vãng lai. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
};

/**
 * Confirm payment or cancel a reservation at the counter (pharmacist/admin)
 * PATCH /api/medicine-orders/:id/status
 * body: { status: 'paid' | 'cancelled' }
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    await ensureMedicineOrderTables();
    const { id } = req.params;
    const { status } = req.body;

    if (!['paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    const [orders] = await db.query(
      'SELECT id, status, prescription_id FROM Medicine_Orders WHERE id = ?',
      [id]
    );
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn mua thuốc' });
    }
    if (orders[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể xử lý đơn đang ở trạng thái "Chờ thanh toán"' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [updated] = await connection.query(
        "UPDATE Medicine_Orders SET status = ?, pharmacist_id = COALESCE(pharmacist_id, ?) WHERE id = ? AND status = 'pending'",
        [status, req.user.id, id]
      );
      if (updated.affectedRows === 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Đơn này đã được xử lý' });
      }

      if (status === 'cancelled') {
        const [savedItems] = await connection.query(
          'SELECT medicine_id, quantity FROM Medicine_Order_Items WHERE order_id = ?',
          [id]
        );
        let itemsToRelease = savedItems;
        if (itemsToRelease.length === 0 && orders[0].prescription_id) {
          const [presItems] = await connection.query(
            'SELECT medicine_id, quantity FROM Prescription_Items WHERE prescription_id = ?',
            [orders[0].prescription_id]
          );
          itemsToRelease = presItems;
        }

        for (const item of itemsToRelease) {
          await connection.query(
            'UPDATE Medicines SET stock_quantity = stock_quantity + ? WHERE id = ?',
            [item.quantity, item.medicine_id]
          );
          await logStockMovement(connection, {
            medicineId: item.medicine_id,
            change: item.quantity,
            type: 'release',
            note: `Hoàn kho do hủy đơn #${id}`,
            orderId: id,
            userId: req.user.id
          });
        }
      }

      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

    const fullOrder = await fetchFullMedicineOrder(id);

    return res.status(200).json({
      success: true,
      message: status === 'paid' ? 'Xác nhận thanh toán thành công' : 'Đã hủy đơn giữ chỗ và hoàn lại tồn kho',
      data: fullOrder
    });
  } catch (error) {
    console.error('UPDATE_MEDICINE_ORDER_STATUS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật trạng thái đơn mua thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
