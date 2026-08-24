const db = require('../config/db');
const { getHealthConsultation } = require('../services/aiService');

exports.askHealthAssistant = async (req, res) => {
  try {
    const { pet_id, user_query } = req.body;
    if (!pet_id || !user_query) {
      return res.status(400).json({ success: false, message: 'Thông tin pet_id và câu hỏi là bắt buộc' });
    }

    const [pets] = await db.query('SELECT * FROM Pets WHERE id = ? AND user_id = ?', [pet_id, req.user.id]);
    if (pets.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thú cưng của bạn' });
    }
    const pet = pets[0];

    const [historyRecords] = await db.query(
      'SELECT record_type, title, performed_date FROM Health_Records WHERE pet_id = ? ORDER BY performed_date DESC LIMIT 3',
      [pet_id]
    );

    const aiResult = await getHealthConsultation({
      species: pet.species,
      breed: pet.breed,
      weight_kg: pet.weight_kg,
      birth_date: pet.birth_date,
      historyRecords,
      userQuery: user_query,
    });

    await db.query(
      'INSERT INTO AI_Consultations (pet_id, user_query, ai_advice, urgency_level) VALUES (?, ?, ?, ?)',
      [pet_id, user_query, aiResult.advice, aiResult.urgency_level]
    );

    return res.status(200).json({
      success: true,
      data: aiResult
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getConsultationHistory = async (req, res) => {
  try {
    const { pet_id } = req.params;
    const [history] = await db.query(
      'SELECT * FROM AI_Consultations WHERE pet_id = ? ORDER BY created_at DESC',
      [pet_id]
    );
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};