const db = require('../config/db');

/**
 * Get all pets for current user
 * GET /api/pets
 */
exports.getMyPets = async (req, res) => {
  try {
    const [pets] = await db.query(
      'SELECT * FROM Pets WHERE user_id = ? ORDER BY created_at DESC',
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
 * Delete pet
 * DELETE /api/pets/:id
 */
exports.deletePet = async (req, res) => {
  try {
    const { id } = req.params;

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

    // Delete pet (cascading delete will handle related records)
    await db.query('DELETE FROM Pets WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Xóa thú cưng thành công'
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