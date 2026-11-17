# 🛠️ Hướng Dẫn Cài Đặt, Vận Hành & Kịch Bản Kiểm Thử (Setup & Testing Guide)

Tài liệu này hướng dẫn chi tiết cách thiết lập môi trường, khởi chạy hệ thống **PetCare Hospital Management System** và các kịch bản demo phục vụ bảo vệ Đồ án tốt nghiệp.

---

## 📋 1. Yêu Cầu Hệ Thống (Prerequisites)

- **Node.js:** Phiên bản `>= 18.x` (khuyến nghị Node 18 LTS hoặc Node 20 LTS).
- **MySQL Server:** Phiên bản `>= 8.0` (đang chạy tại cổng mặc định `3306`).
- **Google Gemini API Key:** Lấy miễn phí tại [Google AI Studio](https://aistudio.google.com/) để sử dụng tính năng Tư vấn AI & RAG Vector Embedding.
- **Trình duyệt Web** (Chrome / Edge) hoặc thiết bị di động cài đặt **Expo Go**.

---

## ⚙️ 2. Thiết Lập & Khởi Chạy Backend

### Bước 2.1: Cài đặt thư viện
```bash
cd backend
npm install
```

### Bước 2.2: Tạo file cấu hình `.env`
Tạo file `.env` ngay trong thư mục `backend/` với nội dung sau:

```env
PORT=5000
NODE_ENV=development

# Cấu hình MySQL
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASS=123456
DB_NAME=pet_care_db

# Bảo mật JWT
JWT_SECRET=petcare_secret_key_2026

# Google Gemini AI (Phục vụ Chat AI & RAG)
GEMINI_API_KEY=AIzaSyYourGeminiApiKeyHere

# Mật khẩu mặc định cho tài khoản seed (Tùy chọn)
ADMIN_DEFAULT_PASSWORD=Admin@123
PHARMACIST_DEFAULT_PASSWORD=Pharma@123
```

### Bước 2.3: Khởi chạy Backend (Tự động khởi tạo Database & Seed Data)
 Bạn **không cần** chạy câu lệnh SQL thủ công. Khi chạy lệnh dưới đây, hệ thống sẽ tự động thực thi `initDatabase.js` và `seedData.js`:
- Tự động tạo database `pet_care_db` (nếu chưa có).
- Tự động tạo và cập nhật (auto-migration) đầy đủ **18 bảng** dữ liệu.
- Tự động thêm **6 phòng khám** (P101–P103 ở tầng 1, P201–P203 ở tầng 2), **19 dịch vụ**, **6 loại thuốc mẫu** kèm tồn kho ban đầu, tài liệu y khoa mẫu và tài khoản Admin/Dược sĩ mặc định.

```bash
# Chạy ở chế độ phát triển (tự động reload khi sửa code)
npm run dev

# Hoặc chạy bình thường
npm start
```

Khi terminal hiển thị thông báo sau là Backend đã sẵn sàng:
```text
╔══════════════════════════════════════════════════════╗
║   🏥 Pet Care Hospital Management System            ║
║   🚀 Server chạy tại http://localhost:5000          ║
║   📊 Environment: development                        ║
╚══════════════════════════════════════════════════════╝
```

> **Lưu ý về RAG Embedding:** Nếu bạn thêm hoặc cập nhật `GEMINI_API_KEY` sau lần chạy đầu tiên và muốn đánh chỉ mục (index) lại toàn bộ tài liệu y khoa cho AI, hãy chạy lệnh:
> ```bash
> npm run reindex:docs
> ```

---

## 📱 3. Thiết Lập & Khởi Chạy Frontend

### Bước 3.1: Cài đặt thư viện
Mở một terminal mới và di chuyển vào thư mục `frontend/`:
```bash
cd frontend
npm install
```

### Bước 3.2: Khởi chạy ứng dụng Expo
```bash
npx expo start
```
Sau khi Metro Bundler khởi động:
- **Chạy trên Web (Khuyến nghị khi demo đa vai trò):** Nhấn phím **`w`** (Ứng dụng hỗ trợ giao diện Responsive cho cả màn hình rộng Desktop/Tablet và khung Mobile).
- **Chạy trên Máy ảo Android:** Nhấn phím **`a`** (tự động kết nối tới `http://10.0.2.2:5000/api`).
- **Chạy trên Điện thoại thật:** Quét mã QR bằng ứng dụng **Expo Go** (nếu dùng điện thoại thật, hãy cập nhật địa chỉ IP LAN của máy tính trong `frontend/src/api/client.js`).

---

## 🧪 4. Kịch Bản Demo & Kiểm Thử Toàn Diện (End-to-End Demo Flow)

Dưới đây là kịch bản chuẩn theo trình tự nghiệp vụ để trình bày khi bảo vệ đồ án:

### Bước 1: Quản trị viên (`admin@petcare.local` / `Admin@123`)
1. Đăng nhập bằng tài khoản Admin.
2. Vào tab **Nhân sự / Người dùng** $\rightarrow$ Tạo tài khoản Bác sĩ mới (ví dụ: `bs.noi@petcare.local`) và phân công phụ trách **Phòng P102 - Phòng Khám Nội & Tiêm Chủng**.
3. Xem tab **Tổng quan (Dashboard)** để kiểm tra biểu đồ thống kê hệ thống và tab **Tri thức AI** để xem các tài liệu y khoa RAG.

### Bước 2: Khách hàng (`customer`)
1. Đăng ký tài khoản khách hàng mới và đăng nhập.
2. Vào tab **Tài khoản cá nhân** $\rightarrow$ bấm **"Cập Nhật Thông Tin & SĐT"** $\rightarrow$ thêm số điện thoại (ví dụ: `0901234567`).
3. Tại màn **Trang chủ**, bấm **"+ Thêm thú cưng"** để tạo hồ sơ bé (chọn loài Chó/Mèo/Khác, nhập cân nặng, ngày sinh).
4. Vào tab **Bác sĩ AI** $\rightarrow$ chọn thú cưng vừa tạo và mô tả triệu chứng (ví dụ: *"Bé bỏ ăn, nôn dịch vàng từ sáng"*). AI sẽ phân tích dựa trên tài liệu RAG và gợi ý đặt lịch tại **Phòng P102**.
5. Sang tab **Đặt lịch** $\rightarrow$ chọn thú cưng, chọn **Phòng P102**, tích chọn **1 hoặc nhiều dịch vụ** (ví dụ: *Khám Nội Tổng Quát* + *Tiêm Chủng Cơ Bản*), chọn ngày và khung giờ còn trống $\rightarrow$ xác nhận đặt lịch.

### Bước 3: Bác sĩ chuyên khoa (`doctor`)
1. Đăng nhập bằng tài khoản Bác sĩ phụ trách Phòng P102.
2. Tại màn **Ca khám**, chọn ca khám của khách $\rightarrow$ bấm **"Xác nhận lịch khám"**.
3. **Chỉ định / Cập nhật dịch vụ khám (Đa phòng):**
   - Trong quá trình khám (ví dụ khám tại P102 nhưng yêu cầu làm thêm Xét nghiệm / Siêu âm ở P202 hoặc Tiểu phẫu ở P103), bác sĩ bấm **"Chỉ định dịch vụ khám"** $\rightarrow$ tích chọn thêm dịch vụ của các phòng liên quan $\rightarrow$ bấm **"Lưu chỉ định dịch vụ (Đồng bộ sang Thu ngân)"**.
4. Sau khi khám xong, bấm **"Hoàn thành khám bệnh"** $\rightarrow$ hệ thống **tự động đẩy toàn bộ dịch vụ đã chỉ định sang hóa đơn chờ tại Quầy Thu Ngân**.
5. Sang tab **Đã khám**: Bấm vào ca khám $\rightarrow$ **Lập hồ sơ bệnh án** (nhập chẩn đoán, phác đồ, hẹn ngày tái khám) $\rightarrow$ hệ thống tự động mở form **Kê đơn thuốc** (chọn thuốc từ kho dược, nhập liều dùng và số lượng).

### Bước 4: Thu ngân viện phí (`cashier@petcare.local` / `Cashier@123`)
1. Đăng nhập bằng tài khoản Thu ngân $\rightarrow$ mở tab **Quầy thu ngân**.
2. **Thanh toán 1 lần cho ca khám đặt lịch (đã tự động thêm sẵn dịch vụ từ Bác sĩ):**
   - Trên danh sách **Chờ thanh toán**, ca khám vừa hoàn thành đã hiển thị sẵn đầy đủ các dịch vụ từ tất cả các phòng và tổng tiền.
   - Thu ngân chỉ cần bấm **"Xuất Mã QR & Thu tiền"** $\rightarrow$ Popup Mã QR hiện ra ngay lập tức để khách quét thanh toán 1 lần duy nhất (nếu khách muốn điều chỉnh dịch vụ tại quầy, bấm **"Điều chỉnh DV"**) $\rightarrow$ bấm **"Hoàn tất & Đóng"**. Sau khi hoàn tất, hóa đơn chuyển sang trạng thái **Đã thanh toán** và khóa chỉnh sửa.
3. **Tạo hóa đơn cho khách vãng lai (không đặt lịch trước):**
   - Bấm nút **`+ Tạo hóa đơn vãng lai`** ở góc phải trên cùng:
     - *Trường hợp khách đã có tài khoản:* Nhập SĐT `0901234567` vào ô **Tìm theo SĐT khách hàng** $\rightarrow$ bấm **Tìm SĐT** $\rightarrow$ hệ thống tự động điền tên chủ, hiển thị danh sách thú cưng để chọn và liên kết hóa đơn vào tài khoản khách.
     - *Trường hợp khách mới hoàn toàn:* Chỉ cần nhập tên khách hàng, chọn loài (`Chó` / `Mèo` / `Khác`) và tích chọn các dịch vụ thực hiện từ bất kỳ phòng khám nào $\rightarrow$ xuất mã QR thanh toán.

### Bước 5: Khách hàng đặt giữ chỗ thuốc & Đánh giá
1. Khách hàng quay lại App $\rightarrow$ vào mục chi tiết thú cưng / đơn thuốc $\rightarrow$ bấm **"Đặt mua / Giữ chỗ đơn thuốc"** (hệ thống lập tức trừ giữ chỗ tồn kho để đảm bảo khách xuống quầy luôn còn thuốc).
2. Khách hàng vào lịch khám đã hoàn thành để gửi **Đánh giá sao & Nhận xét**.

### Bước 6: Dược sĩ quầy thuốc (`pharmacist@petcare.local` / `Pharma@123`)
1. Đăng nhập tài khoản Dược sĩ $\rightarrow$ mở tab **Quầy thuốc**.
2. **Xử lý đơn thuốc bác sĩ kê:**
   - Bấm **"Tạo hóa đơn & Mã QR"** trên đơn đang chờ thanh toán.
   - Mặc định các thuốc trong đơn kê được tích chọn sẵn. Nếu khách không lấy 1 loại thuốc hoặc giảm số lượng, dược sĩ bỏ tích / chỉnh lại số lượng $\rightarrow$ hệ thống tự động **hoàn lại tồn kho phần thuốc không lấy** và tính lại tổng tiền $\rightarrow$ hiển thị **Mã QR thanh toán** $\rightarrow$ bấm **"Hoàn tất & Đóng"**.
3. **Bán thuốc trực tiếp cho khách vãng lai:**
   - Bấm nút **`+ Tạo hóa đơn`** ở góc phải trên cùng $\rightarrow$ có thể tìm theo SĐT khách hàng (không bắt buộc) hoặc nhập tên khách + chọn loài thú cưng $\rightarrow$ chọn các loại thuốc từ kho dược và số lượng mua $\rightarrow$ tạo mã QR thanh toán và trừ tồn kho tự động.
4. Sang tab **Kho thuốc** để kiểm tra số lượng tồn kho thực tế và xem **Lịch sử biến động tồn kho** (`Stock_Movements`) của từng loại thuốc.

---

## ❓ 5. Xử Lý Sự Cố Thường Gặp (Troubleshooting)

| Vấn đề | Nguyên nhân | Cách khắc phục |
| :--- | :--- | :--- |
| **`ER_ACCESS_DENIED_ERROR` khi chạy Backend** | Sai `DB_USER` hoặc `DB_PASS` trong `backend/.env` | Kiểm tra lại mật khẩu `root` của MySQL trong file `backend/.env`. |
| **Frontend báo `Network Error`** | Backend chưa bật hoặc khác cổng | Đảm bảo Backend đang chạy ở cổng `5000` (`http://localhost:5000/health`). |
| **Chat AI báo lỗi cấu hình API Key** | Chưa điền hoặc sai `GEMINI_API_KEY` | Kiểm tra biến `GEMINI_API_KEY` trong `backend/.env` và khởi động lại Backend. |
| **Không tìm thấy SĐT khách hàng ở form vãng lai** | Tài khoản khách hàng chưa cập nhật SĐT | Đăng nhập tài khoản khách hàng $\rightarrow$ vào tab **Tài khoản** $\rightarrow$ bấm **Cập Nhật Thông Tin & SĐT** để lưu số điện thoại. |
