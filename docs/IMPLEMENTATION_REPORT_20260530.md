# Implementation Report - 2026-05-30

## 1. Các vấn đề đã phát hiện

- Frontend Firebase Hosting chưa có Firebase Web App config rõ ràng, nên không có nền tảng để khôi phục Firebase Auth `currentUser`.
- Login form hiển thị quá nhiều trường cùng lúc và nút hành động xuất hiện sớm.
- GAS cần xác thực Firebase ID token nhưng runtime chưa được cấp quyền `UrlFetchApp.fetch`.
- Deploy script lỗi trong runtime hiện tại khi `$PSScriptRoot` rỗng.
- `deploy.config.psd1` dùng clasp profile `gas-hr` chưa login, trong khi default profile đang login đúng `hr@longthaisteel.com`.
- File HTML từng bị mojibake do thao tác PowerShell không giữ UTF-8.

## 2. Root cause

- Auto-login owner không thể hoạt động nếu frontend không khởi tạo Firebase Auth và backend không đổi Firebase ID token thành GAS session.
- Browser không cho website đọc im lặng tài khoản Google chỉ vì người dùng đang đăng nhập Google; app chỉ có thể auto-login khi đã có Firebase Auth session hợp lệ cho chính app.
- Apps Script deploy qua clasp không tự hoàn tất OAuth consent cho scope mới. Manifest đã có `script.external_request`, nhưng owner phải re-authorize để web app runtime được dùng `UrlFetchApp.fetch`.

## 3. Cách sửa

- Tạo Firebase Web App `HanhChinh-NhanSu Web` trong project `hanhchinh-nhansu` và nhúng config vào `window.APP_CONFIG.firebaseConfig`.
- Thêm luồng `AuthApp.init()` theo thứ tự: kiểm tra GAS session cũ, chờ Firebase Auth state, nếu owner hợp lệ thì gọi `loginWithFirebase`, cuối cùng mới hiện OTP login.
- Thêm/giữ backend `loginWithFirebase` để xác thực Firebase ID token qua Google Identity Toolkit, kiểm tra email verified, provider Google và whitelist owner trước khi cấp GAS session.
- Cập nhật login UI theo progressive disclosure: email -> mã bí mật -> captcha -> gửi OTP -> OTP -> đăng nhập.
- Bổ sung OAuth scopes trong manifest cho UrlFetch/MailApp/Drive/Sheets.
- Sửa deploy script/config để chạy được bằng runtime hiện tại và đúng clasp profile.

## 4. File đã sửa

- `code.gs`
- `gas-upload/code.gs`
- `appsscript.json`
- `gas-upload/appsscript.json`
- `public/index.html`
- `gas-upload/index.html`
- `public/login.html`
- `gas-upload/login.html`
- `deploy-all.ps1`
- `deploy.config.psd1`
- `docs/AI_PROJECT_KNOWLEDGE.md`
- `docs/AI_WORK_LOG.md`
- `docs/AUTH_AUTO_LOGIN_HR_ACCOUNT.md`
- `docs/IMPLEMENTATION_REPORT_20260530.md`

## 5. Các test đã chạy

- `node` parse inline script của `public/index.html` và `gas-upload/index.html`: PASS.
- `node --check` cho bản tạm `.js` của `code.gs` và `gas-upload/code.gs`: PASS.
- Kiểm tra manifest root và `gas-upload`: có đủ OAuth scopes cần thiết.
- `clasp -P gas-upload push`: PASS.
- `clasp -P gas-upload deploy -i AKfycbxCWUHr-33sTja9_mOE1r0-wDEfQ2iHnMiEerja0gujBicQpI82uWRbsMpDMk-b6oNw0g`: PASS.
- `firebase deploy --only hosting --project hanhchinh-nhansu`: PASS.
- `powershell -ExecutionPolicy Bypass -File deploy-all.ps1`: PASS, build `260530_1127`, GAS @48, Firebase Hosting deploy complete.
- Live Firebase HTML: status 200, UTF-8 hợp lệ, có `firebaseConfig`, `syncProgressiveLogin_`, `loginWithFirebase`.
- Live GAS `getAuthConfig`: PASS, trả captcha/config ready.
- Live GAS `getEmployees` không session: PASS theo bảo mật, trả `AUTH_REQUIRED`.
- Browser smoke live login UX: PASS, ban đầu chỉ hiện email; nhập email mới hiện mã bí mật; nhập mã mới hiện captcha; nút hành động chưa hiện quá sớm.
- Live GAS `loginWithFirebase` với token giả: BLOCKED bởi OAuth runtime, trả lỗi thiếu quyền `UrlFetchApp.fetch`.

## 6. Kết quả test

- Build/syntax/deploy: PASS.
- OTP/captcha public config: PASS ở mức `getAuthConfig`.
- Protected API vẫn được chặn bởi session: PASS.
- Progressive login UX: PASS.
- Auto-login owner end-to-end: CHƯA PASS do Apps Script owner chưa authorize scope `script.external_request`.

## 7. Rủi ro còn lại

- Cần owner `hr@longthaisteel.com` re-authorize Apps Script scopes mới. Sau bước này phải test lại `loginWithFirebase` với token giả và Firebase Auth session thật.
- Cần xác nhận Google provider trong Firebase Authentication Console đang bật.
- Không thể chứng minh owner auto-login bằng trình duyệt không có sẵn Firebase Auth session của `hr@longthaisteel.com`.
- `clasp run` hiện không dùng được vì deployment API executable trả `Script function not found`; kiểm thử live đang dựa vào Web App endpoint.

## 8. Đề xuất bước tiếp theo

1. Owner mở Apps Script project của deployment, chạy một hàm bất kỳ cần authorization hoặc mở authorization prompt để cấp scope mới.
2. Test lại `loginWithFirebase` với token giả; kết quả đúng phải là `FIREBASE_TOKEN_INVALID`.
3. Dùng Chrome đã có Firebase Auth session của `hr@longthaisteel.com` mở Firebase Hosting và xác nhận vào thẳng dashboard.
4. Test tài khoản Google khác, chưa đăng nhập, logout, refresh dashboard và đóng/mở lại trình duyệt.
