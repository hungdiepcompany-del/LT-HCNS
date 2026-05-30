# AI Work Log - HanhChinh-NhanSu

Ghi theo dạng changelog để AI/engineer sau này hiểu lịch sử thay đổi trước khi tiếp tục.

## 2026-05-30 10:50 +07:00 - Auto-login owner, progressive login UX, AI handbook

- Mục tiêu: hoàn thiện auto-login cho owner `hr@longthaisteel.com`, cải thiện UX login theo progressive disclosure, tạo tài liệu bàn giao AI và kiểm tra hệ thống.
- File sửa:
  - `code.gs`
  - `gas-upload/code.gs`
  - `public/index.html`
  - `gas-upload/index.html`
  - `public/login.html`
  - `gas-upload/login.html`
  - `docs/AUTH_AUTO_LOGIN_HR_ACCOUNT.md`
  - `docs/AI_PROJECT_KNOWLEDGE.md`
  - `docs/AI_WORK_LOG.md`
- Lý do sửa:
  - Frontend trước đó không có Firebase Auth Web App/config nên không thể khôi phục `currentUser`.
  - GAS chưa có API đổi Firebase ID token đã xác thực thành session nội bộ.
  - Login form hiển thị tất cả trường cùng lúc, tạo cảm giác nặng và cho phép nút hành động xuất hiện quá sớm.
  - Project thiếu handbook đủ chi tiết cho AI tiếp quản.
- Kết quả:
  - Tạo Firebase Web App `HanhChinh-NhanSu Web` trong project `hanhchinh-nhansu`.
  - Nhúng Firebase Web SDK config vào `window.APP_CONFIG.firebaseConfig`.
  - Thêm/giữ `loginWithFirebase` trên GAS để xác thực ID token bằng Google Identity Toolkit trước khi cấp session.
  - Login UX chuyển sang từng bước: email -> mã bí mật -> captcha -> gửi OTP -> OTP -> đăng nhập.
  - Khôi phục encoding UTF-8 cho `public/index.html` và `gas-upload/index.html` từ live build, tránh lỗi mojibake/replacement character.
  - Tạo `AI_PROJECT_KNOWLEDGE.md` làm handbook kiến trúc.
- Rủi ro:
  - Cần Script Property `AUTH_FIREBASE_API_KEY` trên GAS deployment; nếu thiếu, auto-login Firebase sẽ fallback về OTP.
  - Firebase Authentication Google provider cần bật trong Firebase Console; CLI chưa xác nhận được provider state.
  - `clasp run`/deployment state có dấu hiệu quyền hoặc script mismatch nếu chạy từ root `.clasp.json`; cần dùng deploy script hoặc `gas-upload/.clasp.json`.
  - Trình duyệt không cho đọc Google account im lặng nếu app chưa có Firebase Auth session hợp lệ.

## 2026-05-30 11:36 +07:00 - Deploy verification and Apps Script OAuth gate

- Mục tiêu: tiếp tục phần dang dở, kiểm tra trạng thái deploy thật, xác minh frontend/GAS live và ghi lại blocker còn lại của auto-login owner.
- File sửa:
  - `appsscript.json`
  - `gas-upload/appsscript.json`
  - `deploy-all.ps1`
  - `deploy.config.psd1`
  - `docs/AI_PROJECT_KNOWLEDGE.md`
  - `docs/AI_WORK_LOG.md`
  - `docs/AUTH_AUTO_LOGIN_HR_ACCOUNT.md`
  - `docs/IMPLEMENTATION_REPORT_20260530.md`
- Lý do sửa:
  - GAS cần OAuth scope `script.external_request` để xác thực Firebase ID token qua Google Identity Toolkit.
  - Deploy script lỗi khi `$PSScriptRoot` rỗng trong runtime hiện tại.
  - Profile clasp `gas-hr` chưa login, trong khi default profile đang login đúng `hr@longthaisteel.com`.
  - Tài liệu cũ vẫn ghi `AUTH_FIREBASE_API_KEY` là bắt buộc dù code đã có default Firebase Web API key.
- Kết quả:
  - Manifest root và `gas-upload` có đủ scopes: `script.external_request`, `script.send_mail`, `script.scriptapp`, `script.container.ui`, `spreadsheets`, `drive`, `drive.file`.
  - `deploy-all.ps1` chạy pass, cập nhật build `260530_1127`, deploy GAS @48 và Firebase Hosting thành công.
  - Live Firebase Hosting trả HTML UTF-8 hợp lệ, có `firebaseConfig`, `syncProgressiveLogin_`, `loginWithFirebase`.
  - Live GAS `getAuthConfig` trả OK/captcha; `getEmployees` không session vẫn trả `AUTH_REQUIRED`.
  - Live `loginWithFirebase` với token giả vẫn bị Apps Script chặn vì owner chưa authorize scope mới `script.external_request`.
- Rủi ro:
  - Chưa thể kết luận auto-login owner PASS cho đến khi owner `hr@longthaisteel.com` re-authorize Apps Script scopes và test bằng Firebase Auth session thật.
  - Firebase Authentication Google provider vẫn cần xác nhận trong Firebase Console bằng phiên người có quyền quản trị.
