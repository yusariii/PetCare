const db = require('../config/db');
const { logStockMovement } = require('../utils/stockLog');

/**
 * List medicines (doctor: chỉ thuốc đang hoạt động để kê đơn; admin/pharmacist: toàn bộ danh mục)
 * GET /api/medicines
 */
exports.listMedicines = async (req, res) => {
  try {
    const onlyActive = req.user.role === 'doctor';
    const [medicines] = await db.query(
      `SELECT * FROM Medicines ${onlyActive ? 'WHERE is_active = TRUE' : ''} ORDER BY name`
    );
    return res.status(200).json({ success: true, data: medicines });
  } catch (error) {
    console.error('LIST_MEDICINES_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh mục thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create a medicine (admin/pharmacist)
 * POST /api/medicines
 */
exports.createMedicine = async (req, res) => {
  try {
    const { name, unit, price, stock_quantity, description } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập tên thuốc và giá bán' });
    }
    if (Number(price) < 0 || Number(stock_quantity || 0) < 0) {
      return res.status(400).json({ success: false, message: 'Giá và tồn kho không được âm' });
    }

    const initialStock = Number(stock_quantity) || 0;
    const connection = await db.getConnection();
    let medicineId;
    try {
      await connection.beginTransaction();
      const [result] = await connection.query(
        'INSERT INTO Medicines (name, unit, price, stock_quantity, description) VALUES (?, ?, ?, ?, ?)',
        [name, unit || 'viên', price, initialStock, description || null]
      );
      medicineId = result.insertId;
      if (initialStock > 0) {
        await logStockMovement(connection, {
          medicineId, change: initialStock, type: 'initial', note: 'Tồn kho ban đầu', userId: req.user.id
        });
      }
      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

    return res.status(201).json({ success: true, message: 'Thêm thuốc thành công', data: { medicine_id: medicineId } });
  } catch (error) {
    console.error('CREATE_MEDICINE_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi thêm thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update medicine info (admin/pharmacist)
 * PUT /api/medicines/:id
 */
exports.updateMedicine = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, unit, price, description, is_active } = req.body;

    if (price !== undefined && Number(price) < 0) {
      return res.status(400).json({ success: false, message: 'Giá không được âm' });
    }

    const [result] = await db.query(
      `UPDATE Medicines SET
        name = COALESCE(?, name),
        unit = COALESCE(?, unit),
        price = COALESCE(?, price),
        description = COALESCE(?, description),
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [name || null, unit || null, price ?? null, description ?? null, is_active ?? null, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thuốc' });
    }

    return res.status(200).json({ success: true, message: 'Cập nhật thuốc thành công' });
  } catch (error) {
    console.error('UPDATE_MEDICINE_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Adjust stock quantity, e.g. khi nhập thêm hàng (admin/pharmacist)
 * PATCH /api/medicines/:id/stock
 * body: { delta, note } - số dương để nhập thêm, số âm để điều chỉnh giảm
 */
exports.adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { delta, note } = req.body;
    const deltaNum = Number(delta);

    if (delta === undefined || !Number.isInteger(deltaNum) || deltaNum === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập số lượng điều chỉnh hợp lệ (khác 0)' });
    }

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        'UPDATE Medicines SET stock_quantity = stock_quantity + ? WHERE id = ? AND stock_quantity + ? >= 0',
        [deltaNum, id, deltaNum]
      );

      if (result.affectedRows === 0) {
        await connection.rollback();
        return res.status(400).json({ success: false, message: 'Không thể điều chỉnh: thuốc không tồn tại hoặc tồn kho sẽ bị âm' });
      }

      await logStockMovement(connection, {
        medicineId: id,
        change: deltaNum,
        type: deltaNum > 0 ? 'import' : 'adjust',
        note: note ? String(note).slice(0, 255) : null,
        userId: req.user.id
      });
      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

    return res.status(200).json({ success: true, message: 'Cập nhật tồn kho thành công' });
  } catch (error) {
    console.error('ADJUST_STOCK_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật tồn kho. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Stock movement history of a medicine, newest first (admin/pharmacist)
 * GET /api/medicines/:id/movements
 */
exports.listMovements = async (req, res) => {
  try {
    const [movements] = await db.query(`
      SELECT sm.id, sm.change_qty, sm.quantity_after, sm.movement_type, sm.note, sm.order_id, sm.created_at,
        u.full_name as created_by_name
      FROM Stock_Movements sm
      LEFT JOIN Users u ON u.id = sm.created_by
      WHERE sm.medicine_id = ?
      ORDER BY sm.created_at DESC, sm.id DESC
      LIMIT 50
    `, [req.params.id]);
    return res.status(200).json({ success: true, data: movements });
  } catch (error) {
    console.error('LIST_MOVEMENTS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử tồn kho. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
