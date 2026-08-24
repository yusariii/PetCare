const ai = require('../config/gemini');

exports.getHealthConsultation = async ({ species, breed, weight_kg, birth_date, historyRecords, userQuery }) => {
    const historyText = historyRecords.length > 0
        ? historyRecords.map(r => `- ${r.record_type}: ${r.title} (${r.performed_date})`).join('\n')
        : 'Chưa có tiền sử bệnh hoặc tiêm chủng';

    const prompt = `
Bạn là bác sĩ thú y ảo chuyên nghiệp. Phân tích triệu chứng sau:
- Thú cưng: ${species}, giống: ${breed || 'Chưa rõ'}, cân nặng: ${weight_kg ? weight_kg + 'kg' : 'Chưa rõ'}, sinh ngày: ${birth_date || 'Chưa rõ'}
- Tiền sử gần nhất:
${historyText}
- Triệu chứng chủ nuôi phản ánh: "${userQuery}"

Hãy phân tích và trả về DUY NHẤT một JSON string chuẩn (không kèm markdown \`\`\`json):
{
  "advice": "Lời khuyên chi tiết, giải thích nguyên nhân và hướng dẫn chăm sóc sơ bộ",
  "urgency_level": "low" | "medium" | "high",
  "need_doctor": true | false
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
        return {
            advice: rawText,
            urgency_level: 'medium',
            need_doctor: false,
        };
    }
};