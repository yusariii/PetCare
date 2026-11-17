const db = require('../config/db');
const { ensureInvoiceTables } = require('./invoiceController');

let petActiveColumnEnsured = false;
const ensurePetActiveColumn = async () => {
  if (petActiveColumnEnsured) return;
  try {
    await db.query('ALTER TABLE Pets ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER gender');
  } catch (err) {
    // ignore if column already exists
  }
  petActiveColumnEnsured = true;
};

/**
 * Get all pets for current user
 * GET /api/pets
 */
exports.getMyPets = async (req, res) => {
  try {
    await ensurePetActiveColumn();
    const [pets] = await db.query(
      'SELECT * FROM Pets WHERE user_id = ? AND is_active = 1 ORDER BY created_at DESC',
      [req.user.id]
    );

    return res.status(200).json({
      success: true,
      data: pets
    });
  } catch (error) {
    console.error('GET_MY_PETS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách thú cưng. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create a new pet
 * POST /api/pets
 */
exports.createPet = async (req, res) => {
  try {
    await ensurePetActiveColumn();
    // Hỗ trợ tạo hàng loạt thú cưng cùng lúc (Bulk Create Pets)
    if (Array.isArray(req.body.pets) && req.body.pets.length > 0) {
      const validSpecies = ['dog', 'cat', 'other'];
      const createdIds = [];
      for (const p of req.body.pets) {
        const pName = String(p.name || '').trim();
        const pSpecies = validSpecies.includes(p.species) ? p.species : 'dog';
        if (!pName) continue;
        const [ins] = await db.query(
          `INSERT INTO Pets (user_id, name, species, breed, weight_kg, birth_date, gender)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            req.user.id,
            pName,
            pSpecies,
            p.breed ? String(p.breed).trim() : null,
            p.weight_kg ? Number(p.weight_kg) : null,
            p.birth_date || null,
            p.gender || null
          ]
        );
        createdIds.push(ins.insertId);
      }
      if (createdIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập tên hợp lệ cho ít nhất 1 thú cưng'
        });
      }
      return res.status(201).json({
        success: true,
        message: `Đã thêm thành công ${createdIds.length} thú cưng vào danh sách`,
        data: { pet_ids: createdIds, pet_id: createdIds[0] }
      });
    }

    const { name, species, breed, weight_kg, birth_date, gender } = req.body;

    // Validate required fields
    if (!name || !species) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đủ thông tin: tên và loài thú cưng'
      });
    }

    // Validate species enum
    const validSpecies = ['dog', 'cat', 'other'];
    if (!validSpecies.includes(species)) {
      return res.status(400).json({
        success: false,
        message: 'Loài thú cưng không hợp lệ'
      });
    }

    const [result] = await db.query(
      `INSERT INTO Pets 
       (user_id, name, species, breed, weight_kg, birth_date, gender) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, species, breed || null, weight_kg || null, birth_date || null, gender || null]
    );

    return res.status(201).json({
      success: true,
      message: 'Thêm thú cưng thành công',
      data: { pet_id: result.insertId }
    });
  } catch (error) {
    console.error('CREATE_PET_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi thêm thú cưng. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get pet details with health records and reminders
 * GET /api/pets/:id
 */
exports.getPetDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify pet belongs to user
    const [pets] = await db.query(
      'SELECT * FROM Pets WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (pets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng'
      });
    }

    const pet = pets[0];

    // Get health records
    const [records] = await db.query(
      'SELECT * FROM Health_Records WHERE pet_id = ? ORDER BY performed_date DESC',
      [id]
    );

    // Get reminders
    const [reminders] = await db.query(
      'SELECT * FROM Reminders WHERE pet_id = ? ORDER BY remind_date ASC',
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...pet,
        health_records: records,
        reminders
      }
    });
  } catch (error) {
    console.error('GET_PET_DETAIL_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy thông tin thú cưng. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update pet information
 * PATCH /api/pets/:id
 */
exports.updatePet = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, species, breed, weight_kg, birth_date, gender } = req.body;

    // Verify pet belongs to user
    const [pets] = await db.query(
      'SELECT id FROM Pets WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );

    if (pets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng'
      });
    }

    // Update pet
    await db.query(
      `UPDATE Pets 
       SET name = ?, species = ?, breed = ?, weight_kg = ?, birth_date = ?, gender = ?
       WHERE id = ?`,
      [name, species, breed || null, weight_kg || null, birth_date || null, gender || null, id]
    );

    return res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thú cưng thành công'
    });
  } catch (error) {
    console.error('UPDATE_PET_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật thú cưng. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Delete pet (Hybrid Soft-Delete & Hard-Delete)
 * DELETE /api/pets/:id
 * - Chặn xóa nếu đang có lịch hẹn chưa hoàn thành (pending, confirmed) hoặc hóa đơn dịch vụ/đơn thuốc chờ thanh toán (pending).
 * - Nếu thú cưng chưa từng phát sinh lịch hẹn, bệnh án hay hóa đơn: Xóa vĩnh viễn (Hard Delete).
 * - Nếu thú cưng đã có lịch sử khám, bệnh án hoặc hóa đơn: Chuyển is_active = 0 (Soft Delete) để bảo toàn 100% lịch sử y khoa & kế toán, đồng thời giải phóng slot 5 thú cưng cho khách.
 */
exports.deletePet = async (req, res) => {
  try {
    await ensurePetActiveColumn();
    await ensureInvoiceTables();
    const { id } = req.params;

    // Verify pet belongs to user and is active
    const [pets] = await db.query(
      'SELECT id, name FROM Pets WHERE id = ? AND user_id = ? AND is_active = 1',
      [id, req.user.id]
    );

    if (pets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng trong danh sách của bạn'
      });
    }

    const petName = pets[0].name;

    // 1. Kiểm tra lịch hẹn đang chờ khám hoặc đã xác nhận (pending, confirmed)
    const [activeAppointments] = await db.query(
      `SELECT id, appointment_datetime
       FROM Appointments
       WHERE pet_id = ? AND status IN ('pending', 'confirmed')
       LIMIT 1`,
      [id]
    );
    if (activeAppointments.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bé "${petName}" hiện đang có lịch hẹn chờ khám. Vui lòng hoàn thành hoặc hủy lịch hẹn tại mục "Lịch hẹn" trước khi xóa hồ sơ bé.`
      });
    }

    // 2. Kiểm tra hóa đơn dịch vụ đang chờ thanh toán (pending) tại quầy Thu ngân
    const [pendingInvoices] = await db.query(
      `SELECT id, invoice_code
       FROM Invoices
       WHERE pet_id = ? AND payment_status = 'pending'
       LIMIT 1`,
      [id]
    );
    if (pendingInvoices.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bé "${petName}" đang có hóa đơn viện phí chờ thanh toán (${pendingInvoices[0].invoice_code}). Vui lòng hoàn tất thanh toán trước khi xóa hồ sơ bé.`
      });
    }

    // 3. Kiểm tra đơn thuốc đang chờ thanh toán (pending) tại quầy Dược
    const [pendingMedOrders] = await db.query(
      `SELECT mo.id, mo.order_code
       FROM Medicine_Orders mo
       JOIN Prescriptions pr ON pr.id = mo.prescription_id
       WHERE pr.pet_id = ? AND mo.status = 'pending'
       LIMIT 1`,
      [id]
    );
    if (pendingMedOrders.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Bé "${petName}" đang có đơn thuốc chờ nhận tại quầy dược. Vui lòng hoàn tất đơn thuốc trước khi xóa hồ sơ bé.`
      });
    }

    // 4. Kiểm tra xem bé đã từng có lịch sử y tế / lịch hẹn / hóa đơn nào chưa
    const [[appCount], [hrCount], [invCount]] = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM Appointments WHERE pet_id = ?', [id]),
      db.query('SELECT COUNT(*) as total FROM Health_Records WHERE pet_id = ?', [id]),
      db.query('SELECT COUNT(*) as total FROM Invoices WHERE pet_id = ?', [id])
    ]);

    const hasHistory =
      (appCount[0]?.total || 0) > 0 ||
      (hrCount[0]?.total || 0) > 0 ||
      (invCount[0]?.total || 0) > 0;

    if (hasHistory) {
      // Tầng 2 (Soft Delete): Ẩn khỏi danh sách thú cưng của khách nhưng giữ nguyên toàn bộ lịch hẹn cũ, bệnh án, đơn thuốc và hóa đơn
      await db.query('UPDATE Pets SET is_active = 0 WHERE id = ?', [id]);
      return res.status(200).json({
        success: true,
        deletion_type: 'archived',
        message: `Đã xóa bé "${petName}" khỏi danh sách thú cưng hiện tại. Các lịch sử khám bệnh, đơn thuốc và hóa đơn cũ của bé vẫn được lưu trữ an toàn.`
      });
    }

    // Tầng 1 (Hard Delete): Bé mới tạo nhầm, chưa từng có lịch hẹn hay hóa đơn nào -> Xóa sạch khỏi DB
    await db.query('DELETE FROM Pets WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      deletion_type: 'deleted',
      message: `Đã xóa hồ sơ bé "${petName}" thành công.`
    });
  } catch (error) {
    console.error('DELETE_PET_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa thú cưng. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};