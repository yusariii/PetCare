# 🐾 PetCare - Hệ Thống Chăm Sóc & Đặt Lịch Thú Cưng Tích Hợp AI

> **Đồ án tốt nghiệp / Khóa luận tốt nghiệp ngành Công nghệ thông tin**  
> Ứng dụng di động và web hỗ trợ chủ nuôi quản lý hồ sơ thú cưng, đặt lịch dịch vụ thông minh và tư vấn sức khỏe sơ bộ qua trợ lý ảo Google Gemini AI.

---

## 📌 Tính năng nổi bật

- **Quản lý Hồ sơ & Sức khỏe:** Lưu trữ thông tin cá nhân hóa (loài, giống, cân nặng, giới tính), theo dõi lịch sử tiêm phòng và khám chữa bệnh.
- **Tự động nhắc lịch (Automated Reminders):** Hệ thống Cronjob quét dữ liệu hàng ngày và tự động gửi thông báo đến hạn tiêm phòng/tẩy giun.
- **Đặt lịch dịch vụ (Booking Engine):** Kiểm tra xung đột slot/khung giờ theo thời gian thực (real-time), ràng buộc thời gian đặt tối thiểu 60 phút.
- **Trợ lý Bác sĩ Thú y AI:** Tích hợp Google Gemini API có nạp ngữ cảnh (Context-aware Prompting) dựa trên thông tin thực tế của từng thú cưng để đưa ra lời khuyên và phân loại mức độ nguy hiểm (low, medium, high).
- **Đánh giá & Phản hồi:** Cho phép khách hàng để lại đánh giá sao và bình luận sau khi hoàn thành dịch vụ.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

### **Frontend (Mobile & Web)**
- **Framework:** React Native (Expo SDK)
- **Navigation:** React Navigation (Bottom Tabs)
- **Networking:** Axios
- **Storage:** AsyncStorage
- **Design System:** Responsive Layout (hỗ trợ cả Mobile, Tablet và Desktop Browser)

### **Backend (RESTful API)**
- **Runtime:** Node.js & Express.js
- **Database:** MySQL (sử dụng connection pool mysql2/promise)
- **Authentication:** JWT (JSON Web Tokens) & bcryptjs
- **AI Integration:** @google/genai (Gemini 2.5 Flash)
- **Background Jobs:** node-cron

---

## 🚀 Hướng dẫn cài đặt & Khởi chạy

### 1. Yêu cầu môi trường
- **Node.js**: phiên bản >= 18.x
- **MySQL Server**: phiên bản >= 8.0
- **Gemini API Key**: Đăng ký miễn phí tại Google AI Studio

---

### 2. Thiết lập Cơ sở dữ liệu (Database)
1. Mở MySQL Workbench hoặc phpMyAdmin.
2. Tạo database và import bảng:
   CREATE DATABASE pet_care_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
3. Import đầy đủ 8 bảng: Users, Pets, Services, Appointments, Health_Records, Reminders, AI_Consultations, Reviews.

---

### 3. Khởi chạy Backend API

1. Di chuyển vào thư mục backend:
   cd backend

2. Cài đặt các gói phụ thuộc:
   npm install

3. Cấu hình file .env:
   PORT=5000
   DB_HOST=localhost
   DB_USER=root
   DB_PASS=123456
   DB_NAME=pet_care_db
   JWT_SECRET=your_jwt_secret_key
   GEMINI_API_KEY=your_gemini_api_key_here

4. Khởi chạy Server:
   npm run dev
   (Server sẽ lắng nghe tại: http://localhost:5000)

---

### 4. Khởi chạy Frontend App

1. Di chuyển vào thư mục frontend:
   cd ../frontend

2. Cài đặt các thư viện:
   npm install

3. Khởi chạy ứng dụng với Expo:
   npx expo start

- **Chạy trên trình duyệt Web:** Nhấn phím w
- **Chạy trên điện thoại thật:** Dùng ứng dụng Expo Go (Android/iOS) quét mã QR hiển thị trên Terminal
- **Chạy trên máy ảo Android:** Nhấn phím a

---

## 🔒 Bản quyền & Giấy phép
Dự án được xây dựng phục vụ cho mục đích nghiên cứu, học tập và làm đồ án tốt nghiệp.