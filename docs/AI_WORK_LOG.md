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

## 2026-06-01 - Owner no-login-form requirement clarification

- Mục tiêu: bổ sung quy tắc bắt buộc rằng owner `hr@longthaisteel.com` phải vào thẳng dashboard khi đã có Firebase Auth session hợp lệ, tuyệt đối không nhìn thấy OTP form.
- File sửa:
  - `docs/AI_PROJECT_KNOWLEDGE.md`
  - `docs/AUTH_AUTO_LOGIN_HR_ACCOUNT.md`
  - `docs/AI_WORK_LOG.md`
  - `docs/IMPLEMENTATION_REPORT_20260601.md`
- Lý do sửa:
  - Yêu cầu sản phẩm cần phân biệt rõ owner auto-login với login OTP của tài khoản khác.
  - Cần ghi rõ ranh giới bảo mật: website không thể đọc im lặng Gmail account của Chrome nếu app chưa có Firebase Auth session.
- Kết quả:
  - Xác nhận code hiện tại đã render splash trước; `showLoginFlow_()` chỉ chạy sau khi `validateStoredSession_()` và `tryFirebaseAutoLogin_()` đều thất bại.
  - Ghi rõ owner không qua OTP form nếu Firebase Auth current user/token hợp lệ.
  - Thử kết nối Chrome profile thật để kiểm tra end-to-end nhưng Codex Chrome Extension chưa được cài trong profile hiện tại.
  - Thêm helper editor-only `authorizeFirebaseAutoLogin()` để owner chạy một lần và cấp scope `script.external_request`; helper chỉ probe token giả, không cấp session và không bypass auth.
- Rủi ro:
  - Auto-login owner live vẫn cần Apps Script owner re-authorize `script.external_request`.
  - Chưa thể test session owner thật từ Chrome profile hiện tại cho đến khi có browser profile chứa Firebase Auth session và công cụ kiểm thử truy cập được profile đó.

## 2026-06-01 - RCA Firebase Auth and deploy source audit

- Mục tiêu: điều tra nguyên nhân gốc auto-login owner thất bại, rà source trùng lặp và chuẩn hóa deploy flow.
- File sửa:
  - `public/index.html`
  - `gas-upload/index.html`
  - `deploy-all.ps1`
  - `docs/PROJECT_FILE_AUDIT.md`
  - `docs/DEPLOY_ARCHITECTURE.md`
  - `docs/AI_PROJECT_KNOWLEDGE.md`
  - `docs/AUTH_AUTO_LOGIN_HR_ACCOUNT.md`
  - `docs/AI_WORK_LOG.md`
- RCA auth:
  - Owner đã authorize Apps Script scope mới; live token giả chuyển đúng sang `FIREBASE_TOKEN_INVALID`.
  - Bootstrap splash/login/router đúng thứ tự, không có login flash trước redirect.
  - Firebase Identity Toolkit public và admin API đều trả `CONFIGURATION_NOT_FOUND`: Firebase Authentication chưa được khởi tạo cho project.
  - Source chưa có Google Sign-In/One Tap để tạo Firebase session lần đầu; chỉ có restore `currentUser/onAuthStateChanged`.
- Sửa code:
  - Đặt Firebase Auth persistence `LOCAL` rõ ràng.
  - Logout đồng thời xóa GAS session và gọi `firebase.auth().signOut()`.
  - Chuẩn hóa root `appsscript.json` là source manifest; deploy copy manifest sang `gas-upload/`.
  - Sửa `Sync-GasWorkspace` để hai cờ copy root GAS và public HTML hoạt động độc lập.
- Audit:
  - `gas-upload/` là output deploy sinh ra.
  - Root `.gs`, root `appsscript.json`, `public/` là source chính thức.
  - Root HTML/JS cũ, root `.clasp.json`, `Code (1).gs`, `deploy.bat` là legacy/nghi ngờ dư; chưa xóa.
- Rủi ro:
  - Firebase Console Authentication **Get started** đã hoàn tất; còn phải bật và Save Google provider.
  - Chưa thể kết luận owner auto-login PASS trước khi có Firebase Auth session owner thật.

## 2026-06-01 10:32 +07:00 - Enable Google provider and add GIS owner auto-select

- Mục tiêu: hoàn thiện nhánh owner auto-login khi browser đã có Google session owner nhưng Firebase chưa restore được `currentUser`.
- File sửa:
  - `public/index.html`
  - `gas-upload/index.html` (output do deploy sinh lại)
  - `docs/AUTH_AUTO_LOGIN_HR_ACCOUNT.md`
  - `docs/AI_PROJECT_KNOWLEDGE.md`
  - `docs/AI_WORK_LOG.md`
  - `docs/DEPLOY_ARCHITECTURE.md`
  - `docs/IMPLEMENTATION_REPORT_20260601.md`
- RCA:
  - Firebase Authentication ban đầu chưa khởi tạo nên public API trả `CONFIGURATION_NOT_FOUND`.
  - Sau **Get started**, Google provider vẫn thiếu cho đến khi Save provider với support email/OAuth config.
  - Source cũ chỉ restore Firebase `currentUser/onAuthStateChanged`; không có Google Sign-In/One Tap nên browser Google session đơn thuần không thể tạo Firebase session.
- Sửa code:
  - Xác nhận Google provider `enabled: true` và public `accounts:createAuthUri` trả OAuth URL hợp lệ.
  - Nhúng OAuth client id công khai vào `window.APP_CONFIG.firebaseGoogleClientId`.
  - Thêm GIS `auto_select` + FedCM, đổi Google credential thành Firebase credential bằng `signInWithCredential()`, rồi giữ nguyên GAS `loginWithFirebase` làm boundary cấp session.
  - Client bỏ qua credential không thuộc owner trước khi lưu Firebase persistence; GAS vẫn xác minh Firebase token/provider/email whitelist.
  - Logout gọi thêm GIS `disableAutoSelect()`.
- Deploy:
  - `deploy-all.ps1` PASS.
  - Firebase Hosting build `260601_1032`.
  - GAS deployment version `55`.
- Test tự động:
  - Public Auth config và Google provider: PASS.
  - Syntax HTML source/deploy, parity `public/index.html` = `gas-upload/index.html`, UTF-8 live: PASS.
  - Live `getAuthConfig`: PASS; protected API không session trả `AUTH_REQUIRED`; Firebase token giả trả `FIREBASE_TOKEN_INVALID`.
  - Browser sạch: splash xuất hiện trước; chỉ sau restore/GIS fallback mới render OTP form.
  - Progressive UX live: Email -> Mã bí mật -> Captcha; `Gửi mã OTP` chỉ xuất hiện sau captcha hợp lệ.
- Rủi ro:
  - End-to-end owner trên Chrome profile thật cần người dùng xác nhận vì profile Chrome hiện không có Codex Chrome Extension để automation truy cập cookie/session.
  - GIS auto-select không bypass Google consent và còn phụ thuộc chính sách FedCM của browser.

## 2026-06-01 11:02 +07:00 - Standardize GAS and Firebase deploy directories

- Mục tiêu: loại bỏ nguy cơ deploy GAS/Firebase nhầm thư mục và chỉ giữ một entrypoint deploy chính thức.
- File sửa:
  - `deploy.bat`
  - `deploy-all.bat`
  - `deploy-all.ps1`
  - `.clasp.json` root (xóa legacy config)
  - `docs/DEPLOY_ARCHITECTURE.md`
  - `docs/README_DEPLOY.md`
  - `docs/PROJECT_FILE_AUDIT.md`
  - `docs/AI_PROJECT_KNOWLEDGE.md`
  - `docs/AI_WORK_LOG.md`
- RCA:
  - `deploy.bat` cũ vẫn `cd /d D:\HanhChinh-NhanSu`, gọi `inject-version.js` không tồn tại và deploy Firebase theo flow riêng.
  - Root `.clasp.json` cũ trỏ script GAS khác, tạo nguy cơ chạy nhầm `clasp push` tại root.
  - Một nhóm source root bị di chuyển vào `New folder/`; đã đưa trở lại root để deploy script có source-of-truth đúng.
  - `deploy-all.bat --no-pause` dùng `shift` nhưng vẫn truyền `%*` cũ xuống PowerShell, làm PowerShell nhận cờ không tồn tại `-no-pause`.
- Sửa:
  - `deploy.bat` chỉ còn là wrapper deprecated chuyển tiếp sang `deploy-all.bat`.
  - `deploy-all.bat` parse và loại `--no-pause` trước khi gọi PowerShell.
  - Xóa root `.clasp.json` legacy.
  - `deploy-all.ps1` guard đường dẫn tuyệt đối: GAS phải đúng `gas-upload/`, Firebase `hosting.public` phải đúng `public`.
  - Log deploy in rõ root project, GAS workspace, clasp working directory, Firebase config và Firebase public directory.
- Test:
  - Chạy `deploy-all.bat --no-pause`: PASS.
  - Config tạm cố trỏ GAS deploy về root: PASS theo bảo mật, script dừng với `Unsafe GAS deploy directory`.
  - Chạy `deploy.bat --no-pause -DefinitelyInvalid`: PASS theo vai trò wrapper, log in cảnh báo deprecated rồi lỗi đến từ `deploy-all.ps1`; không còn flow Firebase riêng.
  - Log clasp: `D:\CODE\HanhChinh-NhanSu\gas-upload`.
  - Log Firebase: `D:\CODE\HanhChinh-NhanSu\public`; Firebase CLI xác nhận `found 14 files in public`.
  - GAS deployment version `57`, Firebase Hosting build `260601_1102`.
- Rủi ro:
  - Root HTML/JS legacy còn giữ lại để audit; không được dùng làm source frontend.
- Owner auto-login Chrome profile thật vẫn cần xác nhận tương tác sau deploy.

## 2026-06-01 - Migrate Firebase Hosting/Auth config to `hcns-lt`

- Mục tiêu: chuyển frontend Firebase Hosting/Auth từ project cũ sang project mới `hcns-lt`, giữ GAS deploy riêng tại `gas-upload/`.
- Sửa:
  - Đổi `.firebaserc` và `deploy.config.psd1` sang `hcns-lt`.
  - Giữ nguyên `firebase.json` với `hosting.public = "public"`.
  - Đổi toàn bộ Firebase Web config trong `public/index.html` và mirror `gas-upload/index.html`.
  - Đổi fallback `FIREBASE_API_KEY_DEFAULT` trong `gas-upload/code.gs` sang API key Web App mới.
  - Gỡ OAuth client id GIS của project cũ khỏi frontend để không gây `origin_mismatch` trên domain mới.
  - Sau khi Google provider của `hcns-lt` được Save, nhúng OAuth client id GIS mới `904438352439-m8706ivb3np83jgj5n06846lobgrgl8a.apps.googleusercontent.com`.
- Kiểm tra:
  - Firebase Auth public config của `hcns-lt` trả authorized domains `localhost`, `hcns-lt.firebaseapp.com`, `hcns-lt.web.app`.
  - Public `accounts:createAuthUri` của `hcns-lt` ban đầu trả `OPERATION_NOT_ALLOWED`; sau khi provider được Save, API trả `providerId = google.com` và OAuth URL hợp lệ.
  - Firebase CLI ban đầu chỉ đăng nhập account cũ; sau đó đã chạy `firebase login:add hr@longthaisteel.com` và chọn owner bằng `firebase login:use hr@longthaisteel.com`.
  - Runtime source không còn config Firebase cũ ngoài ghi chép lịch sử trong docs.
  - `public/index.html` vẫn dùng CDN compat; không thêm bare import `firebase/app`.
  - Static smoke local: frontend tải được, browser sạch rơi về OTP fallback, console không có warning/error.
  - GAS được push/deploy riêng từ `gas-upload/` lên version `59`; token Firebase giả trả `FIREBASE_TOKEN_INVALID`, protected API không session trả `AUTH_REQUIRED`.
  - Local browser smoke với OAuth client id mới không có log `origin_mismatch`; browser sạch chỉ rơi về OTP fallback khi FedCM không có token owner.
  - `firebase deploy --only hosting --project hcns-lt` PASS; CLI xác nhận deploy tới `hcns-lt`, `found 14 files in public`, release complete.
  - Live `https://hcns-lt.web.app` trả `200`, chứa config project mới, không chứa project cũ.
  - Live browser smoke sạch không có log `origin_mismatch`; không có token owner nên rơi về OTP fallback đúng thiết kế.
  - Chrome profile thật đang chạy nhưng thiếu Codex Chrome Extension, nên automation chưa thể truy cập session owner để chứng minh auto-login end-to-end.
- Blocker:
  - Chưa được kết luận owner auto-login end-to-end PASS trước khi test bằng Chrome profile thật có Firebase Auth session `hr@longthaisteel.com`.

## 2026-06-01 15:44 +07:00 - Fix owner auth event without F5

- Mục tiêu: sau khi owner chọn Google account từ browser prompt, app phải vào Dashboard ngay, không cần F5.
- RCA:
  - `googleIdentity.prompt()` cũ coi notification `displayed` là thất bại và gọi `finish(false)` quá sớm.
  - Callback credential cũ bỏ qua credential nếu promise đã `settled`.
  - Listener `onAuthStateChanged` dùng restore ban đầu tự unsubscribe sau lần đầu, không theo dõi auth event phát sinh khi login form đã hiện.
- Sửa frontend:
  - Thêm `handleAuthenticatedUser_()` làm điểm xử lý owner tập trung: Firebase user -> ID token -> GAS `loginWithFirebase` -> persist session -> Dashboard.
  - Bind `onAuthStateChanged` lâu dài sau khi Firebase Auth ready.
  - Sau `signInWithCredential()` gọi ngay handler tập trung.
  - Không settle GIS flow khi prompt chỉ `displayed`; credential đến muộn vẫn được xử lý.
  - Thêm guard `appAuthenticated` và promise exchange dùng chung để tránh login form ghi đè Dashboard hoặc gọi backend trùng.
  - Logout tải partial login trước khi hiện lại form, phù hợp trường hợp owner vào Dashboard trực tiếp.
- File sửa:
  - `public/index.html`
  - `gas-upload/index.html`
  - `docs/AI_PROJECT_KNOWLEDGE.md`
  - `docs/DEPLOY_ARCHITECTURE.md`
  - `docs/AI_WORK_LOG.md`
- Deploy:
  - GAS push/deploy chạy từ `gas-upload/`: PASS, deployment version `60`.
  - `firebase deploy --only hosting --project hcns-lt`: PASS, Hosting release complete từ `public/`.
- Test tự động sau deploy:
  - Live Hosting trả `200`, chứa build `260601_1544`, config `hcns-lt`, handler tập trung và listener auth dài hạn.
  - Live GAS `getPage("index")` chứa build `260601_1544` và handler mới.
  - Probe cấu trúc: persistent `onAuthStateChanged`, `signInWithCredential()` gọi handler, prompt `displayed` không bị coi là lỗi, credential muộn không bị bỏ qua, login view có guard sau auth: PASS.
  - Browser smoke sạch: fallback OTP vẫn hoạt động, không có `origin_mismatch`.
  - GAS token giả trả `FIREBASE_TOKEN_INVALID`; protected API không session trả `AUTH_REQUIRED`.
- Blocker xác nhận cuối:
  - Chrome profile thật hiện thiếu Codex Chrome Extension nên automation chưa thể thực hiện thao tác chọn owner account và xác nhận Dashboard xuất hiện ngay.
  - Chỉ kết luận COMPLETED sau khi thao tác owner thật xác nhận không cần F5.
