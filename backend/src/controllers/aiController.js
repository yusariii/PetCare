const db = require('../config/db');
const { getHealthConsultation } = require('../services/aiService');

/**
 * AI Health Consultation (BR05)
 * POST /api/ai/consult
 * Sends pet info, health history, and all rooms to AI for context-aware diagnosis
 */
exports.askHealthAssistant = async (req, res) => {
  try {
    const { pet_id, user_query } = req.body;

    if (!pet_id || !user_query) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp thông tin thú cưng và mô tả triệu chứng'
      });
    }

    // Verify pet belongs to user
    const [pets] = await db.query(
      'SELECT * FROM Pets WHERE id = ? AND user_id = ?',
      [pet_id, req.user.id]
    );

    if (pets.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thú cưng của bạn'
      });
    }

    const pet = pets[0];

    // Get recent health history
    const [historyRecords] = await db.query(
      'SELECT record_type, title, performed_date FROM Health_Records WHERE pet_id = ? ORDER BY performed_date DESC LIMIT 3',
      [pet_id]
    );

    // BR05: Get all clinic rooms for AI context
    const [rooms] = await db.query(
      'SELECT id, room_code, room_name, floor, description FROM Clinic_Rooms ORDER BY floor, room_code'
    );

    // Get AI consultation
    const aiResult = await getHealthConsultation({
      species: pet.species,
      breed: pet.breed,
      weight_kg: pet.weight_kg,
      birth_date: pet.birth_date,
      historyRecords,
      userQuery: user_query,
      rooms
    });

    // Save consultation to database
    const [result] = await db.query(
      'INSERT INTO AI_Consultations (pet_id, user_query, ai_advice, urgency_level, recommended_room_id) VALUES (?, ?, ?, ?, ?)',
      [
        pet_id,
        user_query,
        aiResult.advice,
        aiResult.urgency_level || 'medium',
        aiResult.recommended_room_id || null
      ]
    );

    return res.status(200).json({
      success: true,
      data: {
        consultation_id: result.insertId,
        advice: aiResult.advice,
        urgency_level: aiResult.urgency_level,
        need_doctor: aiResult.need_doctor,
        recommended_room_id: aiResult.recommended_room_id,
        room_reason: aiResult.room_reason
      }
    });
  } catch (error) {
    console.error('AI_CONSULT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tư vấn với bác sĩ AI. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get consultation history for a pet
 * GET /api/ai/history/:pet_id
 */
exports.getConsultationHistory = async (req, res) => {
  try {
    const { pet_id } = req.params;

    // Verify pet belongs to user
    const [pets] = await db.query(
      'SELECT id FROM Pets WHERE id = ? AND user_id = ?',
      [pet_id, req.user.id]
    );

    if (pets.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền truy cập thông tin này'
      });
    }

    const [history] = await db.query(
      'SELECT * FROM AI_Consultations WHERE pet_id = ? ORDER BY created_at DESC',
      [pet_id]
    );

    return res.status(200).json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('GET_CONSULTATION_HISTORY_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy lịch sử tư vấn. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};