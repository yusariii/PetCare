const ai = require('../config/gemini');
const db = require('../config/db');

exports.consultPetHealth = async (req, res) => {
  try {
    const { petId, userQuery } = req.body;

    if (!petId || !userQuery) {
      return res.status(400).json({ message: 'Thú cưng và nội dung câu hỏi là bắt buộc' });
    }

    const [rows] = await db.query('SELECT * FROM Pets WHERE id = ?', [petId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy thông tin thú cưng' });
    }
    const pet = rows[0];

    const prompt = `
      Bạn là một bác sĩ thú y giàu kinh nghiệm. 
      Hãy tư vấn sức khỏe dựa trên các thông tin sau:
      - Loại thú cưng: ${pet.species}
      - Giống: ${pet.breed || 'Chưa rõ'}
      - Cân nặng: ${pet.weight_kg ? pet.weight_kg + 'kg' : 'Chưa rõ'}
      - Giới tính: ${pet.gender || 'Chưa rõ'}
      - Triệu chứng/Thắc mắc của chủ nuôi: "${userQuery}"

      Hãy trả về kết quả định dạng JSON thuần (không dùng markdown codeblock ``json) với 3 trường:
      1. "advice": Lời khuyên chi tiết, giải thích nguyên nhân và hướng xử lý.
      2. "urgency_level": Chọn 1 trong 3 giá trị ["low", "medium", "high"].
      3. "need_doctor": Giá trị boolean (true nếu cần mang đi phòng khám ngay, false nếu theo dõi thêm).
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const responseText = response.text;
    let parsedResult;

    try {
      parsedResult = JSON.parse(responseText);
    } catch (e) {
      parsedResult = {
        advice: responseText,
        urgency_level: 'medium',
        need_doctor: false
      };
    }

    await db.query(
      `INSERT INTO AI_Consultations (pet_id, user_query, ai_advice, urgency_level) VALUES (?, ?, ?, ?)`,
      [petId, userQuery, parsedResult.advice, parsedResult.urgency_level]
    );

    return res.status(200).json({
      success: true,
      data: parsedResult
    });

  } catch (error) {
    console.error('Lỗi tư vấn AI:', error);
    return res.status(500).json({ message: 'Lỗi hệ thống khi xử lý tư vấn AI', error: error.message });
  }
};