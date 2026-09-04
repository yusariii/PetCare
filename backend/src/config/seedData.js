const mysql = require('mysql2/promise');
require('dotenv').config();

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

    console.log('\n🎉 Seed data hoàn thành!');

  } catch (error) {
    console.error('❌ Lỗi khi thêm seed data:', error.message);
    throw error;
  } finally {
    if (connection) await connection.end();
  }
};

module.exports = seedData;
