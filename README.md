# 🐾 PetCare — Hệ Thống Quản Lý Bệnh Viện Thú Y, Đặt Lịch Khám & Trợ Lý AI (RAG)

> **Đồ Án Tốt Nghiệp / Khóa Luận Tốt Nghiệp Ngành Công Nghệ Thông Tin**  
> Nền tảng đa nền tảng (Mobile & Web) tích hợp toàn diện quy trình vận hành bệnh viện thú y: từ quản lý hồ sơ thú cưng, tư vấn triệu chứng qua AI Gemini kết hợp RAG (Retrieval-Augmented Generation), đặt lịch khám theo phòng chuyên khoa, lập bệnh án & kê đơn thuốc điện tử, cho đến tạo hóa đơn thanh toán QR tại phòng khám và quầy dược.

---

## 🌟 Điểm Nổi Bật Của Hệ Thống

### 1. Phân Quyền Đa Vai Trò (5 Roles RBAC)
Hệ thống phân tách luồng nghiệp vụ và giao diện chuyên biệt cho 5 nhóm người dùng:
- **👤 Khách hàng (`customer`):**
  - Quản lý danh sách thú cưng (thêm, sửa thông tin, theo dõi cân nặng, ngày sinh, giống loài: Chó / Mèo / Khác).
  - Xem **Sơ đồ bệnh viện 2 tầng** trực quan và danh mục dịch vụ của từng phòng khám.
  - **Đặt lịch khám đa dịch vụ** theo khung giờ thực tế, kiểm tra sức chứa (`max_slot_per_hour`) và ràng buộc thời gian đặt trước tối thiểu 60 phút.
  - **Tư vấn Bác sĩ AI (RAG):** Chat trực tiếp với Google Gemini AI có nạp ngữ cảnh hồ sơ thú cưng & tri thức y khoa nội bộ, phân loại mức độ khẩn cấp (`low`, `medium`, `high`) và gợi ý đúng phòng chuyên khoa cần đặt lịch.
  - Xem **Sổ sức khỏe điện tử** (bệnh án, lịch tiêm chủng), xem đơn thuốc bác sĩ kê, **đặt giữ chỗ thuốc** và **đánh giá dịch vụ** (1–5 sao).
  - Quản lý thông tin cá nhân & cập nhật số điện thoại liên hệ để đồng bộ hồ sơ tại quầy.
- **🩺 Bác sĩ chuyên khoa (`doctor`):**
  - Mỗi bác sĩ phụ trách **1 phòng khám chuyên khoa** độc lập (`Clinic_Rooms`).
  - Tiếp nhận, xác nhận hoặc hoàn thành lịch khám trong ngày; xem toàn bộ tiền sử bệnh án & đơn thuốc của thú cưng.
  - **Chỉ định & Cập nhật Dịch vụ Khám Đa phòng:** Bác sĩ có thể tích chọn / điều chỉnh các dịch vụ thực tế làm cho bé (bao gồm cả dịch vụ của phòng mình lẫn dịch vụ chuyển khám sang phòng khác như Xét nghiệm, Siêu âm, Phẫu thuật). Ngay khi lưu chỉ định hoặc hoàn thành ca khám, toàn bộ dịch vụ được **tự động đồng bộ vào hóa đơn chờ tại Quầy Thu Ngân**.
  - **Lập Hồ sơ bệnh án (`Health_Records`)** và tự động tạo lịch nhắc tái khám/tiêm phòng (`Reminders`).
  - **Kê đơn thuốc điện tử (`Prescriptions`)** trực tiếp từ danh mục thuốc đang hoạt động trong kho.
  - Đóng góp và quản lý tài liệu y khoa cho cơ sở tri thức AI (RAG).
- **💳 Thu ngân viện phí (`cashier`):**
  - **Thanh toán viện phí tập trung 1 lần cho tất cả các phòng (`Invoices`):**
    - Nhận tự động danh sách các ca khám hoàn thành và toàn bộ dịch vụ từ các phòng do Bác sĩ chỉ định.
    - Mở ngay **Mã QR Thanh toán** chỉ với 1 chạm (vẫn hỗ trợ điều chỉnh lại dịch vụ đa phòng nếu khách yêu cầu tại quầy).
    - Hỗ trợ nút **`+ Tạo hóa đơn vãng lai`** (cho khách không đặt lịch trước), tích hợp **tra cứu SĐT khách hàng** để tự động điền tên chủ, chọn thú cưng và liên kết hóa đơn vào tài khoản khách hàng.
    - Sau khi bấm **"Hoàn tất & Đóng"**, hóa đơn chuyển sang `paid` và khóa mọi chỉnh sửa.
- **💊 Dược sĩ quầy thuốc (`pharmacist`):**
  - **Quản lý Kho thuốc (`Medicines`):** Thêm/sửa thuốc, nhập/xuất điều chỉnh tồn kho và truy vết lịch sử biến động tồn kho (`Stock_Movements`).
  - **Quầy Dược & Thanh toán QR (`Medicine_Orders`):**
    - Xử lý đơn thuốc khách đặt giữ chỗ từ đơn kê của bác sĩ: cho phép **tích chọn/bỏ chọn thuốc hoặc điều chỉnh số lượng thực tế khách lấy** (tự động hoàn kho hoặc trừ kho phần chênh lệch) trước khi tạo mã QR thanh toán.
    - Hỗ trợ nút **`+ Tạo hóa đơn` bán thuốc trực tiếp cho khách vãng lai** (kèm tính năng tra cứu SĐT liên kết tài khoản và thú cưng).
    - Khóa thao tác sau khi đơn đã thanh toán (`paid`).
- **🛡️ Quản trị viên (`admin`):**
  - **Bảng điều khiển thống kê (Analytics Dashboard):** Theo dõi doanh thu, số lượng ca khám, tỷ lệ trạng thái lịch hẹn, phân bố mức độ khẩn cấp AI.
  - **Quản lý nhân sự & người dùng:** Tạo tài khoản Bác sĩ / Dược sĩ / Thu ngân, phân công phòng khám phụ trách, khóa/mở khóa tài khoản.
  - **Quản lý Cơ sở tri thức AI (RAG Knowledge Base):** Quản trị tài liệu y khoa và đồng bộ Vector Embeddings.

---

## 🛠️ Công Nghệ Sử Dụng (Tech Stack)

### **Frontend (Mobile & Web Responsive)**
- **Framework:** React Native (`0.74.1`) & Expo SDK `51` (`react-native-web` hỗ trợ chạy mượt trên trình duyệt Desktop/Tablet/Mobile).
- **Navigation:** React Navigation v6 (`bottom-tabs`, `native-stack`).
- **HTTP Client:** Axios (tự động đính kèm JWT Bearer Token và xử lý phiên đăng nhập).
- **UI & Charts:** `@expo/vector-icons`, `react-native-chart-kit`, `react-native-svg`, QR Code động (`api.qrserver.com`).

### **Backend (RESTful API & AI Service)**
- **Runtime & Framework:** Node.js & Express.js.
- **Cơ sở dữ liệu:** MySQL 8.0 (`mysql2/promise` với Connection Pool & Transaction `FOR UPDATE` chống race-condition tồn kho).
- **Bảo mật & Xác thực:** JWT (`jsonwebtoken`), mã hóa mật khẩu `bcryptjs`, phân quyền Middleware (`verifyToken`, `requireRole`).
- **Trí tuệ nhân tạo (AI & RAG):** `@google/genai` (Google Gemini 2.5 Flash + Text Embedding cho truy vấn ngữ nghĩa RAG).
- **Tác vụ nền:** `node-cron` (tự động quét và nhắc lịch tiêm chủng/tái khám hàng ngày lúc 08:00 sáng).

---

## 🗄️ Kiến Trúc Cơ Sở Dữ Liệu (18 Bảng Tự Động Khởi Tạo)

Khi khởi chạy Backend, hệ thống tự động tạo Database và toàn bộ **18 bảng** kèm dữ liệu mẫu (Seed Data):
1. `Users` — Tài khoản người dùng (`customer`, `doctor`, `pharmacist`, `admin`).
2. `Clinic_Rooms` — 6 phòng khám chuyên khoa thuộc 2 tầng, gắn với bác sĩ phụ trách.
3. `Services` — 19 dịch vụ khám/điều trị/spa/xét nghiệm theo từng phòng.
4. `Pets` — Hồ sơ thú cưng của khách hàng (`dog`, `cat`, `other`).
5. `Appointments` — Lịch hẹn khám bệnh.
6. `Appointment_Services` — Bảng trung gian lưu nhiều dịch vụ trong 1 lịch hẹn.
7. `Health_Records` — Hồ sơ bệnh án, chẩn đoán, phác đồ điều trị.
8. `Reminders` — Lịch nhắc tái khám / tiêm phòng tự động.
9. `AI_Consultations` — Lịch sử phiên tư vấn AI và gợi ý phòng khám.
10. `Reviews` — Đánh giá sao & nhận xét của khách hàng sau ca khám.
11. `Medical_Documents` — Tài liệu y khoa chuẩn phục vụ RAG.
12. `Document_Chunks` — Các phân đoạn văn bản kèm Vector Embedding (`JSON`) cho tìm kiếm tương đồng Cosine.
13. `Medicines` — Danh mục thuốc và số lượng tồn kho (`stock_quantity`).
14. `Prescriptions` — Đơn thuốc bác sĩ kê gắn với bệnh án.
15. `Prescription_Items` — Chi tiết thuốc, liều dùng và số lượng trong đơn kê.
16. `Medicine_Orders` — Hóa đơn mua thuốc tại quầy dược (hỗ trợ cả đơn bác sĩ kê `prescription` và đơn vãng lai `walk_in`).
17. `Medicine_Order_Items` — Danh sách thuốc và số lượng thực tế khách thanh toán tại quầy.
18. `Stock_Movements` — Nhật ký biến động tồn kho (`initial`, `import`, `adjust`, `reserve`, `release`).
19. `Invoices` & `Invoice_Items` — Hóa đơn thanh toán dịch vụ khám tại phòng bác sĩ (hỗ trợ cả đơn đặt lịch `appointment` và đơn vãng lai `walk_in`).

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh (Quick Start)

> 📖 Xem hướng dẫn chi tiết từng bước và kịch bản kiểm thử tại file **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**.

### 1. Cấu hình & Chạy Backend
```bash
cd backend
npm install
```
Tạo file `.env` trong thư mục `backend/`:
```env
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=your_mysql_password
DB_NAME=pet_care_db
JWT_SECRET=petcare_super_secret_key_2026
GEMINI_API_KEY=your_google_gemini_api_key
```
Khởi chạy server (tự động tạo DB, bảng và dữ liệu mẫu):
```bash
npm run dev
```

### 2. Cấu hình & Chạy Frontend
```bash
cd frontend
npm install
npx expo start
```
- Nhấn phím **`w`** để mở giao diện Web trên trình duyệt.
- Quét mã QR bằng ứng dụng **Expo Go** trên điện thoại hoặc nhấn **`a`** để mở máy ảo Android.

---

## 🔑 Tài Khoản Mặc Định (Tự Động Tạo Khi Chạy Backend)

| Vai trò | Email đăng nhập | Mật khẩu mặc định | Ghi chú |
| :--- | :--- | :--- | :--- |
| **Quản trị viên (`admin`)** | `admin@petcare.local` | `Admin@123` | Quản lý toàn viện, tạo tài khoản Bác sĩ/Dược sĩ/Thu ngân |
| **Thu ngân (`cashier`)** | `cashier@petcare.local` | `Cashier@123` | Thanh toán viện phí 1 lần cho tất cả các phòng & đơn vãng lai |
| **Dược sĩ (`pharmacist`)** | `pharmacist@petcare.local` | `Pharma@123` | Quản lý kho thuốc, thanh toán & xuất thuốc QR |
| **Bác sĩ (`doctor`)** | *(Tạo trong màn Admin)* | *(Do Admin đặt)* | Phụ trách khám bệnh, chỉ định dịch vụ đa phòng & kê đơn |
| **Khách hàng (`customer`)** | *(Đăng ký trực tiếp trên App)* | *(Do khách đặt)* | Quản lý thú cưng, đặt lịch, tư vấn AI |

---

## 🔒 Bản Quyền
Dự án được xây dựng phục vụ mục đích nghiên cứu, học tập và bảo vệ Đồ án tốt nghiệp Đại học.
