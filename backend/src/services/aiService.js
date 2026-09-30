const ai = require('../config/gemini');
const { retrieveRelevantDocuments } = require('./ragService');

/**
 * BR05: RAG-grounded AI consultation.
 * The AI must base its diagnosis strictly on doctor-provided reference documents
 * retrieved from the knowledge base (Medical_Documents), instead of inventing medical facts.
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

    // RAG: retrieve doctor-provided documents relevant to the symptom description
    const sources = await retrieveRelevantDocuments({ query: userQuery, species, topK: 4 });

    const referenceText = sources.length > 0
        ? sources.map((s, i) => `[Tài liệu ${i + 1} - ${s.category || 'Chung'}] ${s.title}:\n${s.content}`).join('\n\n')
        : 'KHÔNG TÌM THẤY tài liệu tham khảo nào phù hợp với triệu chứng này trong cơ sở tri thức.';

    const prompt = `
Bạn là Bác sĩ Trưởng chuyên nghiệp của Bệnh viện Thú y PetCare.

QUY TẮC BẮT BUỘC:
- CHỈ được đưa ra chẩn đoán, nguyên nhân và hướng xử trí dựa TRÊN NỘI DUNG của các TÀI LIỆU THAM KHẢO bên dưới do bác sĩ của bệnh viện cung cấp.
- KHÔNG được tự bịa ra thông tin y khoa không có trong tài liệu tham khảo.
- Nếu tài liệu tham khảo không đủ để kết luận hoặc không có tài liệu phù hợp, PHẢI nói rõ rằng chưa đủ cơ sở để chẩn đoán và khuyên đặt lịch khám trực tiếp với bác sĩ, thay vì đoán mò.

TÀI LIỆU THAM KHẢO:
${referenceText}

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

YÊU CẦU: Phân tích và trả về DUY NHẤT một chuỗi JSON thuần (không dùng markdown codeblock hoặc ký tự đặc biệt):
{
  "advice": "Lời khuyên chi tiết dựa trên tài liệu tham khảo, giải thích nguyên nhân tiềm ẩn, mức độ nguy hiểm và hướng dẫn sơ cứu tại nhà nếu có. Nếu tài liệu không đủ, hãy nói rõ điều đó thay vì đoán mò.",
  "urgency_level": "low|medium|high",
  "need_doctor": true|false,
  "recommended_room_id": <số ID của phòng phù hợp nhất từ danh sách trên>,
  "room_reason": "Giải thích ngắn gọn tại sao nên đặt lịch tại phòng này"
}
  `.trim();

    const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
    });

    const rawText = response.text.replace(/```json|```/g, '').trim();
    const documentSources = sources.map(s => ({
        id: s.id,
        title: s.title,
        category: s.category,
        similarity: Number(s.score.toFixed(3))
    }));

    try {
        return { ...JSON.parse(rawText), sources: documentSources };
    } catch (err) {
        console.error('AI_JSON_PARSE_ERROR:', err.message);
        return {
            advice: rawText,
            urgency_level: 'medium',
            need_doctor: true,
            recommended_room_id: null,
            room_reason: 'Vui lòng liên hệ với bác sĩ để được tư vấn chi tiết',
            sources: documentSources
        };
    }
};