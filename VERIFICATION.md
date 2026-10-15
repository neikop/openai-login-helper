# Trạng thái kiểm tra

## v2 — React + TypeScript và quản lý tài khoản

- Kiểm tra TypeScript UI và cú pháp JavaScript qua `npm run check`.
- Build UI và mã extension qua `npm run build`; ZIP tạo qua `npm run pack`.
- Ngày 15/10/2026, theo yêu cầu kiểm tra lỗi trên Brave: quan sát trang MFA thật và sửa việc chỉ đọc nội dung trong form, bỏ sót tiêu đề bên ngoài.
- Đã build, Reload extension và chạy lại trên Brave: email → mật khẩu → tự điền/gửi mã MFA → chuyển tới trang `sign-in-with-chatgpt/codex/consent`. Không bấm Continue cấp quyền; đã dừng phiên tự động và xác nhận dữ liệu phiên tạm được xóa qua trạng thái UI.
- Chưa kiểm tra đầy đủ thêm/sửa/xóa tài khoản trên trình duyệt hoặc mọi biến thể đăng nhập.

## Kết quả trước đó của TOTP v1 (mã thuật toán giữ nguyên)

- SHA-1 khớp 6 bộ giá trị thời gian chuẩn RFC 6238.
- Từ chối khóa sai định dạng, HOTP và số chữ số không hỗ trợ.
- Lần đọc trực tiếp URL đăng nhập trả về HTTP 403, chưa xác minh toàn bộ selector trên giao diện OpenAI thật.

## Luồng 3 bước và kết thúc phiên

- TypeScript/build đạt. Kiểm tra mô phỏng phần nền đạt: thứ tự email/password/code, chống gửi trùng, không hoàn tất trước khi gửi code, kết thúc và xóa dữ liệu tạm khi chuyển màn hoặc rời domain sau code.
- Chưa chạy lại đăng nhập thật sau thay đổi luồng này; kết quả Brave ở trên thuộc phiên bản trước.

## Kết thúc ngay sau Continue

- Mô phỏng phần nền đạt: chỉ hoàn tất sau tín hiệu gửi code, xóa phiên ngay, gửi yêu cầu thu gọn bảng chọn, giữ trạng thái đóng sau chuyển trang và xử lý navigation trước khi nhận COMPLETE.
- TypeScript/build đạt. Chưa chạy lại đăng nhập thật hoặc kiểm tra trực quan animation cho thay đổi này.

## Cập nhật giao diện và thời gian đóng popup

- TypeScript, kiểm tra cú pháp và build thành công sau các cập nhật UI.
- Đã kiểm tra mô phỏng: giữ trạng thái gửi OTP sau Continue, xóa phiên ngay, notice và lịch đóng dùng chung mốc 3 giây, polling không đặt lại thời gian đóng.
- Luồng đăng nhập hiện hiển thị `Thinking…`. Chưa kiểm tra lại trên Brave cho các thay đổi UI, kéo thả và thời gian đóng mới nhất.
