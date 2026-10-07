const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const { indexDocument } = require('../services/ragService');

const seedData = async () => {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
      database: process.env.DB_NAME || 'pet_care_db',
      port: Number(process.env.DB_PORT) || 3306,
    });

    console.log('📌 Đang thêm dữ liệu mẫu...');

    // Kiểm tra xem đã có rooms chưa
    const [existingRooms] = await connection.execute('SELECT COUNT(*) as count FROM Clinic_Rooms');
    
    if (existingRooms[0].count === 0) {
      // Thêm Phòng khám
      const roomsData = [
        { room_code: 'P101', room_name: 'Phòng Tiếp đón & Tư vấn Ban đầu', floor: 1, coordinate_x: 10, coordinate_y: 10, max_slot_per_hour: 3, description: 'Phòng tiếp đón, kiểm tra sơ bộ thú cưng' },
        { room_code: 'P102', room_name: 'Phòng Khám Nội & Tiêm Chủng', floor: 1, coordinate_x: 150, coordinate_y: 10, max_slot_per_hour: 2, description: 'Khám bệnh nội tạng, tiêm phòng ngừa, điều trị y học' },
        { room_code: 'P103', room_name: 'Phòng Phẫu Thuật & Gây mê', floor: 1, coordinate_x: 290, coordinate_y: 10, max_slot_per_hour: 1, description: 'Phẫu thuật, gây mê, cắt gây mê' },
        { room_code: 'P201', room_name: 'Phòng Da liễu & Spa', floor: 2, coordinate_x: 10, coordinate_y: 10, max_slot_per_hour: 2, description: 'Khám da liễu, tắm dưỡng, cắt móng, cắt lông' },
        { room_code: 'P202', room_name: 'Phòng Xét nghiệm & Siêu âm', floor: 2, coordinate_x: 150, coordinate_y: 10, max_slot_per_hour: 2, description: 'Siêu âm, xét nghiệm máu, xét nghiệm nước tiểu, chụp X-ray' },
        { room_code: 'P203', room_name: 'Phòng Hậu phẫu & Lưu trú', floor: 2, coordinate_x: 290, coordinate_y: 10, max_slot_per_hour: 2, description: 'Theo dõi sau phẫu thuật, lưu trú điều trị' },
      ];

      for (const room of roomsData) {
        await connection.execute(
          'INSERT INTO Clinic_Rooms (room_code, room_name, floor, coordinate_x, coordinate_y, max_slot_per_hour, description) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [room.room_code, room.room_name, room.floor, room.coordinate_x, room.coordinate_y, room.max_slot_per_hour, room.description]
        );
      }
      console.log('✅ Đã thêm dữ liệu phòng khám');
    } else {
      console.log('⏭️  Phòng khám đã tồn tại, bỏ qua');
    }

    // Kiểm tra dịch vụ
    const [existingServices] = await connection.execute('SELECT COUNT(*) as count FROM Services');
    
    if (existingServices[0].count === 0) {
      // Lấy lại ID của các phòng
      const [rooms] = await connection.execute('SELECT id, room_code FROM Clinic_Rooms');
      
      const roomMap = {};
      rooms.forEach(r => {
        roomMap[r.room_code] = r.id;
      });

      // Thêm Dịch vụ theo phòng
      const servicesData = [
        // P101 - Tiếp đón
        { room_code: 'P101', service_name: 'Tiếp đón & Tư vấn Ban đầu', price: 100000, duration_minutes: 15, description: 'Tiếp đón, tư vấn ban đầu' },
        
        // P102 - Khám Nội & Tiêm
        { room_code: 'P102', service_name: 'Khám Nội Tổng Quát', price: 200000, duration_minutes: 30, description: 'Khám bệnh nội tạng, kiểm tra sức khỏe toàn bộ' },
        { room_code: 'P102', service_name: 'Tiêm Chủng Cơ Bản (3 loại)', price: 150000, duration_minutes: 20, description: 'Tiêm phòng ngừa các bệnh cơ bản' },
        { room_code: 'P102', service_name: 'Tiêm Chủng Mở Rộng (5 loại)', price: 250000, duration_minutes: 30, description: 'Tiêm phòng ngừa toàn diện' },
        { room_code: 'P102', service_name: 'Kỹ Thuật Truyền Dịch IV', price: 300000, duration_minutes: 45, description: 'Truyền dịch tĩnh mạch điều trị' },
        
        // P103 - Phẫu thuật
        { room_code: 'P103', service_name: 'Phẫu Thuật Triệt Sản / Hoàn Toàn (Nữ)', price: 2000000, duration_minutes: 60, description: 'Phẫu thuật triệt sản cho thú cưng cái' },
        { room_code: 'P103', service_name: 'Phẫu Thuật Triệt Sản (Nam)', price: 1500000, duration_minutes: 45, description: 'Phẫu thuật triệt sản cho thú cưng đực' },
        { room_code: 'P103', service_name: 'Phẫu Thuật Cắt Tuyến Hạng Nhân', price: 1000000, duration_minutes: 30, description: 'Cắt tuyến hạng nhân' },
        { room_code: 'P103', service_name: 'Nhổ Răng / Cạo Vôi Răng', price: 500000, duration_minutes: 30, description: 'Vệ sinh hoặc nhổ răng sâu' },
        
        // P201 - Da liễu & Spa
        { room_code: 'P201', service_name: 'Tắm Gội Spa Tiêu Chuẩn', price: 300000, duration_minutes: 60, description: 'Tắm gội sạch sẽ, dưỡng lông' },
        { room_code: 'P201', service_name: 'Cắt Lông Thẩm Mỹ', price: 400000, duration_minutes: 90, description: 'Cắt lông theo mẫu, tạo kiểu' },
        { room_code: 'P201', service_name: 'Khám & Điều Trị Da Liễu', price: 300000, duration_minutes: 30, description: 'Khám bệnh da, điều trị viêm ngoài da' },
        { room_code: 'P201', service_name: 'Cắt Móng & Vệ Sinh Tai', price: 150000, duration_minutes: 20, description: 'Cắt móng, vệ sinh tai, mắt' },
        
        // P202 - Xét nghiệm
        { room_code: 'P202', service_name: 'Siêu Âm Chẩn Đoán', price: 400000, duration_minutes: 30, description: 'Siêu âm toàn bộ cơ quan nội tạng' },
        { room_code: 'P202', service_name: 'Chụp X-Ray Chẩn Đoán', price: 350000, duration_minutes: 20, description: 'Chụp X-ray các bộ phận' },
        { room_code: 'P202', service_name: 'Xét Nghiệm Máu Toàn Diện', price: 250000, duration_minutes: 15, description: 'Xét nghiệm máu CBC, Biochemistry' },
        { room_code: 'P202', service_name: 'Xét Nghiệm Nước Tiểu & Phân', price: 200000, duration_minutes: 15, description: 'Xét nghiệm nước tiểu và phân' },
        
        // P203 - Hậu phẫu
        { room_code: 'P203', service_name: 'Theo Dõi Hậu Phẫu (1 đêm)', price: 500000, duration_minutes: 0, description: 'Lưu trú theo dõi sau phẫu thuật' },
        { room_code: 'P203', service_name: 'Điều Trị Nằm Viện (1 ngày)', price: 300000, duration_minutes: 0, description: 'Lưu trú điều trị bệnh nặng' },
      ];

      for (const service of servicesData) {
        const room_id = roomMap[service.room_code];
        if (room_id) {
          await connection.execute(
            'INSERT INTO Services (room_id, service_name, price, duration_minutes, description) VALUES (?, ?, ?, ?, ?)',
            [room_id, service.service_name, service.price, service.duration_minutes, service.description]
          );
        }
      }
      console.log('✅ Đã thêm dữ liệu dịch vụ');
    } else {
      console.log('⏭️  Dịch vụ đã tồn tại, bỏ qua');
    }

    // Kiểm tra tài liệu y khoa cho RAG (cơ sở tri thức của bác sĩ)
    const [existingDocs] = await connection.execute('SELECT COUNT(*) as count FROM Medical_Documents');

    if (existingDocs[0].count === 0) {
      const [doctors] = await connection.execute("SELECT id FROM Users WHERE role = 'doctor' LIMIT 1");
      const doctorId = doctors.length > 0 ? doctors[0].id : null;

      if (doctorId) {
        const documentsData = [
          {
            title: 'Rối loạn tiêu hóa ở chó mèo: nôn mửa và tiêu chảy',
            species: 'all',
            category: 'Tiêu hóa',
            content: 'Nôn mửa và tiêu chảy ở chó mèo thường do ăn phải thức ăn lạ, ký sinh trùng đường ruột, nhiễm virus (Parvo, Care) hoặc ngộ độc thực phẩm. Dấu hiệu cần theo dõi: bỏ ăn trên 24 giờ, nôn liên tục kèm máu, tiêu chảy có máu, mất nước (da mất đàn hồi, mắt trũng). Xử trí tại nhà: ngừng cho ăn 6-12 giờ nhưng vẫn cho uống nước từng ít một, sau đó cho ăn thức ăn dễ tiêu. Nếu triệu chứng kéo dài trên 1 ngày hoặc có dấu hiệu mất nước nặng, cần đưa đến phòng Khám Nội ngay để xét nghiệm và truyền dịch.'
          },
          {
            title: 'Bệnh ngoài da: ngứa, rụng lông, viêm da',
            species: 'all',
            category: 'Da liễu',
            content: 'Ngứa, rụng lông từng mảng, da đỏ hoặc có vảy thường do ve rận, nấm da, dị ứng thức ăn hoặc viêm da tiếp xúc. Nếu thú cưng gãi liên tục, có mùi hôi bất thường trên da hoặc xuất hiện mụn mủ, cần khám chuyên khoa Da liễu để xác định nguyên nhân (soi da, cạo da xét nghiệm) trước khi dùng thuốc, tránh tự ý bôi thuốc của người.'
          },
          {
            title: 'Ho, khó thở và các vấn đề hô hấp',
            species: 'all',
            category: 'Hô hấp',
            content: 'Ho khan, ho có đờm, thở khò khè hoặc thở gấp có thể liên quan đến viêm phế quản, viêm phổi, hoặc bệnh tim ở thú cưng lớn tuổi. Nếu thú cưng thở gấp khi nghỉ ngơi, môi/lưỡi tím tái, hoặc ho kéo dài trên 3 ngày, đây là dấu hiệu cấp cứu cần đưa đến khám Nội tổng quát và siêu âm/X-quang ngực ngay lập tức.'
          },
          {
            title: 'Lịch tiêm phòng và tẩy giun định kỳ cho chó mèo',
            species: 'all',
            category: 'Phòng bệnh',
            content: 'Chó mèo con nên tẩy giun lần đầu lúc 2-3 tuần tuổi, lặp lại mỗi 2-3 tuần đến 3 tháng tuổi, sau đó mỗi 3 tháng một lần. Tiêm phòng mũi cơ bản (Care, Parvo, Lepto) bắt đầu từ 6-8 tuần tuổi, nhắc lại sau 3-4 tuần, tiêm nhắc hàng năm. Đây là thông tin phòng ngừa, không thay thế cho chẩn đoán khi thú cưng đã có triệu chứng bệnh.'
          },
        ];

        for (const doc of documentsData) {
          const [insertResult] = await connection.execute(
            'INSERT INTO Medical_Documents (doctor_id, title, species, category, content) VALUES (?, ?, ?, ?, ?)',
            [doctorId, doc.title, doc.species, doc.category, doc.content]
          );
          try {
            await indexDocument(insertResult.insertId);
          } catch (embedError) {
            console.warn(`⚠️  Không thể tạo embedding cho tài liệu "${doc.title}": ${embedError.message}`);
          }
        }
        console.log('✅ Đã thêm dữ liệu tài liệu y khoa cho RAG');
      } else {
        console.log('⏭️  Chưa có tài khoản bác sĩ, bỏ qua seed tài liệu RAG');
      }
    } else {
      console.log('⏭️  Tài liệu y khoa đã tồn tại, bỏ qua');
    }

    // Tài khoản admin mặc định để quản lý toàn viện (thống kê, tài khoản bác sĩ, tri thức AI)
    const [existingAdmins] = await connection.execute("SELECT COUNT(*) as count FROM Users WHERE role = 'admin'");
    if (existingAdmins[0].count === 0) {
      const defaultPassword = process.env.ADMIN_DEFAULT_PASSWORD || 'Admin@123';
      const password_hash = await bcrypt.hash(defaultPassword, 10);
      await connection.execute(
        'INSERT INTO Users (full_name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, "admin")',
        ['Quản trị viên hệ thống', 'admin@petcare.local', password_hash, null]
      );
      console.log(`✅ Đã tạo tài khoản admin mặc định (admin@petcare.local / ${defaultPassword}) - vui lòng đổi mật khẩu sau khi đăng nhập`);
    } else {
      console.log('⏭️  Tài khoản admin đã tồn tại, bỏ qua');
    }

    // Tài khoản dược sĩ mẫu phụ trách quầy thuốc và kho
    const [existingPharmacists] = await connection.execute("SELECT COUNT(*) as count FROM Users WHERE role = 'pharmacist'");
    if (existingPharmacists[0].count === 0) {
      const pharmacistPassword = process.env.PHARMACIST_DEFAULT_PASSWORD || 'Pharma@123';
      const pharmacistHash = await bcrypt.hash(pharmacistPassword, 10);
      await connection.execute(
        'INSERT INTO Users (full_name, email, password_hash, phone, role) VALUES (?, ?, ?, ?, "pharmacist")',
        ['Dược sĩ quầy thuốc', 'pharmacist@petcare.local', pharmacistHash, null]
      );
      console.log(`✅ Đã tạo tài khoản dược sĩ mặc định (pharmacist@petcare.local / ${pharmacistPassword}) - vui lòng đổi mật khẩu sau khi đăng nhập`);
    }

    // Gán mỗi bác sĩ chưa có phòng vào một phòng khám còn trống (1 bác sĩ : 1 phòng)
    const [unassignedDoctors] = await connection.execute(`
      SELECT u.id FROM Users u
      LEFT JOIN Clinic_Rooms cr ON cr.doctor_id = u.id
      WHERE u.role = 'doctor' AND cr.id IS NULL
    `);
    if (unassignedDoctors.length > 0) {
      const [freeRooms] = await connection.execute(
        'SELECT id FROM Clinic_Rooms WHERE doctor_id IS NULL ORDER BY id'
      );
      const assignCount = Math.min(unassignedDoctors.length, freeRooms.length);
      for (let i = 0; i < assignCount; i++) {
        await connection.execute('UPDATE Clinic_Rooms SET doctor_id = ? WHERE id = ?', [
          unassignedDoctors[i].id,
          freeRooms[i].id
        ]);
      }
      if (assignCount > 0) {
        console.log(`✅ Đã gán ${assignCount} bác sĩ vào phòng khám phụ trách`);
      }
    }

    // Danh mục thuốc mẫu kèm tồn kho
    const [existingMedicines] = await connection.execute('SELECT COUNT(*) as count FROM Medicines');
    if (existingMedicines[0].count === 0) {
      const medicinesData = [
        { name: 'Amoxicillin 250mg', unit: 'viên', price: 3000, stock_quantity: 500, description: 'Kháng sinh phổ rộng điều trị nhiễm khuẩn' },
        { name: 'Men tiêu hóa Probiotic', unit: 'gói', price: 8000, stock_quantity: 300, description: 'Hỗ trợ tiêu hóa, cân bằng hệ vi sinh đường ruột' },
        { name: 'Thuốc tẩy giun Praziquantel', unit: 'viên', price: 15000, stock_quantity: 200, description: 'Tẩy giun sán cho chó mèo' },
        { name: 'Vitamin tổng hợp B-Complex', unit: 'chai', price: 45000, stock_quantity: 150, description: 'Bổ sung vitamin nhóm B, tăng sức đề kháng' },
        { name: 'Thuốc nhỏ mắt Tobramycin', unit: 'chai', price: 35000, stock_quantity: 100, description: 'Điều trị viêm kết mạc, nhiễm trùng mắt' },
        { name: 'Thuốc bôi ngoài da Betadine', unit: 'chai', price: 25000, stock_quantity: 120, description: 'Sát trùng vết thương ngoài da' }
      ];
      for (const med of medicinesData) {
        const [insertResult] = await connection.execute(
          'INSERT INTO Medicines (name, unit, price, stock_quantity, description) VALUES (?, ?, ?, ?, ?)',
          [med.name, med.unit, med.price, med.stock_quantity, med.description]
        );
        await connection.execute(
          "INSERT INTO Stock_Movements (medicine_id, change_qty, quantity_after, movement_type, note) VALUES (?, ?, ?, 'initial', 'Tồn kho ban đầu')",
          [insertResult.insertId, med.stock_quantity, med.stock_quantity]
        );
      }
      console.log('✅ Đã thêm dữ liệu danh mục thuốc');
    } else {
      console.log('⏭️  Danh mục thuốc đã tồn tại, bỏ qua');
    }

    console.log('\n🎉 Seed data hoàn thành!');

  } catch (error) {
    console.error('❌ Lỗi khi thêm seed data:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

module.exports = seedData;
