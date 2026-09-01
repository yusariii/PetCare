const ai = require('../config/gemini');
const db = require('../config/db');

/**
 * BR05: AI Context-Aware Prompting
 * Fetch all rooms and generate consultation with room recommendations
 */
exports.getHealthConsultation = async ({ species, breed, weight_kg, birth_date, historyRecords, userQuery, rooms }) => {
    // Build history text
    const historyText = historyRecords.length > 0
        ? historyRecords.map(r => `- ${r.record_type}: ${r.title} (${r.performed_date})`).join('\n')
        : 'Chưa có tiền sử bệnh hoặc tiêm chủng';

    // Build rooms context
    const roomsText = rooms.length > 0
        ? rooms.map(r => `[ID: ${r.id}, Mã: ${r.room_code}, Tên: ${r.room_name}, Tầng: ${r.floor}]`).join('\n')
        : 'Không có phòng khám nào';

    const prompt = `
Bạn là Bác sĩ Trưởng chuyên nghiệp của Bệnh viện Thú y PetCare. Phân tích triệu chứng sau và đưa ra tư vấn chuyên nghiệp.

DANH SÁCH CÁC PHÒNG KHÁM CHUYÊN KHOA CÓ TRONG BỆNH VIỆN:
${roomsText}

THÔNG TIN THÚ CƯNG CẦN KHÁM:
- Loài: ${species}
- Giống: ${breed || 'Chưa xác định'}
- Cân nặng: ${weight_kg ? weight_kg + ' kg' : 'Chưa xác định'}
- Ngày sinh: ${birth_date || 'Chưa xác định'}

TIỀN SỬ Y TẾ GẦN NHẤT:
${historyText}

MÔ TẢ TRIỆU CHỨNG:
"${userQuery}"

YÊUCẦU: Phân tích và trả về DUY NHẤT một chuỗi JSON thuần (không dùng markdown codeblock hoặc ký tự đặc biệt):
{
  "advice": "Lời khuyên chi tiết, giải thích nguyên nhân tiềm ẩn, mức độ nguy hiểm và hướng dẫn sơ cứu tại nhà nếu có",
  "urgency_level": "low|medium|high",
  "need_doctor": true|false,
  "recommended_room_id": <số ID của phòng phù hợp nhất từ danh sách trên>,
  "room_reason": "Giải thích ngắn gọn tại sao nên đặt lịch tại phòng này"
}
  `.trim();

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });

    const rawText = response.text.replace(/```json|```/g, '').trim();
    try {
        return JSON.parse(rawText);
    } catch (err) {
        console.error('AI_JSON_PARSE_ERROR:', err.message);
        return {
            advice: rawText,
            urgency_level: 'medium',
            need_doctor: true,
            recommended_room_id: null,
            room_reason: 'Vui lòng liên hệ với bác sĩ để được tư vấn chi tiết'
        };
    }
};