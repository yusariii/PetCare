const db = require('../config/db');
const { getOwnRoomId } = require('../utils/doctorScope');
const { ensureInvoiceTables, syncAppointmentPendingInvoice } = require('./invoiceController');

// Danh sách mã phòng chỉ dành cho Bác sĩ chỉ định nội viện (Vetstoria Online Booking Exclusions)
const REFERRAL_ONLY_ROOM_CODES = ['P103', 'P202', 'P203'];

// Danh sách từ khóa triệu chứng cấp cứu nguy kịch (Vetstoria Emergency Triage & Screening)
const EMERGENCY_TRIAGE_KEYWORDS = [
  'chảy máu nhiều',
  'mất máu',
  'co giật',
  'bất tỉnh',
  'hôn mê',
  'ngộ độc',
  'uống thuốc độc',
  'ăn bả',
  'bả chó',
  'khó thở nặng',
  'thở gấp',
  'tím tái',
  'gãy xương',
  'tai nạn',
  'xe tông',
  'sùi bọt mép',
  'nôn ra máu',
  'đi ngoài ra máu tươi',
  'vỡ bụng',
  'trúng độc'
];

const detectEmergencyKeywords = (notesText) => {
  if (!notesText || typeof notesText !== 'string') return [];
  const normalized = notesText.toLowerCase();
  return EMERGENCY_TRIAGE_KEYWORDS.filter((kw) => normalized.includes(kw));
};

/**
 * Tự động quét và xử lý các lịch hẹn quá ngày (DATE(appointment_datetime) < CURDATE())
 * mà vẫn treo ở trạng thái 'pending' hoặc 'confirmed':
 * - 'pending' quá hạn -> chuyển sang 'cancelled' (Quá hạn chưa xác nhận, không tính phạt khách)
 * - 'confirmed' quá hạn nhưng khách không đến -> chuyển sang 'cancelled' kèm tag '[VẮNG MẶT - KHÔNG ĐẾN KHÁM]'
 *   và ghi nhận 1 lượt No-Show (penalty_weight = 2) vào User_Cancellation_Logs.
 */
const sweepOverdueAppointments = async () => {
  try {
    await ensureInvoiceTables();

    // 1. Các lịch 'confirmed' quá ngày mà khách không đến (No-Show) -> Mất cọc (forfeited) nếu có đặt cọc
    const [overdueConfirmed] = await db.query(
      `SELECT id, user_id, notes, COALESCE(deposit_amount, 0) as deposit_amount, deposit_status
       FROM Appointments
       WHERE status = 'confirmed'
         AND DATE(appointment_datetime) < CURDATE()`
    );

    for (const apt of overdueConfirmed) {
      const currentNotes = apt.notes ? String(apt.notes).trim() : '';
      const hasDeposit = Number(apt.deposit_amount || 0) > 0;
      const noShowTag = hasDeposit
        ? `[VẮNG MẶT - MẤT CỌC 50%: ${Number(apt.deposit_amount).toLocaleString('vi-VN')}đ]`
        : '[VẮNG MẶT - KHÔNG ĐẾN KHÁM]';
      const updatedNotes = currentNotes.includes('[VẮNG MẶT')
        ? currentNotes
        : currentNotes
        ? `${noShowTag} ${currentNotes}`
        : noShowTag;

      await db.query(
        `UPDATE Appointments
         SET status = 'cancelled',
             deposit_status = CASE WHEN COALESCE(deposit_amount, 0) > 0 THEN 'forfeited' ELSE deposit_status END,
             notes = ?
         WHERE id = ? AND status = 'confirmed'`,
        [updatedNotes, apt.id]
      );

      const [existingLog] = await db.query(
        "SELECT id FROM User_Cancellation_Logs WHERE appointment_id = ? AND log_type = 'no_show' LIMIT 1",
        [apt.id]
      );
      if (existingLog.length === 0) {
        await db.query(
          "INSERT INTO User_Cancellation_Logs (user_id, appointment_id, log_type, penalty_weight) VALUES (?, ?, 'no_show', 2)",
          [apt.user_id, apt.id]
        );
      }
    }

    // 2. Các lịch 'pending' quá ngày chưa được viện duyệt -> tự động hủy quá hạn (không phạt khách, hoàn cọc nếu có)
    await db.query(
      `UPDATE Appointments
       SET status = 'cancelled',
           deposit_status = CASE WHEN COALESCE(deposit_amount, 0) > 0 THEN 'refunded' ELSE deposit_status END,
           notes = CASE
             WHEN notes IS NULL OR notes = '' THEN '[HỦY TỰ ĐỘNG - QUÁ NGÀY HẸN]'
             WHEN notes LIKE '%[HỦY TỰ ĐỘNG%' THEN notes
             ELSE CONCAT('[HỦY TỰ ĐỘNG - QUÁ NGÀY HẸN] ', notes)
           END
       WHERE status = 'pending'
         AND DATE(appointment_datetime) < CURDATE()`
    );
  } catch (err) {
    console.error('SWEEP_OVERDUE_APPOINTMENTS_ERROR:', err.message);
  }
};

exports.sweepOverdueAppointments = sweepOverdueAppointments;

/**
 * Chuẩn hoá thời gian về chuỗi giờ địa phương "YYYY-MM-DD HH:mm:ss" để lưu vào cột DATETIME.
 * - "2026-10-16 08:00:00" / "2026-10-16T08:00" (không có múi giờ) => giữ nguyên giờ 08:00
 * - "2026-10-16T01:00:00.000Z" (ISO UTC từ client cũ) => quy đổi về giờ địa phương 08:00
 * MySQL/MariaDB sẽ cắt bỏ hậu tố "Z" nếu lưu trực tiếp chuỗi ISO, gây lệch múi giờ.
 */
const toLocalDbDatetime = (value) => {
  if (!value) return null;
  const normalized = typeof value === 'string' && !/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)
    ? value.trim().replace(' ', 'T')
    : value;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

/**
 * Get all services
 * GET /api/appointments/services
 */
exports.getServices = async (req, res) => {
  try {
    const [services] = await db.query(`
      SELECT s.*, cr.room_code, cr.room_name FROM Services s
      JOIN Clinic_Rooms cr ON s.room_id = cr.id
      ORDER BY cr.room_code, s.service_name
    `);
    return res.status(200).json({ success: true, data: services });
  } catch (error) {
    console.error('GET_SERVICES_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách dịch vụ. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Create appointment (customer only)
 * POST /api/appointments
 * BR01: Check max_slot_per_hour for the room
 * BR02: appointment_datetime >= NOW() + 60 minutes
 */
exports.createAppointment = async (req, res) => {
  try {
    const {
      pet_id,
      pet_ids,
      service_id,
      service_ids,
      room_id,
      notes,
      deposit_confirmed
    } = req.body;
    const appointment_datetime = toLocalDbDatetime(req.body.appointment_datetime);

    const petIds = Array.isArray(pet_ids) && pet_ids.length > 0
      ? [...new Set(pet_ids.map(Number).filter(Number.isInteger))]
      : pet_id
      ? [Number(pet_id)]
      : [];

    const serviceIds = Array.isArray(service_ids)
      ? [...new Set(service_ids.map(Number).filter(Number.isInteger))]
      : [Number(service_id)];
    const primaryServiceId = serviceIds[0];

    // Validate required fields
    if (petIds.length === 0 || !primaryServiceId || !room_id || !appointment_datetime || serviceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đủ thông tin bắt buộc'
      });
    }

    // BR02: Check if appointment time is at least 60 minutes in the future
    const appointmentTime = new Date(appointment_datetime.replace(' ', 'T'));
    const now = new Date();
    const minBookingTime = new Date(now.getTime() + 60 * 60 * 1000);

    if (appointmentTime < minBookingTime) {
      return res.status(400).json({
        success: false,
        message: 'Lịch hẹn phải đặt trước thời điểm hiện tại ít nhất 60 phút'
      });
    }

    // Verify all selected pets belong to user and are active
    const petPlaceholders = petIds.map(() => '?').join(',');
    const [pets] = await db.query(
      `SELECT id, name FROM Pets WHERE id IN (${petPlaceholders}) AND user_id = ? AND (is_active IS NULL OR is_active = 1)`,
      [...petIds, req.user.id]
    );
    if (pets.length !== petIds.length) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy một hoặc nhiều thú cưng của bạn (hoặc hồ sơ đã bị lưu trữ)'
      });
    }
    const petMap = new Map(pets.map((p) => [Number(p.id), p.name]));

    // Verify service belongs to room & get prices
    const servicePlaceholders = serviceIds.map(() => '?').join(',');
    const [services] = await db.query(
      `SELECT id, service_name, price FROM Services WHERE id IN (${servicePlaceholders}) AND room_id = ?`,
      [...serviceIds, room_id]
    );
    if (services.length !== serviceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Dịch vụ không tồn tại cho phòng khám này'
      });
    }

    const singlePetPrice = services.reduce((sum, s) => sum + Number(s.price || 0), 0);

    await ensureInvoiceTables();
    await sweepOverdueAppointments();

    // Cơ chế Vetstoria 1 (Emergency Triage & Screening): Sàng lọc triệu chứng cấp cứu nguy kịch trong phần Ghi chú
    const matchedEmergencyKeywords = detectEmergencyKeywords(notes);
    if (matchedEmergencyKeywords.length > 0) {
      return res.status(400).json({
        success: false,
        is_emergency_triage: true,
        matched_keywords: matchedEmergencyKeywords,
        message: `CẢNH BÁO CẤP CỨU THÚ Y: Hệ thống phát hiện dấu hiệu nguy kịch (${matchedEmergencyKeywords.join(', ')}). Trường hợp này KHÔNG NÊN đặt lịch hẹn chờ trực tuyến! Vui lòng đưa bé đến ngay Sảnh Cấp Cứu (Tầng 1 - P101/P102) để Bác sĩ tiếp nhận khẩn cấp không cần chờ lịch.`
      });
    }

    // Chốt 4a: Chế tài chống "Bom lịch" (No-Show: Đã được Bác sĩ xác nhận nhưng không đến >= 2 lần trong 7 ngày gần nhất -> khóa đặt lịch online 3 ngày)
    const [noShowLogs] = await db.query(
      `SELECT COUNT(*) as total
       FROM User_Cancellation_Logs
       WHERE user_id = ?
         AND log_type = 'no_show'
         AND cancelled_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
      [req.user.id]
    );
    if ((noShowLogs[0]?.total || 0) >= 2) {
      return res.status(400).json({
        success: false,
        message: 'Tài khoản của bạn đã có từ 2 lần đặt lịch được Bác sĩ xác nhận nhưng vắng mặt không đến khám (No-Show) trong 7 ngày qua. Quyền đặt lịch trực tuyến tạm khóa — vui lòng đưa bé đến trực tiếp quầy tiếp nhận của bệnh viện.'
      });
    }

    // Chốt 4b: Chống spam Đặt – Hủy liên tục hoặc bỏ lịch trong ngày (tổng điểm vi phạm >= 3 điểm/ngày; Hủy thường = 1 điểm, Không đến khám No-Show = 2 điểm)
    const [cancelLogs] = await db.query(
      `SELECT COALESCE(SUM(COALESCE(penalty_weight, 1)), 0) as total_points
       FROM User_Cancellation_Logs
       WHERE user_id = ? AND DATE(cancelled_at) = CURDATE()`,
      [req.user.id]
    );
    if (Number(cancelLogs[0]?.total_points || 0) >= 3) {
      return res.status(400).json({
        success: false,
        message: 'Bạn đã hủy lịch hoặc vắng mặt quá giới hạn cho phép trong hôm nay (tối đa 3 điểm vi phạm/ngày; mỗi lần tự hủy = 1 điểm, bác sĩ đã xác nhận nhưng không đến = 2 điểm). Quyền đặt lịch mới tạm khóa trong ngày hôm nay.'
      });
    }

    // BR01: Check current bookings for this room at this time and create the
    // appointment inside a single transaction. The room row is locked with
    // FOR UPDATE so concurrent booking requests for the same room are
    // serialized, preventing a race condition where two requests both read
    // the slot as available and both insert (double-booking the same slot).
    const connection = await db.getConnection();
    const allocatedAppointments = [];
    let totalDepositPaid = 0;
    try {
      await connection.beginTransaction();

      const [rooms] = await connection.query(
        'SELECT max_slot_per_hour, room_code, room_name FROM Clinic_Rooms WHERE id = ? FOR UPDATE',
        [room_id]
      );
      if (rooms.length === 0) {
        await connection.rollback();
        return res.status(404).json({
          success: false,
          message: 'Không tìm thấy phòng khám'
        });
      }

      const room = rooms[0];

      // Cơ chế Vetstoria 2 (Online Booking Exclusions / Clinical Gating):
      // Chỉ cho phép khách tự đặt trực tuyến tại các phòng tiếp nhận ban đầu & chăm sóc (P101, P102, P201).
      // Các phòng cận lâm sàng / phẫu thuật / nội trú (P103, P202, P203) chỉ dành cho Bác sĩ chỉ định chuyển tuyến.
      if (REFERRAL_ONLY_ROOM_CODES.includes(room.room_code)) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          message: `Phòng ${room.room_code} (${room.room_name}) là phòng chuyên khoa sâu chỉ tiếp nhận theo chỉ định của Bác sĩ sau khi khám lâm sàng. Vui lòng đặt lịch tại Phòng Tiếp đón (P101), Phòng Khám Nội (P102) hoặc Phòng Da liễu & Spa (P201).`
        });
      }

      // Kiểm tra số lịch hẹn trong ngày được chọn của chủ nuôi (phục vụ quy tắc Đặt cọc 50%)
      const [existingTodayRows] = await connection.query(
        `SELECT COUNT(*) as total
         FROM Appointments
         WHERE user_id = ?
           AND DATE(appointment_datetime) = DATE(?)
           AND status != 'cancelled'`,
        [req.user.id, appointment_datetime]
      );
      const existingTodayCount = Number(existingTodayRows[0]?.total || 0);

      // Quy tắc Đặt cọc 50% (Tiered Deposit):
      // Bắt buộc đặt cọc 50% khi đặt lịch hàng loạt >= 3 thú cưng HOẶC đặt lịch cho thú cưng thứ 3 trở đi trong cùng 1 ngày
      const requiresDeposit = petIds.length >= 3 || (existingTodayCount + petIds.length) >= 3;
      const depositPerPet = requiresDeposit ? Math.round(singlePetPrice * 0.5) : 0;
      const totalDepositRequired = depositPerPet * petIds.length;

      const datePart = appointment_datetime.slice(0, 10); // YYYY-MM-DD
      const startHour = Number(appointment_datetime.slice(11, 13));
      const newSlotMinutes = 60 / Math.max(1, Number(room.max_slot_per_hour || 1));

      // Duyệt từng thú cưng trong danh sách petIds và tự động phân bổ vào khung giờ trống hợp lệ từ startHour -> 17:00
      for (const currentPetId of petIds) {
        const petName = petMap.get(Number(currentPetId)) || `#${currentPetId}`;

        // Chốt 2a: Mỗi thú cưng không được đặt trùng 2 lịch chưa khám xong tại CÙNG 1 phòng trong ngày
        const [dupPetSameRoom] = await connection.query(
          `SELECT id FROM Appointments
           WHERE pet_id = ?
             AND room_id = ?
             AND DATE(appointment_datetime) = ?
             AND status IN ('pending', 'confirmed')
           LIMIT 1`,
          [currentPetId, room_id, datePart]
        );
        if (dupPetSameRoom.length > 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Bé "${petName}" đã có lịch hẹn chờ khám tại phòng ${room.room_code} trong ngày được chọn. Vui lòng bỏ chọn bé "${petName}" hoặc hủy lịch cũ để gộp dịch vụ.`
          });
        }

        // Chốt 2b: Mỗi thú cưng tối đa 2 lịch ở 2 phòng khác nhau trong cùng 1 ngày
        const [petDailyBookings] = await connection.query(
          `SELECT COUNT(*) as total FROM Appointments
           WHERE pet_id = ?
             AND DATE(appointment_datetime) = ?
             AND status IN ('pending', 'confirmed')`,
          [currentPetId, datePart]
        );
        if ((petDailyBookings[0]?.total || 0) >= 2) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Bé "${petName}" đã đạt tối đa 2 phòng khám trong ngày này. Các phòng chuyên khoa khác nếu cần sẽ được Bác sĩ chỉ định trực tiếp khi khám.`
          });
        }

        // Tìm khung giờ hợp lệ từ startHour đến 17:00
        let allocatedDatetime = null;
        let lastRejectReason = '';

        for (let h = startHour; h <= 17; h++) {
          const candidateDatetime = `${datePart} ${String(h).padStart(2, '0')}:00:00`;

          // 1. Kiểm tra sức chứa phòng khám tại khung giờ candidateDatetime
          const [booked] = await connection.query(
            `SELECT COUNT(*) as total FROM Appointments
             WHERE room_id = ?
               AND appointment_datetime = ?
               AND status != 'cancelled'`,
            [room_id, candidateDatetime]
          );
          if (booked[0].total >= room.max_slot_per_hour) {
            lastRejectReason = `Phòng ${room.room_code} đã kín chỗ từ ${String(startHour).padStart(2, '0')}:00 đến 17:00`;
            continue;
          }

          // 2. Chốt 3a: Kiểm tra bản thân thú cưng currentPetId trong khung giờ candidateDatetime
          const [petInSameHour] = await connection.query(
            `SELECT a.id, cr.max_slot_per_hour
             FROM Appointments a
             JOIN Clinic_Rooms cr ON cr.id = a.room_id
             WHERE a.pet_id = ?
               AND a.appointment_datetime = ?
               AND a.status IN ('pending', 'confirmed')`,
            [currentPetId, candidateDatetime]
          );
          const petUsedMinutes = petInSameHour.reduce(
            (sum, r) => sum + 60 / Math.max(1, Number(r.max_slot_per_hour || 1)),
            0
          );
          if (petUsedMinutes + newSlotMinutes > 60.001) {
            lastRejectReason = `Bé "${petName}" đã kín lịch trong khung giờ này`;
            continue;
          }

          // 3. Chốt 3b: Kiểm tra tổng quỹ thời gian 60 phút của chủ nuôi trong khung giờ candidateDatetime
          const [userInSameHour] = await connection.query(
            `SELECT a.id, cr.max_slot_per_hour
             FROM Appointments a
             JOIN Clinic_Rooms cr ON cr.id = a.room_id
             WHERE a.user_id = ?
               AND a.appointment_datetime = ?
               AND a.status IN ('pending', 'confirmed')`,
            [req.user.id, candidateDatetime]
          );
          const userUsedMinutes = userInSameHour.reduce(
            (sum, r) => sum + 60 / Math.max(1, Number(r.max_slot_per_hour || 1)),
            0
          );
          if (userUsedMinutes + newSlotMinutes > 60.001) {
            lastRejectReason = `Quỹ thời gian 60 phút/giờ của bạn đã đầy từ ${String(startHour).padStart(2, '0')}:00 đến 17:00`;
            continue;
          }

          allocatedDatetime = candidateDatetime;
          break;
        }

        if (!allocatedDatetime) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message:
              petIds.length > 1
                ? `Không đủ khung giờ trống trong ngày ${datePart} (từ ${String(startHour).padStart(2, '0')}:00 đến 17:00) để xếp lịch cho tất cả ${petIds.length} thú cưng (mới xếp được ${allocatedAppointments.length}/${petIds.length} bé; lý do tại bé "${petName}": ${lastRejectReason}). Vui lòng chọn giờ sớm hơn hoặc chia sang ngày tiếp theo.`
                : `${lastRejectReason || `Phòng khám này đã đủ ${room.max_slot_per_hour} ca khám trong khung giờ được chọn`}. Vui lòng chọn thời gian khác.`
          });
        }

        const baseNotes = notes && String(notes).trim() ? String(notes).trim() : '';
        const depositTag = requiresDeposit
          ? `[ĐÃ ĐẶT CỌC 50%: ${depositPerPet.toLocaleString('vi-VN')}đ]`
          : '';
        const finalNotes = depositTag
          ? baseNotes
            ? `${depositTag} ${baseNotes}`
            : depositTag
          : baseNotes || null;

        const [insertRes] = await connection.query(
          `INSERT INTO Appointments
           (user_id, pet_id, room_id, service_id, appointment_datetime, status, notes, deposit_amount, deposit_status)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
          [
            req.user.id,
            currentPetId,
            room_id,
            primaryServiceId,
            allocatedDatetime,
            finalNotes,
            depositPerPet,
            requiresDeposit ? 'paid' : 'none'
          ]
        );

        if (serviceIds.length > 1) {
          const values = serviceIds.slice(1).map((id) => [insertRes.insertId, id]);
          await connection.query(
            'INSERT INTO Appointment_Services (appointment_id, service_id) VALUES ?',
            [values]
          );
        }

        totalDepositPaid += depositPerPet;
        allocatedAppointments.push({
          appointment_id: insertRes.insertId,
          pet_id: currentPetId,
          pet_name: petName,
          appointment_datetime: allocatedDatetime,
          time_slot: allocatedDatetime.slice(11, 16),
          deposit_amount: depositPerPet
        });
      }

      // Chỉ khi TẤT CẢ các chốt chặn (No-Show, điểm phạt hủy lịch, trùng phòng, giới hạn 2 phòng/ngày, và đủ slot trống cho toàn bộ thú cưng)
      // đều hợp lệ 100%, nếu thuộc diện cần đặt cọc 50% mà khách chưa xác nhận quét QR thì rollback bản nháp và yêu cầu hiện mã QR đặt cọc!
      if (requiresDeposit && !deposit_confirmed) {
        await connection.rollback();
        return res.status(400).json({
          success: false,
          requires_deposit: true,
          deposit_amount: totalDepositRequired,
          total_price: singlePetPrice * petIds.length,
          existing_today_count: existingTodayCount,
          preview_allocations: allocatedAppointments.map((a) => ({
            pet_id: a.pet_id,
            pet_name: a.pet_name,
            time_slot: a.time_slot,
            deposit_amount: a.deposit_amount
          })),
          message:
            petIds.length >= 3
              ? `Đặt lịch hàng loạt từ 3 thú cưng trở lên (${petIds.length} bé) yêu cầu đặt cọc trước 50% chi phí dịch vụ (${totalDepositRequired.toLocaleString('vi-VN')}đ) để giữ chỗ.`
              : `Bạn đã có ${existingTodayCount} lịch hẹn trong ngày này. Đặt lịch từ thú cưng thứ 3 trở đi trong cùng 1 ngày yêu cầu đặt cọc trước 50% (${totalDepositRequired.toLocaleString('vi-VN')}đ).`
        });
      }

      await connection.commit();
    } catch (transactionError) {
      await connection.rollback();
      throw transactionError;
    } finally {
      connection.release();
    }

    return res.status(201).json({
      success: true,
      message:
        allocatedAppointments.length > 1
          ? `Đặt lịch hàng loạt thành công cho ${allocatedAppointments.length} thú cưng!`
          : 'Đặt lịch thành công',
      data: {
        appointment_id: allocatedAppointments[0]?.appointment_id,
        allocated_appointments: allocatedAppointments,
        total_deposit_paid: totalDepositPaid
      }
    });
  } catch (error) {
    console.error('CREATE_APPOINTMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi đặt lịch. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get my appointments (customer view)
 * GET /api/appointments/my
 */
exports.getMyAppointments = async (req, res) => {
  try {
    await sweepOverdueAppointments();
    const [list] = await db.query(`
      SELECT
        a.id,
        a.pet_id,
        a.appointment_datetime,
        a.status,
        a.notes,
        COALESCE(a.deposit_amount, 0) as deposit_amount,
        a.deposit_status,
        a.created_at,
        p.name as pet_name,
        p.species,
        cr.room_code,
        cr.room_name,
        (SELECT GROUP_CONCAT(DISTINCT CONCAT(s.service_name, ' (', r.room_code, ')') ORDER BY r.room_code, s.service_name SEPARATOR ', ')
         FROM Services s
         JOIN Clinic_Rooms r ON s.room_id = r.id
         WHERE s.id = a.service_id OR s.id IN (
           SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id
         )) as service_name,
        (SELECT SUM(price)
         FROM Services
         WHERE id = a.service_id OR id IN (
           SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id
         )) as price,
        CONCAT(u.full_name, ' (', u.phone, ')') as doctor_info,
        ar.rating as review_rating,
        ar.comment as review_comment,
        ar.created_at as review_created_at
      FROM Appointments a
      JOIN Pets p ON a.pet_id = p.id
      JOIN Clinic_Rooms cr ON a.room_id = cr.id
      LEFT JOIN Users u ON a.doctor_id = u.id
      LEFT JOIN Appointment_Reviews ar ON ar.appointment_id = a.id
      WHERE a.user_id = ?
      ORDER BY a.appointment_datetime DESC
    `, [req.user.id]);

    return res.status(200).json({
      success: true,
      data: list
    });
  } catch (error) {
    console.error('GET_MY_APPOINTMENTS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách lịch hẹn. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Get all appointments (doctor: chỉ phòng mình phụ trách; admin: toàn viện)
 * GET /api/appointments
 * Can filter by room_id and date
 */
const canDoctorAccessAppointment = async (appointmentId, ownRoomId) => {
  if (!ownRoomId) return false;
  const [rows] = await db.query(
    `SELECT a.id
     FROM Appointments a
     WHERE a.id = ?
       AND (
         a.room_id = ?
         OR EXISTS (
           SELECT 1 FROM Services s
           WHERE s.room_id = ?
             AND (
               s.id = a.service_id
               OR s.id IN (SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id)
             )
         )
       )
     LIMIT 1`,
    [appointmentId, ownRoomId, ownRoomId]
  );
  return rows.length > 0;
};

/**
 * Đồng bộ các bước khám liên phòng (Appointment_Room_Steps) theo danh sách dịch vụ của ca khám.
 * Ví dụ: P102 chỉ định P103, P103 chỉ định P201 -> lưu rõ phòng nào chuyển sang phòng nào và trạng thái hoàn thành của từng phòng.
 */
const syncAppointmentRoomSteps = async (appointmentId, actorRoomId = null, conn = db) => {
  await ensureInvoiceTables();
  const [apps] = await conn.query(
    'SELECT id, room_id, service_id, status FROM Appointments WHERE id = ?',
    [appointmentId]
  );
  if (apps.length === 0) return [];
  const app = apps[0];

  const [serviceRooms] = await conn.query(
    `SELECT DISTINCT s.room_id
     FROM Services s
     WHERE s.id = ?
        OR s.id IN (SELECT service_id FROM Appointment_Services WHERE appointment_id = ?)`,
    [app.service_id, app.id]
  );

  const requiredRoomIds = new Set([Number(app.room_id)]);
  for (const r of serviceRooms) {
    if (r.room_id) requiredRoomIds.add(Number(r.room_id));
  }

  // Đảm bảo phòng tiếp nhận ban đầu (phòng gốc) luôn có bản ghi
  await conn.query(
    `INSERT IGNORE INTO Appointment_Room_Steps (appointment_id, room_id, referred_by_room_id, status)
     VALUES (?, ?, NULL, ?)`,
    [app.id, app.room_id, app.status === 'completed' ? 'completed' : 'in_progress']
  );

  // Thêm các phòng được chỉ định mới (lưu lại phòng nào đã chỉ định sang)
  for (const rId of requiredRoomIds) {
    if (rId === Number(app.room_id)) continue;
    const referredBy =
      actorRoomId && Number(actorRoomId) !== Number(rId)
        ? Number(actorRoomId)
        : Number(app.room_id);
    const initialStepStatus = actorRoomId
      ? 'in_progress'
      : app.status === 'completed'
      ? 'completed'
      : 'in_progress';
    await conn.query(
      `INSERT IGNORE INTO Appointment_Room_Steps (appointment_id, room_id, referred_by_room_id, status)
       VALUES (?, ?, ?, ?)`,
      [app.id, rId, referredBy, initialStepStatus]
    );
  }

  // Nếu có phòng phụ bị bỏ chọn dịch vụ và chưa khám xong thì xóa khỏi tiến trình
  const roomIdsArr = [...requiredRoomIds];
  if (roomIdsArr.length > 0) {
    const placeholders = roomIdsArr.map(() => '?').join(',');
    await conn.query(
      `DELETE FROM Appointment_Room_Steps
       WHERE appointment_id = ?
         AND room_id != ?
         AND status != 'completed'
         AND room_id NOT IN (${placeholders})`,
      [app.id, app.room_id, ...roomIdsArr]
    );
  }

  const [steps] = await conn.query(
    `SELECT ars.room_id, ars.referred_by_room_id, ars.status, ars.completed_at,
            cr.room_code, cr.room_name,
            rcr.room_code as referred_by_room_code, rcr.room_name as referred_by_room_name
     FROM Appointment_Room_Steps ars
     JOIN Clinic_Rooms cr ON cr.id = ars.room_id
     LEFT JOIN Clinic_Rooms rcr ON rcr.id = ars.referred_by_room_id
     WHERE ars.appointment_id = ?
     ORDER BY ars.id ASC`,
    [app.id]
  );
  return steps;
};

/**
 * Tìm danh sách các phòng được chỉ định phía sau (downstream) mà targetRoomId phải đợi hoàn thành trước.
 * - Nếu targetRoomId là phòng gốc (ví dụ P102): phải đợi tất cả các phòng phụ (P103, P201...) hoàn thành hết.
 * - Nếu targetRoomId là phòng trung gian (ví dụ P103): phải đợi các phòng do P103 chỉ định (ví dụ P201) hoàn thành trước.
 */
const getUnfinishedDownstreamRooms = (steps, targetRoomId, primaryRoomId) => {
  const tId = Number(targetRoomId);
  const pId = Number(primaryRoomId);

  if (tId === pId) {
    return steps.filter((s) => Number(s.room_id) !== pId && s.status !== 'completed');
  }

  // Duyệt cây con các phòng được chỉ định từ targetRoomId
  const descendants = [];
  const visited = new Set([tId]);
  const queue = [tId];

  while (queue.length > 0) {
    const curr = queue.shift();
    for (const step of steps) {
      const sRoomId = Number(step.room_id);
      const refBy = Number(step.referred_by_room_id);
      if (refBy === curr && !visited.has(sRoomId)) {
        visited.add(sRoomId);
        descendants.push(step);
        queue.push(sRoomId);
      }
    }
  }

  return descendants.filter((s) => s.status !== 'completed');
};

exports.getAllAppointments = async (req, res) => {
  try {
    await ensureInvoiceTables();
    await sweepOverdueAppointments();
    const { date, status } = req.query;
    let { room_id } = req.query;
    let doctorOwnRoomId = null;

    if (status && !['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái lọc không hợp lệ' });
    }

    if (req.user.role === 'doctor') {
      doctorOwnRoomId = await getOwnRoomId(req.user.id);
      if (!doctorOwnRoomId) {
        return res.status(200).json({ success: true, data: [] });
      }
      room_id = null;
    }

    let query = `
      SELECT
        a.id,
        a.pet_id,
        a.room_id,
        a.service_id,
        a.appointment_datetime,
        a.status,
        a.notes,
        COALESCE(a.deposit_amount, 0) as deposit_amount,
        a.deposit_status,
        a.created_at,
        p.name as pet_name,
        p.species,
        p.breed,
        p.weight_kg,
        cr.room_code,
        cr.room_name,
        (SELECT GROUP_CONCAT(DISTINCT id ORDER BY id SEPARATOR ',')
         FROM Services
         WHERE id = a.service_id OR id IN (
           SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id
         )) as service_ids_raw,
        (SELECT GROUP_CONCAT(DISTINCT CONCAT(s.service_name, ' (', r.room_code, ')') ORDER BY r.room_code, s.service_name SEPARATOR ', ')
         FROM Services s
         JOIN Clinic_Rooms r ON s.room_id = r.id
         WHERE s.id = a.service_id OR s.id IN (
           SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id
         )) as service_name,
        (SELECT SUM(price)
         FROM Services
         WHERE id = a.service_id OR id IN (
           SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id
         )) as price,
        u.full_name as customer_name,
        u.phone as customer_phone,
        CONCAT(u.full_name, ' (', COALESCE(u.phone, 'Chưa có SĐT'), ')') as customer_info,
        ar.rating as review_rating,
        ar.comment as review_comment,
        rd.full_name as room_doctor_name,
        inv.id as invoice_id,
        inv.invoice_code as invoice_code,
        inv.total_amount as invoice_total,
        COALESCE(inv.deposit_amount, a.deposit_amount, 0) as invoice_deposit_amount,
        inv.payment_status as invoice_payment_status,
        inv.paid_at as invoice_paid_at,
        inv.updated_at as invoice_updated_at
      FROM Appointments a
      JOIN Pets p ON a.pet_id = p.id
      JOIN Clinic_Rooms cr ON a.room_id = cr.id
      JOIN Users u ON a.user_id = u.id
      LEFT JOIN Users rd ON rd.id = cr.doctor_id
      LEFT JOIN Appointment_Reviews ar ON ar.appointment_id = a.id
      LEFT JOIN Invoices inv ON inv.appointment_id = a.id
      WHERE 1=1
    `;

    const params = [];

    if (doctorOwnRoomId) {
      query += ` AND (
        a.room_id = ?
        OR EXISTS (
          SELECT 1 FROM Services s_own
          WHERE s_own.room_id = ?
            AND (
              s_own.id = a.service_id
              OR s_own.id IN (SELECT service_id FROM Appointment_Services WHERE appointment_id = a.id)
            )
        )
      )`;
      params.push(doctorOwnRoomId, doctorOwnRoomId);
    } else if (room_id) {
      query += ' AND a.room_id = ?';
      params.push(room_id);
    }

    if (date) {
      query += ' AND DATE(a.appointment_datetime) = ?';
      params.push(date);
    }

    if (status && !doctorOwnRoomId) {
      query += ' AND a.status = ?';
      params.push(status);
    }

    query += ' ORDER BY a.appointment_datetime DESC';

    const [list] = await db.query(query, params);

    const enrichedList = [];
    for (const item of list) {
      const steps = await syncAppointmentRoomSteps(item.id, null, db);
      const isReferredCase = doctorOwnRoomId ? Number(item.room_id) !== Number(doctorOwnRoomId) : false;
      const myStep = doctorOwnRoomId
        ? steps.find((s) => Number(s.room_id) === Number(doctorOwnRoomId))
        : null;
      const unfinishedDownstream = doctorOwnRoomId
        ? getUnfinishedDownstreamRooms(steps, doctorOwnRoomId, item.room_id)
        : [];

      // Trạng thái hiển thị theo góc nhìn của từng phòng:
      // Nếu là phòng được chuyển tiếp (như P201, P103) và đã bấm hoàn thành phần việc của phòng mình,
      // thì ở màn hình của phòng đó ca khám được tính là 'completed' (sang tab Đã khám của phòng đó),
      // trong khi ở phòng trước đó (P103 / P102) vẫn là 'confirmed' để khám tiếp!
      let effectiveStatus = item.status;
      if (doctorOwnRoomId && isReferredCase && item.status === 'confirmed' && myStep?.status === 'completed') {
        effectiveStatus = 'completed';
      }

      if (status && doctorOwnRoomId && effectiveStatus !== status) {
        continue;
      }

      enrichedList.push({
        ...item,
        status: effectiveStatus,
        overall_status: item.status,
        is_referred_case: isReferredCase,
        my_room_id: doctorOwnRoomId,
        my_room_status: myStep?.status || (item.status === 'completed' ? 'completed' : 'in_progress'),
        referred_by_room_code: myStep?.referred_by_room_code || item.room_code,
        room_steps: steps,
        waiting_for_rooms: unfinishedDownstream.map((r) => `${r.room_code} (${r.room_name})`),
        service_ids: item.service_ids_raw
          ? String(item.service_ids_raw)
              .split(',')
              .map((id) => Number(id))
              .filter((id) => Number.isInteger(id) && id > 0)
          : item.service_id
          ? [Number(item.service_id)]
          : []
      });
    }

    return res.status(200).json({
      success: true,
      data: enrichedList
    });
  } catch (error) {
    console.error('GET_ALL_APPOINTMENTS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách lịch hẹn. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Update appointment status (doctor only)
 * PATCH /api/appointments/:id/status
 * BR03: Enforce status transition rules
 */
exports.updateStatus = async (req, res) => {
  try {
    await ensureInvoiceTables();
    const { id } = req.params;
    const { status, doctor_id, is_no_show } = req.body;

    // Validate status
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ'
      });
    }

    // Get current appointment
    const [appointments] = await db.query(
      'SELECT user_id, status, doctor_id, room_id, appointment_datetime, notes, COALESCE(deposit_amount, 0) as deposit_amount, deposit_status FROM Appointments WHERE id = ?',
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    // Bác sĩ được cập nhật lịch hẹn thuộc phòng mình hoặc ca khám đã được chuyển tiếp liên phòng sang phòng mình
    if (req.user.role === 'doctor') {
      const ownRoomId = await getOwnRoomId(req.user.id);
      const hasAccess = await canDoctorAccessAppointment(id, ownRoomId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền cập nhật lịch hẹn của phòng khám khác'
        });
      }
    }

    const currentStatus = appointments[0].status;

    // BR03: Enforce state transitions
    const validTransitions = {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': []
    };

    if (!validTransitions[currentStatus].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Không thể chuyển từ trạng thái '${currentStatus}' sang '${status}'`
      });
    }

    // Update appointment
    const assignedDoctorId = status === 'confirmed'
      ? (doctor_id || req.user.id)
      : appointments[0].doctor_id;

    if (status === 'confirmed') {
      // BR01 safety net: re-check room capacity (locked) before confirming, in
      // case max_slot_per_hour was lowered after these appointments were made.
      const connection = await db.getConnection();
      try {
        await connection.beginTransaction();

        const [rooms] = await connection.query(
          'SELECT max_slot_per_hour FROM Clinic_Rooms WHERE id = ? FOR UPDATE',
          [appointments[0].room_id]
        );
        const maxSlot = rooms[0]?.max_slot_per_hour ?? Infinity;

        const [booked] = await connection.query(`
          SELECT COUNT(*) as total FROM Appointments
          WHERE room_id = ?
            AND appointment_datetime = ?
            AND status != 'cancelled'
        `, [appointments[0].room_id, appointments[0].appointment_datetime]);

        if (booked[0].total > maxSlot) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message: `Khung giờ này đang có nhiều hơn ${maxSlot} lịch hẹn. Vui lòng hủy bớt lịch trước khi xác nhận.`
          });
        }

        await connection.query(
          'UPDATE Appointments SET status = ?, doctor_id = ? WHERE id = ?',
          [status, assignedDoctorId, id]
        );
        await connection.commit();
      } catch (transactionError) {
        await connection.rollback();
        throw transactionError;
      } finally {
        connection.release();
      }
    } else if (status === 'completed' && req.user.role === 'doctor') {
      const ownRoomId = await getOwnRoomId(req.user.id);
      const steps = await syncAppointmentRoomSteps(id, ownRoomId, db);
      const unfinishedDownstream = getUnfinishedDownstreamRooms(steps, ownRoomId, appointments[0].room_id);

      if (unfinishedDownstream.length > 0) {
        const roomNames = unfinishedDownstream.map((r) => `${r.room_code} (${r.room_name})`).join(', ');
        return res.status(400).json({
          success: false,
          message: `Chưa thể hoàn thành tại phòng của bạn vì đang chờ kết quả khám từ: ${roomNames}. Vui lòng đợi phòng được chỉ định hoàn thành trước.`
        });
      }

      // Trường hợp 1: Bác sĩ ở phòng được chỉ định chuyển tiếp (ví dụ P201 hoặc P103) bấm Hoàn thành
      if (Number(ownRoomId) !== Number(appointments[0].room_id)) {
        await db.query(
          `UPDATE Appointment_Room_Steps
           SET status = 'completed', completed_at = NOW()
           WHERE appointment_id = ? AND room_id = ?`,
          [id, ownRoomId]
        );
        const myStep = steps.find((s) => Number(s.room_id) === Number(ownRoomId));
        const returnToCode = myStep?.referred_by_room_code || 'phòng khám trước';
        return res.status(200).json({
          success: true,
          step_completed_only: true,
          message: `Đã hoàn thành phần khám tại phòng ${myStep?.room_code || ''}. Kết quả đã được chuyển về ${returnToCode} để bác sĩ khám tiếp.`
        });
      }

      // Trường hợp 2: Bác sĩ ở phòng gốc ban đầu (ví dụ P102) bấm Hoàn thành khi mọi phòng chuyển tiếp (P103, P201) đã xong
      await db.query(
        `UPDATE Appointment_Room_Steps
         SET status = 'completed', completed_at = COALESCE(completed_at, NOW())
         WHERE appointment_id = ?`,
        [id]
      );
      await db.query(
        'UPDATE Appointments SET status = ?, doctor_id = ? WHERE id = ?',
        [status, assignedDoctorId, id]
      );
      await syncAppointmentPendingInvoice(id, req.user.id);
      return res.status(200).json({
        success: true,
        step_completed_only: false,
        message: 'Đã hoàn thành toàn bộ ca khám và tự động chuyển hóa đơn sang Quầy Thu Ngân.'
      });
    } else if (status === 'cancelled' && is_no_show) {
      const currentNotes = appointments[0].notes ? String(appointments[0].notes).trim() : '';
      const hasDeposit = Number(appointments[0].deposit_amount || 0) > 0;
      const noShowTag = hasDeposit
        ? `[VẮNG MẶT - MẤT CỌC 50%: ${Number(appointments[0].deposit_amount).toLocaleString('vi-VN')}đ]`
        : '[VẮNG MẶT - KHÔNG ĐẾN KHÁM]';
      const updatedNotes = currentNotes.includes('[VẮNG MẶT')
        ? currentNotes
        : currentNotes
        ? `${noShowTag} ${currentNotes}`
        : noShowTag;

      await db.query(
        `UPDATE Appointments
         SET status = ?,
             doctor_id = ?,
             deposit_status = CASE WHEN COALESCE(deposit_amount, 0) > 0 THEN 'forfeited' ELSE deposit_status END,
             notes = ?
         WHERE id = ?`,
        ['cancelled', assignedDoctorId, updatedNotes, id]
      );

      const [existingLog] = await db.query(
        "SELECT id FROM User_Cancellation_Logs WHERE appointment_id = ? AND log_type = 'no_show' LIMIT 1",
        [id]
      );
      if (existingLog.length === 0) {
        await db.query(
          "INSERT INTO User_Cancellation_Logs (user_id, appointment_id, log_type, penalty_weight) VALUES (?, ?, 'no_show', 2)",
          [appointments[0].user_id, id]
        );
      }

      return res.status(200).json({
        success: true,
        message: hasDeposit
          ? 'Đã đánh dấu khách vắng mặt (No-Show), giải phóng slot phòng khám và chuyển trạng thái Mất cọc 50%.'
          : 'Đã đánh dấu khách vắng mặt (No-Show), giải phóng slot phòng khám và ghi nhận vi phạm bỏ lịch.'
      });
    } else if (status === 'cancelled') {
      // Bác sĩ hoặc Admin/Bệnh viện chủ động hủy lịch (hoặc hỗ trợ hủy khi khách liên hệ Hotline viện) -> Hoàn cọc 100% (refunded)
      const currentNotes = appointments[0].notes ? String(appointments[0].notes).trim() : '';
      const hasDeposit = Number(appointments[0].deposit_amount || 0) > 0;
      const refundTag = hasDeposit
        ? `[HOÀN CỌC 50%: ${Number(appointments[0].deposit_amount).toLocaleString('vi-VN')}đ - VIỆN/BÁC SĨ HỦY LỊCH]`
        : '';
      const updatedNotes = refundTag && !currentNotes.includes('[HOÀN CỌC')
        ? currentNotes
          ? `${refundTag} ${currentNotes}`
          : refundTag
        : currentNotes || null;

      await db.query(
        `UPDATE Appointments
         SET status = 'cancelled',
             doctor_id = ?,
             deposit_status = CASE WHEN COALESCE(deposit_amount, 0) > 0 THEN 'refunded' ELSE deposit_status END,
             notes = ?
         WHERE id = ?`,
        [assignedDoctorId, updatedNotes, id]
      );

      return res.status(200).json({
        success: true,
        message: hasDeposit
          ? `Đã hủy lịch hẹn từ phía Bệnh viện/Bác sĩ và chuyển trạng thái Hoàn cọc 50% (${Number(appointments[0].deposit_amount).toLocaleString('vi-VN')}đ) cho khách hàng.`
          : 'Đã hủy lịch hẹn thành công'
      });
    } else {
      await db.query(
        'UPDATE Appointments SET status = ?, doctor_id = ? WHERE id = ?',
        [status, assignedDoctorId, id]
      );
      if (status === 'completed') {
        await syncAppointmentPendingInvoice(id, req.user.id);
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái lịch hẹn thành công'
    });
  } catch (error) {
    console.error('UPDATE_APPOINTMENT_STATUS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật trạng thái. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Cancel appointment
 * DELETE /api/appointments/:id
 * Customer can cancel if status is 'pending'
 * Doctor can cancel anytime
 */
/**
 * Bác sĩ cập nhật / chỉ định các dịch vụ thực tế đã làm (hỗ trợ dịch vụ đa phòng)
 * PUT /api/appointments/:id/services
 */
exports.updateAppointmentServices = async (req, res) => {
  let connection;
  try {
    await ensureInvoiceTables();
    const { id } = req.params;
    const { service_ids } = req.body;

    const uniqueServiceIds = Array.isArray(service_ids)
      ? [...new Set(service_ids.map((sid) => Number(sid)).filter((sid) => Number.isInteger(sid) && sid > 0))]
      : [];

    if (uniqueServiceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 dịch vụ thực hiện'
      });
    }

    const [appointments] = await db.query(
      'SELECT id, room_id, status FROM Appointments WHERE id = ?',
      [id]
    );
    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch khám'
      });
    }

    const appointment = appointments[0];

    if (req.user.role === 'doctor') {
      const ownRoomId = await getOwnRoomId(req.user.id);
      const hasAccess = await canDoctorAccessAppointment(id, ownRoomId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Bạn chỉ có thể cập nhật chỉ định dịch vụ cho ca khám thuộc phòng mình hoặc ca chuyển khám sang phòng mình'
        });
      }
    }

    const [existingInv] = await db.query(
      'SELECT id, payment_status FROM Invoices WHERE appointment_id = ?',
      [id]
    );
    if (existingInv.length > 0 && existingInv[0].payment_status === 'paid') {
      return res.status(400).json({
        success: false,
        message: 'Ca khám này đã được Thu ngân thanh toán, không thể thay đổi dịch vụ'
      });
    }

    const placeholders = uniqueServiceIds.map(() => '?').join(',');
    const [services] = await db.query(
      `SELECT s.id, s.service_name, s.price, cr.room_code
       FROM Services s
       JOIN Clinic_Rooms cr ON cr.id = s.room_id
       WHERE s.id IN (${placeholders})
       ORDER BY cr.room_code ASC, s.id ASC`,
      uniqueServiceIds
    );

    if (services.length !== uniqueServiceIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Có dịch vụ không tồn tại trong hệ thống'
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    await connection.query(
      'UPDATE Appointments SET service_id = ? WHERE id = ?',
      [uniqueServiceIds[0], id]
    );
    await connection.query(
      'DELETE FROM Appointment_Services WHERE appointment_id = ?',
      [id]
    );
    const values = uniqueServiceIds.map((sid) => [id, sid]);
    await connection.query(
      'INSERT IGNORE INTO Appointment_Services (appointment_id, service_id) VALUES ?',
      [values]
    );

    const actorRoomId = req.user.role === 'doctor' ? await getOwnRoomId(req.user.id) : appointment.room_id;
    const roomSteps = await syncAppointmentRoomSteps(id, actorRoomId, connection);

    if (appointment.status === 'completed' || existingInv.length > 0) {
      await syncAppointmentPendingInvoice(id, req.user.id, connection);
    }

    await connection.commit();

    const totalPrice = services.reduce((sum, s) => sum + Number(s.price || 0), 0);
    const serviceNames = services.map((s) => `${s.service_name} (${s.room_code})`).join(', ');

    return res.status(200).json({
      success: true,
      message: 'Đã cập nhật danh sách dịch vụ chỉ định và đồng bộ tiến trình liên phòng',
      data: {
        appointment_id: Number(id),
        service_ids: uniqueServiceIds,
        service_name: serviceNames,
        price: totalPrice,
        room_steps: roomSteps
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('UPDATE_APPOINTMENT_SERVICES_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi cập nhật dịch vụ chỉ định'
    });
  } finally {
    if (connection) connection.release();
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    await ensureInvoiceTables();
    const { id } = req.params;

    const [appointments] = await db.query(
      'SELECT user_id, status, notes, COALESCE(deposit_amount, 0) as deposit_amount, deposit_status FROM Appointments WHERE id = ?',
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    const appointment = appointments[0];

    // Check permissions
    if (req.user.role === 'customer' && appointment.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền hủy lịch hẹn này'
      });
    }

    // BR03: Customer can only cancel pending appointments
    if (req.user.role === 'customer' && appointment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể hủy lịch hẹn ở trạng thái "Chờ duyệt"'
      });
    }

    const hasDeposit = Number(appointment.deposit_amount || 0) > 0;
    const currentNotes = appointment.notes ? String(appointment.notes).trim() : '';

    if (req.user.role === 'customer') {
      // Khách hàng tự ý bấm hủy trên ứng dụng -> Mất 100% tiền cọc (forfeited)
      const forfeitTag = hasDeposit
        ? `[MẤT CỌC 50%: ${Number(appointment.deposit_amount).toLocaleString('vi-VN')}đ - KHÁCH TỰ HỦY]`
        : '';
      const updatedNotes = forfeitTag && !currentNotes.includes('[MẤT CỌC')
        ? currentNotes
          ? `${forfeitTag} ${currentNotes}`
          : forfeitTag
        : currentNotes || null;

      await db.query(
        `UPDATE Appointments
         SET status = 'cancelled',
             deposit_status = CASE WHEN COALESCE(deposit_amount, 0) > 0 THEN 'forfeited' ELSE deposit_status END,
             notes = ?
         WHERE id = ?`,
        [updatedNotes, id]
      );

      await db.query(
        'INSERT INTO User_Cancellation_Logs (user_id, appointment_id) VALUES (?, ?)',
        [req.user.id, id]
      );

      return res.status(200).json({
        success: true,
        message: hasDeposit
          ? `Đã hủy lịch hẹn. Theo quy định đặt cọc giữ chỗ, lịch hẹn do khách tự hủy trên ứng dụng không được hoàn cọc (Mất cọc ${Number(appointment.deposit_amount).toLocaleString('vi-VN')}đ).`
          : 'Hủy lịch hẹn thành công'
      });
    }

    // Bác sĩ hoặc Admin hủy lịch -> Hoàn cọc 100% (refunded)
    const refundTag = hasDeposit
      ? `[HOÀN CỌC 50%: ${Number(appointment.deposit_amount).toLocaleString('vi-VN')}đ - VIỆN/BÁC SĨ HỦY LỊCH]`
      : '';
    const updatedNotes = refundTag && !currentNotes.includes('[HOÀN CỌC')
      ? currentNotes
        ? `${refundTag} ${currentNotes}`
        : refundTag
      : currentNotes || null;

    await db.query(
      `UPDATE Appointments
       SET status = 'cancelled',
           deposit_status = CASE WHEN COALESCE(deposit_amount, 0) > 0 THEN 'refunded' ELSE deposit_status END,
           notes = ?
       WHERE id = ?`,
      [updatedNotes, id]
    );

    return res.status(200).json({
      success: true,
      message: hasDeposit
        ? `Đã hủy lịch hẹn từ phía Bệnh viện/Bác sĩ và chuyển trạng thái Hoàn cọc 50% (${Number(appointment.deposit_amount).toLocaleString('vi-VN')}đ) cho khách hàng.`
        : 'Hủy lịch hẹn thành công'
    });
  } catch (error) {
    console.error('CANCEL_APPOINTMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi hủy lịch hẹn. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Xóa vĩnh viễn 1 lịch hẹn đã bị hủy
 * DELETE /api/appointments/cancelled/:id
 * Chỉ áp dụng cho lịch có status = 'cancelled'
 */
exports.deleteCancelledAppointment = async (req, res) => {
  try {
    const { id } = req.params;

    const [appointments] = await db.query(
      'SELECT user_id, status FROM Appointments WHERE id = ?',
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy lịch hẹn'
      });
    }

    const appointment = appointments[0];

    // Kiểm tra quyền
    if (req.user.role === 'customer' && appointment.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa lịch hẹn này'
      });
    }

    // Chỉ cho phép xóa lịch đã bị hủy
    if (appointment.status !== 'cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể xóa các lịch hẹn đã ở trạng thái "Đã hủy"'
      });
    }

    await db.query('DELETE FROM Appointments WHERE id = ?', [id]);

    return res.status(200).json({
      success: true,
      message: 'Đã xóa lịch hẹn đã hủy thành công'
    });
  } catch (error) {
    console.error('DELETE_CANCELLED_APPOINTMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa lịch hẹn. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Xóa tất cả các lịch hẹn đã bị hủy của người dùng
 * DELETE /api/appointments/cancelled/all
 */
exports.deleteAllCancelledAppointments = async (req, res) => {
  try {
    let result;
    if (req.user.role === 'customer') {
      [result] = await db.query(
        'DELETE FROM Appointments WHERE user_id = ? AND status = "cancelled"',
        [req.user.id]
      );
    } else if (req.user.role === 'admin') {
      [result] = await db.query(
        'DELETE FROM Appointments WHERE status = "cancelled"'
      );
    } else {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thực hiện thao tác này'
      });
    }

    return res.status(200).json({
      success: true,
      message: `Đã xóa ${result.affectedRows} lịch hẹn đã hủy thành công`,
      data: { deletedCount: result.affectedRows }
    });
  } catch (error) {
    console.error('DELETE_ALL_CANCELLED_APPOINTMENTS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi xóa các lịch hẹn đã hủy. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * BR09: Thống kê toàn viện (admin only)
 * GET /api/appointments/analytics
 */
exports.getHospitalAnalytics = async (req, res) => {
  try {
    // Thống kê 1: số ca khám nhóm theo status
    const [statusSummary] = await db.query(`
      SELECT status, COUNT(*) as total
      FROM Appointments
      GROUP BY status
    `);

    // Thống kê 2: top 5 dịch vụ được đặt nhiều nhất
    const [topServices] = await db.query(`
      SELECT s.id, s.service_name, COUNT(*) as total
      FROM Appointments a
      JOIN Services s ON s.id = a.service_id
      GROUP BY s.id, s.service_name
      ORDER BY total DESC
      LIMIT 5
    `);

    // Thống kê 3: số lượng tư vấn AI theo urgency_level
    const [urgencySummary] = await db.query(`
      SELECT urgency_level, COUNT(*) as total
      FROM AI_Consultations
      GROUP BY urgency_level
    `);

    // Thống kê 4: tổng số ca khám của từng phòng khám
    const [roomLoad] = await db.query(`
      SELECT cr.id as room_id, cr.room_code, cr.room_name, COUNT(*) as total
      FROM Appointments a
      JOIN Clinic_Rooms cr ON cr.id = a.room_id
      GROUP BY cr.id, cr.room_code, cr.room_name
      ORDER BY total DESC
    `);

    return res.status(200).json({
      success: true,
      data: {
        status_summary: statusSummary,
        top_services: topServices,
        urgency_summary: urgencySummary,
        room_load: roomLoad
      }
    });
  } catch (error) {
    console.error('GET_HOSPITAL_ANALYTICS_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tải dữ liệu thống kê. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Tiếp nhận ca khám vãng lai trực tiếp tại phòng khám (Doctor / Cashier / Admin)
 * POST /api/appointments/walk-in
 * Body: { customer_name, customer_phone?, user_id?, pet_id?, pet_name, pet_species, service_ids: [1, 2], notes? }
 *
 * Tự động tạo/gắn hồ sơ khách hàng & thú cưng, tạo ngay lịch khám trạng thái 'confirmed' (Đang khám),
 * khởi tạo dây chuyền phòng khám (Appointment_Room_Steps) và tự động tạo hóa đơn chờ cho Thu ngân.
 */
exports.createWalkInAppointment = async (req, res) => {
  let connection;
  try {
    await ensureInvoiceTables();
    const {
      customer_name,
      customer_phone,
      user_id,
      pet_id,
      pet_name,
      pet_species,
      service_ids,
      notes
    } = req.body;

    if (!customer_name || !String(customer_name).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập họ tên chủ nuôi'
      });
    }

    const uniqueServiceIds = Array.isArray(service_ids)
      ? [...new Set(service_ids.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))]
      : [];

    if (uniqueServiceIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn ít nhất 1 dịch vụ khám ban đầu'
      });
    }

    const placeholders = uniqueServiceIds.map(() => '?').join(',');
    const [serviceRows] = await db.query(
      `SELECT id, room_id, service_name, price FROM Services WHERE id IN (${placeholders})`,
      uniqueServiceIds
    );

    if (serviceRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy dịch vụ hợp lệ'
      });
    }

    const servicesById = new Map(serviceRows.map((s) => [Number(s.id), s]));
    const orderedServices = uniqueServiceIds.map((sid) => servicesById.get(sid)).filter(Boolean);

    // Nếu người tiếp nhận là Bác sĩ, ưu tiên lấy phòng của Bác sĩ đó làm phòng tiếp nhận chính (nếu có dịch vụ thuộc phòng đó)
    let ownRoomId = null;
    if (req.user.role === 'doctor') {
      ownRoomId = await getOwnRoomId(req.user.id);
    }

    const primaryService =
      (ownRoomId && orderedServices.find((s) => Number(s.room_id) === Number(ownRoomId))) ||
      orderedServices[0];

    const primaryRoomId = Number(primaryService.room_id);

    // Tìm bác sĩ phụ trách phòng chính
    const [roomRows] = await db.query(
      'SELECT id, doctor_id, room_code, room_name FROM Clinic_Rooms WHERE id = ?',
      [primaryRoomId]
    );
    const primaryDoctorId =
      (roomRows.length > 0 && roomRows[0].doctor_id) ||
      (req.user.role === 'doctor' ? req.user.id : null);

    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Xác định hoặc tạo mới tài khoản khách hàng (Users)
    let targetUserId = user_id ? Number(user_id) : null;
    const cleanName = String(customer_name).trim();
    const cleanPhone = customer_phone && String(customer_phone).trim() ? String(customer_phone).trim() : null;

    if (targetUserId) {
      const [uCheck] = await connection.query('SELECT id FROM Users WHERE id = ?', [targetUserId]);
      if (uCheck.length === 0) targetUserId = null;
    }

    if (!targetUserId && cleanPhone) {
      const digits = cleanPhone.replace(/\s+/g, '');
      const [uByPhone] = await connection.query(
        `SELECT id FROM Users WHERE REPLACE(phone, ' ', '') = ? ORDER BY (role = 'customer') DESC, id ASC LIMIT 1`,
        [digits]
      );
      if (uByPhone.length > 0) {
        targetUserId = uByPhone[0].id;
      }
    }

    if (!targetUserId) {
      const generatedEmail = `walkin_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}@petcare.local`;
      const placeholderHash = '$2b$10$walkinplaceholderhash0000000000000000000000000000000';
      const [uInsert] = await connection.query(
        `INSERT INTO Users (full_name, email, password_hash, phone, role, is_active)
         VALUES (?, ?, ?, ?, 'customer', TRUE)`,
        [cleanName, generatedEmail, placeholderHash, cleanPhone]
      );
      targetUserId = uInsert.insertId;
    }

    // 2. Xác định hoặc tạo mới hồ sơ thú cưng (Pets)
    let targetPetId = pet_id ? Number(pet_id) : null;
    const cleanPetName = pet_name && String(pet_name).trim() ? String(pet_name).trim() : 'Thú cưng vãng lai';
    const normalizedSpecies = ['dog', 'cat', 'other'].includes(pet_species) ? pet_species : 'dog';

    if (targetPetId) {
      const [pCheck] = await connection.query(
        'SELECT id FROM Pets WHERE id = ? AND user_id = ?',
        [targetPetId, targetUserId]
      );
      if (pCheck.length === 0) targetPetId = null;
    }

    if (!targetPetId) {
      const [pExisting] = await connection.query(
        'SELECT id FROM Pets WHERE user_id = ? AND LOWER(name) = LOWER(?) LIMIT 1',
        [targetUserId, cleanPetName]
      );
      if (pExisting.length > 0) {
        targetPetId = pExisting[0].id;
      } else {
        const [pInsert] = await connection.query(
          `INSERT INTO Pets (user_id, name, species) VALUES (?, ?, ?)`,
          [targetUserId, cleanPetName, normalizedSpecies]
        );
        targetPetId = pInsert.insertId;
      }
    }

    // 3. Tạo ca khám trực tiếp trạng thái 'confirmed' (Đang khám)
    const nowLocal = toLocalDbDatetime(new Date().toISOString());
    const finalNotes = notes && String(notes).trim()
      ? `[Khách vãng lai] ${String(notes).trim()}`
      : '[Khách vãng lai] Tiếp nhận trực tiếp tại phòng khám';

    const [appResult] = await connection.query(
      `INSERT INTO Appointments
       (user_id, pet_id, doctor_id, service_id, room_id, appointment_datetime, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, 'confirmed', ?)`,
      [
        targetUserId,
        targetPetId,
        primaryDoctorId,
        primaryService.id,
        primaryRoomId,
        nowLocal,
        finalNotes
      ]
    );

    const appointmentId = appResult.insertId;

    // 4. Lưu danh sách dịch vụ vào Appointment_Services
    const serviceValues = uniqueServiceIds.map((sid) => [appointmentId, sid]);
    await connection.query(
      'INSERT INTO Appointment_Services (appointment_id, service_id) VALUES ?',
      [serviceValues]
    );

    // 5. Đồng bộ tiến độ các phòng khám tham gia ca khám
    await syncAppointmentRoomSteps(
      appointmentId,
      ownRoomId || primaryRoomId,
      connection
    );

    await connection.commit();

    // 6. Tự động tạo luôn Hóa đơn chờ thanh toán cho Quầy Thu Ngân
    try {
      await syncAppointmentPendingInvoice(appointmentId, primaryDoctorId || req.user.id);
    } catch (syncErr) {
      console.error('AUTO_SYNC_WALKIN_APPOINTMENT_INVOICE_ERROR:', syncErr.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Đã tiếp nhận ca khám vãng lai thành công',
      data: {
        appointment_id: appointmentId,
        user_id: targetUserId,
        pet_id: targetPetId,
        room_id: primaryRoomId
      }
    });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('CREATE_WALK_IN_APPOINTMENT_ERROR:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi khi tiếp nhận ca khám vãng lai. Vui lòng thử lại sau.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) connection.release();
  }
};