const db = require('../config/db');
const { logStockMovement } = require('../utils/stockLog');

/**
 * Create a reservation order for a prescription - stock is reserved immediately,
 * actual payment happens at the counter (status flips to 'paid' there).
 * POST /api/medicine-orders
 * body: { prescription_id }
 */
exports.createOrder = async (req, res) => {
  try {
    const { prescription_id } = req.body;
    if (!prescription_id) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn đơn thuốc cần mua' });
    }

    const [prescriptions] = await db.query(`
      SELECT p.id, pt.user_id as pet_owner_id
      FROM Prescriptions p
      JOIN Pets pt ON pt.id = p.pet_id
      WHERE p.id = ?
    `, [prescription_id]);

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
      'SELECT medicine_id, quantity, unit_price FROM Prescription_Items WHERE prescription_id = ?',
      [prescription_id]
    );
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'Đơn thuốc không có thuốc nào' });
    }

    // Khóa các dòng tồn kho liên quan để tránh race condition khi nhiều người mua cùng lúc
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

      // Tổng tiền tính từ đơn giá snapshot lúc kê đơn, không tin giá do client gửi lên
      const totalAmount = items.reduce((sum, item) => sum + Number(item.unit_price) * item.quantity, 0);

      const [result] = await connection.query(
        'INSERT INTO Medicine_Orders (prescription_id, user_id, total_amount, status) VALUES (?, ?, ?, "pending")',
        [prescription_id, req.user.id, totalAmount]
      );
      orderId = result.insertId;

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
    const [orders] = await db.query(`
      SELECT mo.*, p.pet_id, pet.name as pet_name
      FROM Medicine_Orders mo
      JOIN Prescriptions p ON p.id = mo.prescription_id
      JOIN Pets pet ON pet.id = p.pet_id
      WHERE mo.user_id = ?
      ORDER BY mo.created_at DESC
    `, [req.user.id]);

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
 * List all medicine orders for counter processing (pharmacist only)
 * GET /api/medicine-orders?status=pending
 */
exports.listOrders = async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let query = `
      SELECT mo.*, u.full_name as customer_name, u.phone as customer_phone, pet.name as pet_name
      FROM Medicine_Orders mo
      JOIN Users u ON u.id = mo.user_id
      JOIN Prescriptions p ON p.id = mo.prescription_id
      JOIN Pets pet ON pet.id = p.pet_id
      WHERE 1=1
    `;
    if (status) {
      query += ' AND mo.status = ?';
      params.push(status);
    }
    query += ' ORDER BY mo.created_at DESC';

    const [orders] = await db.query(query, params);
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
 * Confirm payment or cancel a reservation at the counter (pharmacist only)
 * PATCH /api/medicine-orders/:id/status
 * body: { status: 'paid' | 'cancelled' }
 */
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái không hợp lệ' });
    }

    const [orders] = await db.query('SELECT id, status, prescription_id FROM Medicine_Orders WHERE id = ?', [id]);
    if (orders.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn mua thuốc' });
    }
    if (orders[0].status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Chỉ có thể xử lý đơn đang ở trạng thái "Chờ thanh toán"' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // Chỉ chuyển khi vẫn còn pending để tránh hoàn kho 2 lần nếu bấm trùng
      const [updated] = await connection.query(
        "UPDATE Medicine_Orders SET status = ? WHERE id = ? AND status = 'pending'",
        [status, id]
      );
      if (updated.affectedRows === 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Đơn này đã được xử lý' });
      }

      if (status === 'cancelled') {
        const [items] = await connection.query(
          'SELECT medicine_id, quantity FROM Prescription_Items WHERE prescription_id = ?',
          [orders[0].prescription_id]
        );
        for (const item of items) {
          await connection.query('UPDATE Medicines SET stock_quantity = stock_quantity + ? WHERE id = ?', [item.quantity, item.medicine_id]);
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

    return res.status(200).json({
      success: true,
      message: status === 'paid' ? 'Xác nhận thanh toán thành công' : 'Đã hủy đơn giữ chỗ và hoàn lại tồn kho'
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
