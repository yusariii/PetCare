const db = require('../config/db');

/**
 * Trả về id phòng khám mà bác sĩ đang phụ trách (null nếu chưa được admin gán phòng).
 */
exports.getOwnRoomId = async (doctorId) => {
  const [rooms] = await db.query('SELECT id FROM Clinic_Rooms WHERE doctor_id = ?', [doctorId]);
  return rooms.length > 0 ? rooms[0].id : null;
};
