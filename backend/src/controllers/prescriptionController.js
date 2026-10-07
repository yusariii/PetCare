const db = require('../config/db');

/**
 * Create a prescription for a completed health record (doctor only, must be the author of that record)
 * POST /api/prescriptions
 * body: { health_record_id, notes, items: [{ medicine_id, dosage, quantity }] }
 */
exports.createPrescription = async (req, res) => {
  try {
    const { health_record_id, notes, items } = req.body;

    if (!health_record_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn bệnh án và ít nhất 1 loại thuốc'
      });
    }

    for (const item of items) {
      if (!item.medicine_id || !item.dosage || !Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Mỗi thuốc trong đơn cần có liều dùng và số lượng hợp lệ (> 0)'
        });
      }
    }

    const [records] = await db.query(
      'SELECT id, doctor_id, pet_id FROM Health_Records WHERE id = ?',
      [health_record_id]
    );
    if (records.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy bệnh án' });
    }
    // Bác sĩ chỉ được kê đơn cho chính ca khám mình thực hiện
    if (records[0].doctor_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn chỉ có thể kê đơn cho bệnh án do chính mình khám' });
    }

    const medicineIds = [...new Set(items.map((i) => Number(i.medicine_id)))];
    const placeholders = medicineIds.map(() => '?').join(',');
    const [medicines] = await db.query(
      `SELECT id, price, is_active FROM Medicines WHERE id IN (${placeholders})`,
      medicineIds
    );
    const medicineMap = new Map(medicines.map((m) => [m.id, m]));

    for (const id of medicineIds) {
      const med = medicineMap.get(id);
      if (!med || !med.is_active) {
        return res.status(400).json({ success: false, message: `Thuốc (id=${id}) không tồn tại hoặc đã ngừng kinh doanh` });
      }
    }

    const connection = await db.getConnection();
    let prescriptionId;
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        'INSERT INTO Prescriptions (health_record_id, doctor_id, pet_id, notes) VALUES (?, ?, ?, ?)',
        [health_record_id, req.user.id, records[0].pet_id, notes || null]
      );
      prescriptionId = result.insertId;

      const itemValues = items.map((item) => [
        prescriptionId,
        item.medicine_id,
        item.dosage,
        item.quantity,
        medicineMap.get(Number(item.medicine_id)).price
      ]);
      await connection.query(
        'INSERT INTO Prescription_Items (prescription_id, medicine_id, dosage, quantity, unit_price) VALUES ?',
        [itemValues]
      );

      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

    return res.status(201).json({
      success: true,
      message: 'Kê đơn thuốc thành công',
      data: { prescription_id: prescriptionId }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Bệnh án này đã có đơn thuốc' });
    }
    console.error('CREATE_PRESCRIPTION_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi kê đơn thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get prescriptions for a pet (customer: only own pet)
 * GET /api/prescriptions/pet/:pet_id
 */
exports.getPetPrescriptions = async (req, res) => {
  try {
    const { pet_id } = req.params;

    if (req.user.role === 'customer') {
      const [pets] = await db.query('SELECT id FROM Pets WHERE id = ? AND user_id = ?', [pet_id, req.user.id]);
      if (pets.length === 0) {
        return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập thông tin này' });
      }
    }

    const [prescriptions] = await db.query(`
      SELECT
        p.id, p.health_record_id, p.notes, p.created_at,
        hr.title as health_record_title,
        CONCAT(u.full_name) as doctor_name,
        (SELECT id FROM Medicine_Orders mo WHERE mo.prescription_id = p.id ORDER BY mo.id DESC LIMIT 1) as latest_order_id,
        (SELECT status FROM Medicine_Orders mo WHERE mo.prescription_id = p.id ORDER BY mo.id DESC LIMIT 1) as latest_order_status
      FROM Prescriptions p
      JOIN Health_Records hr ON hr.id = p.health_record_id
      JOIN Users u ON u.id = p.doctor_id
      WHERE p.pet_id = ?
      ORDER BY p.created_at DESC
    `, [pet_id]);

    return res.status(200).json({ success: true, data: prescriptions });
  } catch (error) {
    console.error('GET_PET_PRESCRIPTIONS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách đơn thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get full detail of a prescription including items
 * GET /api/prescriptions/:id
 */
exports.getPrescriptionDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const [prescriptions] = await db.query(`
      SELECT p.*, pt.user_id as pet_owner_id
      FROM Prescriptions p
      JOIN Pets pt ON pt.id = p.pet_id
      WHERE p.id = ?
    `, [id]);

    if (prescriptions.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy đơn thuốc' });
    }

    const prescription = prescriptions[0];
    if (req.user.role === 'customer' && prescription.pet_owner_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập đơn thuốc này' });
    }

    const [items] = await db.query(`
      SELECT pi.id, pi.medicine_id, pi.dosage, pi.quantity, pi.unit_price, m.name as medicine_name, m.unit
      FROM Prescription_Items pi
      JOIN Medicines m ON m.id = pi.medicine_id
      WHERE pi.prescription_id = ?
    `, [id]);

    return res.status(200).json({ success: true, data: { ...prescription, items } });
  } catch (error) {
    console.error('GET_PRESCRIPTION_DETAIL_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy chi tiết đơn thuốc. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
