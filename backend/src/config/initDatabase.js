const mysql = require('mysql2/promise');
require('dotenv').config();

const initDatabase = async () => {
  let connection;
  try {
    // Kết nối tạm thời không có database
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || process.env.DB_PASS || '',
      port: Number(process.env.DB_PORT) || 3306,
    });

    console.log('📌 Đang tạo database...');

    // Tạo database
    await connection.execute(`
      CREATE DATABASE IF NOT EXISTS pet_care_db
      CHARACTER SET utf8mb4 
      COLLATE utf8mb4_unicode_ci
    `);

    console.log('✅ Database pet_care_db được tạo/đã tồn tại');

    // Sử dụng database
    await connection.query('USE pet_care_db');

    // 1. Bảng Users
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS Users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        full_name VARCHAR(100) NOT NULL,
        email VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        phone VARCHAR(20),
        role ENUM('customer', 'doctor', 'admin', 'pharmacist') NOT NULL DEFAULT 'customer',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Bảng Users được tạo');

    // Migration: mở rộng role sang 'admin' và thêm cờ khoá tài khoản (bỏ qua nếu DB đã tạo từ trước)
    try {
      await connection.execute(`
        ALTER TABLE Users MODIFY COLUMN role ENUM('customer', 'doctor', 'admin', 'pharmacist') NOT NULL DEFAULT 'customer'
      `);
    } catch (alterError) {
      console.warn('⚠️  Không thể cập nhật ENUM role của Users:', alterError.message);
    }
    try {
      await connection.execute(`
        ALTER TABLE Users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER role
      `);
      console.log('✅ Đã thêm cột is_active vào Users');
    } catch (alterError) {
      if (alterError.code !== 'ER_DUP_FIELDNAME') {
        throw alterError;
      }
    }

    // 2. Bảng Clinic_Rooms
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS Clinic_Rooms (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_code VARCHAR(20) NOT NULL UNIQUE,
        room_name VARCHAR(100) NOT NULL,
        floor INT NOT NULL DEFAULT 1,
        coordinate_x INT NOT NULL DEFAULT 0,
        coordinate_y INT NOT NULL DEFAULT 0,
        max_slot_per_hour INT NOT NULL DEFAULT 2,
        description TEXT,
        doctor_id INT NULL UNIQUE,
        FOREIGN KEY (doctor_id) REFERENCES Users(id) ON DELETE SET NULL,
        INDEX idx_floor (floor),
        INDEX idx_room_code (room_code)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Bảng Clinic_Rooms được tạo');

    // Migration: mỗi bác sĩ phụ trách tối đa 1 phòng khám (bỏ qua nếu đã tồn tại)
    try {
      await connection.execute(`
        ALTER TABLE Clinic_Rooms ADD COLUMN doctor_id INT NULL UNIQUE AFTER description
      `);
      await connection.execute(`
        ALTER TABLE Clinic_Rooms ADD FOREIGN KEY (doctor_id) REFERENCES Users(id) ON DELETE SET NULL
      `);
      console.log('✅ Đã thêm cột doctor_id vào Clinic_Rooms');
    } catch (alterError) {
      if (alterError.code !== 'ER_DUP_FIELDNAME') {
        throw alterError;
      }
    }

    // 3. Bảng Pets
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS Pets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        name VARCHAR(50) NOT NULL,
        species ENUM('dog', 'cat', 'other') NOT NULL,
        breed VARCHAR(50),
        weight_kg DECIMAL(4,2),
        birth_date DATE,
        gender ENUM('male', 'female'),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
        INDEX idx_user_id (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Bảng Pets được tạo');

    // 4. Bảng Services
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS Services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        room_id INT NOT NULL,
        service_name VARCHAR(100) NOT NULL,
        description TEXT,
        price DECIMAL(10,2) NOT NULL,
        duration_minutes INT DEFAULT 30,
        FOREIGN KEY (room_id) REFERENCES Clinic_Rooms(id) ON DELETE CASCADE,
        INDEX idx_room_id (room_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Bảng Services được tạo');

    // 5. Bảng Appointments
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS Appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        pet_id INT NOT NULL,
        room_id INT NOT NULL,
        service_id INT NOT NULL,
        doctor_id INT NULL,
        appointment_datetime DATETIME NOT NULL,
        status ENUM('pending', 'confirmed', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
        FOREIGN KEY (pet_id) REFERENCES Pets(id) ON DELETE CASCADE,
        FOREIGN KEY (room_id) REFERENCES Clinic_Rooms(id) ON DELETE RESTRICT,
        FOREIGN KEY (service_id) REFERENCES Services(id) ON DELETE RESTRICT,
        FOREIGN KEY (doctor_id) REFERENCES Users(id) ON DELETE SET NULL,
        INDEX idx_appointments_room_datetime (room_id, appointment_datetime),
        INDEX idx_user_id (user_id),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Bảng Appointments được tạo');

    // 5b. Các dịch vụ bổ sung trong cùng một lịch hẹn
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS Appointment_Services (
        appointment_id INT NOT NULL,
        service_id INT NOT NULL,
        PRIMARY KEY (appointment_id, service_id),
        FOREIGN KEY (appointment_id) REFERENCES Appointments(id) ON DELETE CASCADE,
        FOREIGN KEY (service_id) REFERENCES Services(id) ON DELETE RESTRICT,
        INDEX idx_appointment_services_service_id (service_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Bảng Appointment_Services được tạo');

    // 6. Bảng Health_Records
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS Health_Records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pet_id INT NOT NULL,
        doctor_id INT NOT NULL,
        record_type ENUM('vaccine', 'medical', 'deworming', 'surgery') NOT NULL,
        title VARCHAR(150) NOT NULL,
        diagnosis TEXT NOT NULL,
        treatment_plan TEXT,
        performed_date DATE NOT NULL,
        next_due_date DATE NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pet_id) REFERENCES Pets(id) ON DELETE CASCADE,
        FOREIGN KEY (doctor_id) REFERENCES Users(id) ON DELETE RESTRICT,
        INDEX idx_pet_id (pet_id),
        INDEX idx_next_due_date (next_due_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Bảng Health_Records được tạo');

    // 7. Bảng Reminders
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS Reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pet_id INT NOT NULL,
        title VARCHAR(150) NOT NULL,
        remind_date DATE NOT NULL,
        is_sent BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pet_id) REFERENCES Pets(id) ON DELETE CASCADE,
        INDEX idx_reminders_date_sent (remind_date, is_sent)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Bảng Reminders được tạo');

    // 8. Bảng AI_Consultations
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS AI_Consultations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        pet_id INT NOT NULL,
        user_query TEXT NOT NULL,
        ai_advice TEXT NOT NULL,
        urgency_level ENUM('low', 'medium', 'high') NOT NULL DEFAULT 'low',
        recommended_room_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (pet_id) REFERENCES Pets(id) ON DELETE CASCADE,
        FOREIGN KEY (recommended_room_id) REFERENCES Clinic_Rooms(id) ON DELETE SET NULL,
        INDEX idx_pet_id (pet_id),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Bảng AI_Consultations được tạo');

    // Migration: thêm cột lưu các tài liệu RAG đã dùng cho mỗi lần tư vấn (bỏ qua nếu đã tồn tại)
    try {
      await connection.execute(`
        ALTER TABLE AI_Consultations ADD COLUMN source_document_ids TEXT NULL AFTER recommended_room_id
      `);
      console.log('✅ Đã thêm cột source_document_ids vào AI_Consultations');
    } catch (alterError) {
      if (alterError.code !== 'ER_DUP_FIELDNAME') {
        throw alterError;
      }
    }

    // 9. Bảng Medical_Documents - cơ sở tri thức do bác sĩ cung cấp, dùng để RAG khi tư vấn AI
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS Medical_Documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        species ENUM('dog', 'cat', 'other', 'all') NOT NULL DEFAULT 'all',
        category VARCHAR(100),
        content TEXT NOT NULL,
        embedding LONGTEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES Users(id) ON DELETE CASCADE,
        INDEX idx_species (species),
        INDEX idx_is_active (is_active)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('✅ Bảng Medical_Documents được tạo');

    console.log('\n🎉 Database initialization hoàn thành!');
    console.log('📝 Lưu ý: Vui lòng thêm dữ liệu mẫu như Clinic_Rooms và Services');

  } catch (error) {
    if (error.code === 'ER_DB_CREATE_EXISTS') {
      console.log('✅ Database đã tồn tại');
    } else {
      console.error('❌ Lỗi khi tạo database:', error.message);
      throw error;
    }
  } finally {
    if (connection) await connection.end();
  }
};

module.exports = initDatabase;
