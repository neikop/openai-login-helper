# OpenAI Login Helper

Extension Manifest V3 cho Brave/Chromium với UI React + TypeScript, build bằng Vite.

- Tự hiện bảng chọn tài khoản khi mở trang đăng nhập trên `auth.openai.com`.
- Chọn tài khoản đã lưu → **Start** → tự điền email, mật khẩu, mã TOTP và bấm tiếp tục.
- Thêm, sửa, xóa, tìm kiếm và kéo thả sắp xếp tài khoản.
- Bảng trong trang có nút **Thêm** để tạo tài khoản ngay tại chỗ, nút thu gọn và nút **Quản lý tài khoản** ở footer mở màn hình quản lý riêng. Popup trên thanh công cụ cũng quản lý được tài khoản.

## Workflow phát triển

Cần Node.js 20.19+.

```sh
git clone https://github.com/neikop/openai-login-helper.git
cd openai-login-helper
npm ci
npm run dev
```

| Lệnh | Chức năng |
| --- | --- |
| `npm run dev` | Build lần đầu, sau đó theo dõi UI và mã extension, cập nhật `dist/` |
| `npm run typecheck` | Kiểm tra TypeScript của UI |
| `npm run check` | TypeScript và cú pháp JavaScript của extension |
| `npm run build` | Kiểm tra và build bản dùng được vào `dist/` |
| `npm run pack` | Build rồi tạo `artifacts/openai-login-helper-2.0.0.zip` |

`dev` build file để trình duyệt nạp; không chạy web server/HMR. Sau khi sửa, bấm **Reload** extension rồi tải lại tab đăng nhập. Nếu thêm dependency, chạy lại `npm install`. Dùng `npm ci` khi cài theo lockfile trên máy mới.

## Cài hoặc cập nhật extension

1. Chạy `npm run build`.
2. Mở `brave://extensions` hoặc `chrome://extensions`, bật **Developer mode**.
3. **Load unpacked** → chọn `dist/` trong thư mục repo.
4. Nếu đang dùng bản v1 nạp từ thư mục gốc, gỡ bản đó rồi nạp `dist/`. Những lần sau chỉ cần Reload.
5. Ghim biểu tượng extension. Mở popup để **Thêm** tài khoản.
6. Vào `https://auth.openai.com/log-in`: bảng chọn tự hiện ở góc phải. Chọn tài khoản → **Start**.

Nếu dùng file ZIP, giải nén và Load unpacked thư mục `openai-login-helper` bên trong ZIP; không cần npm.

Start chỉ bật khi tab đang chọn là `https://auth.openai.com/log-in` hoặc `https://auth.openai.com/log-in-or-create-account` và extension nhận diện được form nhập email. Ở trang khác, bước mật khẩu/MFA hoặc trang quản lý tài khoản, Start bị khóa; extension không tự mở tab đăng nhập mới. Mỗi lần chọn tài khoản bắt đầu từ bước email để tránh điền mật khẩu vào phiên của tài khoản khác. Nếu bảng không xuất hiện, dùng popup trên thanh công cụ.

## Nhập tài khoản

Form có các ô Email, Mật khẩu, Key MFA và Tên gợi nhớ (tùy chọn). Dán cả tài khoản vào ô Email, phân cách bằng dấu cách, tab hoặc xuống dòng để tự điền. Email, mật khẩu và key MFA là bắt buộc; chỉ tên gợi nhớ là tùy chọn. Space hoặc Enter ở ô Email/Mật khẩu chuyển sang ô tiếp theo. Bấm **Lưu tài khoản** sau khi kiểm tra thông tin.

## Dữ liệu và cách chạy

- Tài khoản được lưu lâu dài trong `chrome.storage.local` của profile trình duyệt, không đồng bộ đám mây. Mật khẩu và khóa 2FA chưa được mã hóa bằng mật khẩu riêng. Xóa trong UI hoặc gỡ extension sẽ xóa bản lưu trong extension.
- Content script không được truy cập trực tiếp kho tài khoản. Bảng nhúng thuộc origin của extension, trang OpenAI không đọc được nội dung bên trong. Chỉ đưa email, mật khẩu hoặc mã TOTP cần thiết vào form khi bạn bấm Start; không đưa khóa 2FA vào trang.
- Một phiên tự động chạy tại một thời điểm, trên đúng tab đã chọn. Dữ liệu phiên tạm được xóa khi Dừng, đóng tab, rời tên miền xác thực, gặp lỗi hoặc hết 5 phút; danh sách tài khoản đã lưu vẫn còn.
- Sửa hoặc xóa tài khoản đang chạy sẽ dừng phiên để không tiếp tục dùng dữ liệu cũ.
- Mỗi bước gửi tối đa một lần. Dừng không thu hồi yêu cầu đã gửi. Không tự thử lại mật khẩu/mã sai.
- CAPTCHA, mã email/SMS, passkey và đăng nhập Google/Apple/Microsoft cần thao tác thủ công. Mã TOTP được tạo ngay trên máy; đồng hồ máy cần đúng giờ.
- Luồng gồm đúng Email → Password → One-time code; mỗi bước chỉ bấm Continue. Ngay sau khi bấm Continue ở bước One-time code, phiên tự kết thúc, xóa dữ liệu tạm và giữ trạng thái **Thinking…** thêm 3 giây trước khi đóng bảng chọn/popup. Không chờ phản hồi hoặc màn tiếp theo. Không tự bấm ở màn tiếp theo. Kết thúc tự điền không khẳng định ứng dụng đích đã đăng nhập xong.

## Source

- `src/ui/`: giao diện React + TypeScript dùng chung cho popup, bảng chọn và trang quản lý.
- `src/extension/`: service worker, lưu tài khoản, điền form và TOTP.
- `public/manifest.json`: quyền và cấu hình extension.
- `scripts/`: build phần nền/content script, watch và đóng gói ZIP.

Đã kiểm tra TypeScript/build và xác minh trên Brave luồng email → mật khẩu → MFA tự động chuyển tới màn cấp quyền Codex. Chưa bấm Continue cấp quyền, chưa kiểm tra đầy đủ thêm/sửa/xóa tài khoản hoặc mọi biến thể đăng nhập. Xem `VERIFICATION.md`. Giao diện OpenAI có thể thay đổi nên selector có thể cần điều chỉnh từ màn hình thực tế.

Tiện ích độc lập, không liên kết với OpenAI.
