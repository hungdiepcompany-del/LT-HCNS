# Implementation Report - 2026-06-01

## 1. Yêu cầu bổ sung

Owner `hr@longthaisteel.com` phải vào thẳng dashboard khi trình duyệt đã có Firebase Auth session hợp lệ của chính ứng dụng. Owner không được thấy OTP form, không nhập thêm thông tin và không bấm xác nhận lại.

## 2. Kiểm tra code hiện tại

Luồng frontend trong `public/index.html` và `gas-upload/index.html` đã đúng thứ tự:

1. `AuthApp.init()` gọi `renderBootState_()` để chỉ hiển thị splash.
2. `validateStoredSession_()` kiểm tra GAS session token cũ với backend.
3. Nếu chưa có GAS session hợp lệ, `tryFirebaseAutoLogin_()` chờ Firebase Auth `currentUser/onAuthStateChanged`.
4. Nếu email là `hr@longthaisteel.com`, frontend lấy ID token và tự động gọi GAS `loginWithFirebase`.
5. Nếu chưa có Firebase `currentUser`, frontend thử GIS `auto_select`, đổi Google credential owner thành Firebase credential qua `signInWithCredential()`, rồi gọi GAS `loginWithFirebase`.
6. Chỉ khi cả GAS restore, Firebase restore và GIS auto-select đều không thành công, `showLoginFlow_()` mới tải partial `login.html`.

Kết luận: code không render login form rồi mới redirect owner; form login chỉ dành cho fallback.

## 3. Ranh giới kỹ thuật

Website không thể đọc im lặng tài khoản Gmail đang đăng nhập trong Chrome chỉ dựa trên cookie Google của browser. Tín hiệu hợp lệ phải là Firebase Auth `currentUser/onAuthStateChanged` hoặc ID token hợp lệ. Đây là yêu cầu bảo mật, không phải thiếu sót UI.

Vì vậy:

- Firebase Auth session owner còn hạn: mở web -> splash ngắn trong lúc restore -> dashboard.
- Chỉ đăng nhập Gmail nhưng chưa từng có Firebase Auth session cho app: GIS auto-select có thể tạo session nếu consent trước đó còn hiệu lực và Google/FedCM cho phép; app không bypass consent bằng localStorage hoặc cookie client.

## 4. RCA và cách sửa

Owner đã re-authorize Apps Script scope `https://www.googleapis.com/auth/script.external_request`. Live `loginWithFirebase` với token giả hiện trả `FIREBASE_TOKEN_INVALID`, đúng kỳ vọng.

Firebase Authentication core đã được khởi tạo bằng Firebase Console **Get started**. Public Auth config hiện trả `200` và có Hosting authorized domains.

Google provider ban đầu chưa được Save. Admin API `defaultSupportedIdpConfigs/google.com` từng trả `404 CONFIGURATION_NOT_FOUND`; thử bật provider qua API chỉ với `enabled=true` bị từ chối `INVALID_CONFIG : client_id cannot be empty`.

Sau khi Save trên Firebase Console:

- Admin API trả Google provider `enabled: true`.
- Public `accounts:createAuthUri` trả `providerId=google.com` và OAuth URL hợp lệ.
- Frontend đã nhúng OAuth client id công khai vào `window.APP_CONFIG.firebaseGoogleClientId`.
- Frontend thêm GIS `auto_select` + FedCM -> Firebase `GoogleAuthProvider.credential()` -> `signInWithCredential()` -> GAS `loginWithFirebase`.
- Logout gọi GAS logout, Firebase `signOut()` và GIS `disableAutoSelect()`.

GAS vẫn là boundary cấp quyền. Client không cấp session bằng email localStorage và không lưu OAuth client secret.

## 5. Test đã chạy

- Kiểm tra parity `public/index.html` và `gas-upload/index.html`: PASS.
- Kiểm tra UTF-8/replacement character: PASS.
- Kiểm tra code có splash, Firebase owner check và progressive login: PASS.
- Kiểm tra cấu trúc gọi: `renderBootState_()` -> `validateStoredSession_()` -> `tryFirebaseAutoLogin_()` -> `showLoginFlow_()`: PASS.
- Live deploy chuẩn hóa: PASS, build `260601_1032`, GAS deployment @55, Firebase Hosting release complete.
- Live `loginWithFirebase` token giả: PASS theo bảo mật, trả `FIREBASE_TOKEN_INVALID`.
- Live protected API không session: PASS theo bảo mật, trả `AUTH_REQUIRED`.
- Browser smoke live: PASS, splash xuất hiện trước, login form chỉ render sau khi Firebase restore thất bại, không có console error.
- Firebase Auth public config sau **Get started**: PASS, trả `200` với Hosting authorized domains.
- Google provider config: PASS, `enabled: true`.
- Public `accounts:createAuthUri`: PASS, trả `providerId=google.com` và OAuth URL hợp lệ.
- GIS owner auto-select code path: PASS theo kiểm tra source/live; dùng Firebase credential trước khi gọi GAS.
- Progressive UX live: PASS, Email -> Mã bí mật -> Captcha; nút `Gửi mã OTP` chỉ hiện sau captcha hợp lệ.
- Thử kết nối Chrome profile đăng nhập thật: BLOCKED vì Codex Chrome Extension chưa cài trong Chrome profile hiện tại.
- Auto-login owner end-to-end live trên Chrome profile thật: ĐANG CHỜ xác nhận từ người dùng; automation không truy cập được cookie/session Chrome profile vì Codex Chrome Extension chưa cài.

## 6. Bước cần hoàn tất

1. Trên Chrome profile owner, mở Firebase Hosting và xác nhận dashboard xuất hiện trực tiếp.
2. Refresh dashboard và đóng/mở browser khi persistence `LOCAL` còn hiệu lực.
3. Logout và xác nhận app không tự auto-login lại ngay.
4. Kiểm tra Chrome chưa có Google session và Chrome dùng Google account khác đều rơi về OTP form.

Để re-authorize rõ ràng, mở Apps Script editor và chạy một lần hàm `authorizeFirebaseAutoLogin()`. Hàm này chỉ gửi token probe không hợp lệ để kích hoạt consent `script.external_request`; nó không cấp session và không bypass quyền.

## 7. Audit source/deploy

- Đã tạo `docs/PROJECT_FILE_AUDIT.md`.
- Đã tạo `docs/DEPLOY_ARCHITECTURE.md`.
- Source chính thức: root `.gs`, root `appsscript.json`, `public/`.
- `gas-upload/` là output deploy sinh ra.
- Chưa xóa file legacy/nghi ngờ dư.

## 8. Chuẩn hóa deploy directory

- `deploy-all.bat` là entrypoint deploy chính thức; gọi `deploy-all.ps1`, đọc `deploy.config.psd1`.
- GAS deploy workspace bị guard cứng là `D:\CODE\HanhChinh-NhanSu\gas-upload`.
- Firebase Hosting bị guard cứng theo `firebase.json` với `hosting.public = "public"`.
- Root `.clasp.json` legacy đã xóa để không thể vô tình push script GAS cũ từ root.
- `deploy.bat` cũ không còn flow riêng; chỉ là wrapper deprecated chuyển tiếp sang `deploy-all.bat`.
- Đã sửa parser `--no-pause` trong `deploy-all.bat`.
- Chạy `deploy-all.bat --no-pause`: PASS.
- Config tạm cố trỏ GAS deploy về root: bị chặn đúng với `Unsafe GAS deploy directory`.
- `deploy.bat` deprecated wrapper: kiểm tra chuyển tiếp PASS, không còn logic Firebase riêng.
- Log clasp xác nhận working directory `D:\CODE\HanhChinh-NhanSu\gas-upload`.
- Firebase CLI xác nhận `found 14 files in public`.
- Live Firebase Hosting nhận build `260601_1102`.
- Live GAS HTML chứa build `260601_1102` và GIS bridge; GAS deployment version `57`.
