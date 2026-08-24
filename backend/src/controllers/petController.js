const db = require('../config/db');

exports.getMyPets = async (req, res) => {
  try {
    const [pets] = await db.query('SELECT * FROM Pets WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
    return res.status(200).json({ success: true, data: pets });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPet = async (req, res) => {
  try {
    const { name, species, breed, weight_kg, birth_date, gender } = req.body;
    if (!name || !species) {
      return res.status(400).json({ success: false, message: 'Tên và loài thú cưng là bắt buộc' });
    }

    const [result] = await db.query(
      'INSERT INTO Pets (user_id, name, species, breed, weight_kg, birth_date, gender) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, name, species, breed || null, weight_kg || null, birth_date || null, gender || null]
    );

    return res.status(201).json({ success: true, message: 'Thêm thú cưng thành công', petId: result.insertId });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPetDetail = async (req, res) => {
  try {
    const { id } = req.params;
    const [pets] = await db.query('SELECT * FROM Pets WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (pets.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng' });
    }

    const [records] = await db.query('SELECT * FROM Health_Records WHERE pet_id = ? ORDER BY performed_date DESC', [id]);
    const [reminders] = await db.query('SELECT * FROM Reminders WHERE pet_id = ? ORDER BY remind_date ASC', [id]);

    return res.status(200).json({
      success: true,
      data: { ...pets[0], health_records: records, reminders }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.addHealthRecord = async (req, res) => {
  try {
    const { id } = req.params; // pet_id
    const { record_type, title, description, performed_date, next_due_date } = req.body;

    const [result] = await db.query(
      'INSERT INTO Health_Records (pet_id, record_type, title, description, performed_date, next_due_date) VALUES (?, ?, ?, ?, ?, ?)',
      [id, record_type, title, description || null, performed_date, next_due_date || null]
    );
    
    if (next_due_date) {
      await db.query(
        'INSERT INTO Reminders (pet_id, title, remind_date, is_sent) VALUES (?, ?, ?, FALSE)',
        [id, `Tái hẹn: ${title}`, next_due_date]
      );
    }

    return res.status(201).json({ success: true, message: 'Thêm nhật ký khám/tiêm thành công' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};