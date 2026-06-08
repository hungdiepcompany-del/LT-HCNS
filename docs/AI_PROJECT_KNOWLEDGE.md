# AI Project Knowledge - HanhChinh-NhanSu

Last updated: 2026-06-01

## Mục đích tài liệu

Tài liệu này là handbook kiến trúc cho AI/engineer tiếp quản project `HanhChinh-NhanSu`. Đọc file này cùng `docs/AI_WORK_LOG.md` trước khi sửa code để hiểu cấu trúc, auth, API, deploy và các ràng buộc vận hành.

## Kiến trúc tổng thể

Project là một ứng dụng quản lý Hành chính - Nhân sự chạy hai bề mặt:

- Frontend chính trên Firebase Hosting, thư mục deploy là `public/`.
- Backend và bản Web App mirror trên Google Apps Script, thư mục upload là `gas-upload/`.
- GAS đọc/ghi Google Sheets, Drive và Script Properties.
- Frontend gọi GAS qua JSONP đến Apps Script Web App URL vì Firebase Hosting và GAS khác origin.
- Các file trong `public/` cần được mirror sang `gas-upload/` khi deploy để Firebase Hosting và GAS Web App hiển thị giống nhau.

## Cấu trúc thư mục

- `.firebase/`: cache deploy Firebase Hosting.
- `docs/`: tài liệu vận hành, deploy, auth, knowledge và work log.
- `public/`: frontend Firebase Hosting.
- `gas-upload/`: workspace deploy sinh ra để đưa lên Apps Script bằng `clasp`. Không sửa thủ công.
- Root `.gs`: source backend GAS chính thức.
- Root `appsscript.json`: source manifest GAS chính thức.
- Root `.html`/`.js` cũ: phần lớn là legacy; xem `docs/PROJECT_FILE_AUDIT.md`.

## File cấu hình quan trọng

- `firebase.json`: Firebase Hosting public folder là `public`, rewrite mọi route về `/index.html`.
- `.firebaserc`: project Firebase default là `hcns-lt`.
- Root `.clasp.json` legacy đã bị xóa để tránh vô tình `clasp push` từ root.
- `gas-upload/.clasp.json`: script GAS chính theo `deploy.config.psd1`.
- `appsscript.json` và `gas-upload/appsscript.json`: manifest Apps Script, web app chạy `USER_DEPLOYING`, access `ANYONE_ANONYMOUS`, có Drive advanced service và các OAuth scopes cần cho MailApp/UrlFetch/Drive/Sheets.
- `deploy.config.psd1`: nguồn cấu hình deploy chính, gồm Firebase project id, GAS script id, deployment id, web app URL, account dự kiến. Hiện dùng `ClaspUserName = 'default'` vì profile `gas-hr` chưa login, còn default đang là `hr@longthaisteel.com`.
- `deploy-all.ps1`: deploy automation chính cho Firebase + GAS. Script đã xử lý fallback khi `$PSScriptRoot` rỗng bằng `$PSCommandPath`.
- `deploy-all.bat`: lệnh deploy chính thức; gọi `deploy-all.ps1` và truyền config `deploy.config.psd1`.
- `deploy.bat`: wrapper deprecated để tương thích thao tác cũ; chỉ chuyển tiếp sang `deploy-all.bat`, không còn logic deploy riêng.
- `docs/PROJECT_FILE_AUDIT.md`: audit source-of-truth, deploy-generated, legacy và file nghi ngờ dư.
- `docs/DEPLOY_ARCHITECTURE.md`: luồng deploy chuẩn và flow không được dùng.

## Frontend

Frontend chính là `public/index.html`, một SPA tự chứa CSS và JavaScript. Các partial HTML được tải bằng `API.loadHtml(name)`.

Partial/page files:

- `public/login.html`: màn hình đăng nhập OTP progressive disclosure.
- `public/sidebar.html`: sidebar legacy/partial.
- `public/page_dashboard.html`: shell dashboard.
- `public/page_employee_list.html`: shell danh sách nhân sự.
- `public/page_employee_birth.html`: shell sinh nhật.
- `public/page_safety.html`: shell dashboard an toàn lao động.
- `public/page_feedback.html`: shell góp ý.
- `public/department.html`, `public/profile_sidebar.html`, `public/birthday_client.html`: view/phần mở rộng lịch sử.
- `public/js/api.js`, `public/css/app.css`: legacy helper/style cho một số bề mặt cũ.

Module chính trong `public/index.html`:

- `window.APP_CONFIG`: API URL, build version, Firebase Web SDK config.
- `window.API`: JSONP client gọi GAS, tự đính kèm `hrAuthSessionToken` từ localStorage.
- `window.AuthApp`: khôi phục session, auto-login Firebase owner, OTP login/logout.
- `window.AppShell`: sidebar, route hash, render page.
- `DashboardPage`: KPI/tổng quan nhân sự, sinh nhật, tìm kiếm nhân sự, modal chi tiết.
- `SafetyPage`: dashboard EHS/MES mock-backed, KPI/chart/heatmap/table/form/modal.
- `BirthdayPage`: timeline sinh nhật theo tháng.
- `EmployeeListPage`: danh sách nhân sự, filter, pagination, modal chi tiết.

Route hash nội bộ:

- `dashboard`
- `employee-list`
- `birthdays`
- `safety`
- `feedback`

## Backend GAS

Backend chính nằm ở `code.gs` và được mirror sang `gas-upload/code.gs`.

Core entrypoints:

- `doGet(e)`: xử lý JSONP API nếu có `callback` + `action`; trả HTML nếu path là public file; mặc định render index.
- `doPost(e)`: xử lý JSON API theo `{ action, data }`.
- `dispatchApiAction_(action, data)`: router API trung tâm.
- `isPublicApiAction_(action)`: whitelist API không cần session.
- `requireAuthenticatedSession_(token)`: security gate cho API không public.

GAS đọc dữ liệu chính từ spreadsheet id trong `CONFIG.SPREADSHEET_ID`, sheet nhân sự `DANH SÁCH NHÂN VIÊN`.

File GAS phụ:

- `employee.gs`: API dữ liệu nhân sự, dashboard, trend, avatar.
- `employee_birth.gs`: API sinh nhật theo tháng.
- `trigger.gs`: trigger refresh ảnh.

## API contract

Public API:

- `getPage`
- `getAuthConfig`
- `requestOtp`
- `login`
- `loginWithFirebase`
- `logout`
- `getSessionInfo`

Protected API, cần `hrAuthSessionToken` hợp lệ:

- `getOnlineUsers`
- `getEmployees`
- `getDashboardData`
- `getTrendByYear`
- `getEmployeeAvatar`
- `getEmployeesByMonth`
- `getDepartments`
- `getDepartmentList`
- `getDepartmentEmployees`
- `getSelectedDepartment`
- `getProfileVersion`
- `getCurrentProfile`
- `getEmployeeImageUrl`

Một số action chỉ dùng trong Spreadsheet UI:

- `openFullProfile`
- `openDepartmentDetail`

## Luồng đăng nhập hiện tại

Có hai lớp auth:

1. GAS session nội bộ:
   - Người dùng nhập email, mã bí mật, captcha.
   - `requestOtp` kiểm tra `AUTH_SECRET_CODE`, captcha và device lock rồi gửi OTP qua MailApp.
   - `login` kiểm tra OTP, tạo session bằng `createSessionRecord_()`.
   - Frontend lưu token vào `localStorage.hrAuthSessionToken` và user vào `localStorage.hrAuthSessionUser`.
   - Các API protected gửi token qua wrapper `__authToken`.

2. Firebase Auth owner auto-login:
   - Frontend khởi tạo Firebase Auth bằng `window.APP_CONFIG.firebaseConfig`.
   - `AuthApp.init()` luôn hiển thị trạng thái boot/checking trước, không render login page ngay.
   - Nếu GAS session cũ còn hợp lệ, vào dashboard.
   - Nếu chưa có GAS session, frontend chờ Firebase Auth state.
   - Nếu `currentUser.email` là owner `hr@longthaisteel.com`, frontend lấy Firebase ID token và gọi `loginWithFirebase`.
   - GAS xác thực ID token qua Google Identity Toolkit `accounts:lookup` bằng `AUTH_FIREBASE_API_KEY` nếu có, hoặc API key mặc định trong `AUTH_CONFIG.FIREBASE_API_KEY_DEFAULT`.
   - GAS chỉ cấp session nếu token hợp lệ, email verified, provider là Google và email nằm trong whitelist auto-login.
   - Chỉ sau khi kiểm tra session GAS và Firebase owner đều không thành công, frontend mới tải partial `login.html` và hiển thị OTP form.
   - Frontend đặt Firebase persistence là `LOCAL` để session Firebase được giữ qua đóng/mở browser.
   - Logout xóa GAS session và gọi `firebase.auth().signOut()` để owner không bị tự đăng nhập lại ngay sau logout.
   - `bindFirebaseAuthListener_()` giữ listener `onAuthStateChanged` lâu dài sau khi Firebase Auth sẵn sàng. Listener không chỉ dùng một lần lúc page load.
   - `handleAuthenticatedUser_()` là điểm xử lý tập trung: kiểm tra owner email, lấy Firebase ID token, gọi GAS `loginWithFirebase`, lưu GAS session và hiện Dashboard.
   - Sau GIS `signInWithCredential()`, frontend gọi ngay `handleAuthenticatedUser_(result.user)`; không chờ F5.
   - GIS prompt chỉ mới `displayed` không được coi là thất bại. Credential đến muộn sau trạng thái prompt/timeout vẫn được xử lý.

Không được dựa vào email trong localStorage để cấp quyền. LocalStorage chỉ lưu session token do GAS cấp.

### Quy tắc bắt buộc cho owner

- `hr@longthaisteel.com` là owner/chủ quản của GAS + Firebase.
- Khi browser đã có Firebase Auth session hợp lệ của owner, mở Firebase Hosting phải đi thẳng dashboard, không hiện login form, không OTP, không nhập thêm thông tin.
- Trong thời gian Firebase đang restore session, UI chỉ hiện splash/loading nhẹ. Không được render OTP form rồi mới ẩn.
- Tài khoản khác hoặc browser chưa có Firebase Auth session hợp lệ vẫn đi qua login OTP hiện tại.
- Trạng thái chỉ đăng nhập Gmail trong Chrome không tự động đồng nghĩa website có Firebase Auth session. Website không được đọc im lặng tài khoản Google của browser bằng localStorage, cookie hoặc biến client tự đặt.

## Script Properties cần có

Auth OTP:

- `AUTH_SECRET_CODE`
- `AUTH_CAPTCHA_SECRET`
- `AUTH_MAIL_SENDER_NAME` optional
- `AUTH_MAX_ATTEMPTS` optional
- `AUTH_ATTEMPT_WINDOW_MINUTES` optional
- `AUTH_LOCK_MINUTES` optional

Firebase auto-login:

- `AUTH_FIREBASE_API_KEY` optional override. Code hiện có `AUTH_CONFIG.FIREBASE_API_KEY_DEFAULT` trùng Firebase Web App API key công khai.
- `AUTH_FIREBASE_AUTO_LOGIN_EMAILS` optional, mặc định `hr@longthaisteel.com`

## Firebase

Firebase project hiện hành: `hcns-lt`.

Firebase Web App hiện hành:

- App display name: `HanhChinh-NhanSu Web`
- App id: `1:904438352439:web:fe377de7a75a819f304db2`
- Auth domain: `hcns-lt.firebaseapp.com`
- Project id: `hcns-lt`
- API key đang được nhúng trong frontend như Firebase Web config công khai.
- Public Auth config đã có authorized domains `localhost`, `hcns-lt.firebaseapp.com`, `hcns-lt.web.app`.
- Google provider của project mới đã được cấu hình. Frontend nhúng OAuth client id GIS mới `904438352439-m8706ivb3np83jgj5n06846lobgrgl8a.apps.googleusercontent.com`.

Lưu ý: Firebase Web API key không phải secret. GAS dùng key này để gọi Identity Toolkit `accounts:lookup`; Script Property chỉ là override vận hành, không phải boundary bảo mật.

## Phân quyền

Project hiện chưa có model role/permission theo bảng user riêng. Boundary bảo mật hiện tại là:

- Có GAS session hợp lệ thì được gọi protected API.
- Auto-login chỉ cấp GAS session cho owner email whitelist.
- Các tài khoản khác vẫn đi qua OTP flow và cùng session gate hiện tại.

Không được tắt `requireAuthenticatedSession_()` để sửa UI hoặc auto-login.

## LocalStorage/session keys

- `hrAuthSessionToken`: GAS session token.
- `hrAuthSessionUser`: user object hiển thị trên UI.
- `hrAuthPendingOtp`: email + expiry của OTP đang chờ.

## Deploy

Deploy chuẩn:

1. Sửa `public/`, root GAS, root `appsscript.json`, docs.
2. Chạy kiểm tra syntax.
3. Chạy `deploy-all.bat --no-pause`.
4. Wrapper gọi `deploy-all.ps1`; PowerShell đọc `deploy.config.psd1` và guard:
   - GAS deploy workspace phải đúng `gas-upload/`;
   - Firebase `hosting.public` phải đúng `public`;
   - root project chỉ chứa source/config/script, không phải thư mục `clasp push`.
5. `deploy-all.ps1` thực hiện:
   - kiểm tra Node/Firebase/clasp;
   - cập nhật `.firebaserc`;
   - cập nhật `gas-upload/.clasp.json`/manifest;
   - copy root GAS sang `gas-upload`;
   - copy `public` sang `gas-upload`;
   - cập nhật Web App URL/build version;
   - chạy clasp trong `gas-upload`;
   - deploy Firebase Hosting theo `firebase.json`, với `hosting.public = "public"`.

Trong môi trường hiện tại:

- `firebase` và `clasp` có trong PATH.
- `git` có trong PATH tại môi trường hiện tại.
- Không chạy clasp tại root; root `.clasp.json` legacy đã bị xóa.
- GAS vẫn deploy riêng từ `gas-upload/`. Firebase Hosting phải deploy riêng từ root bằng `firebase deploy --only hosting --project hcns-lt`.
- `clasp -P gas-upload run ...` hiện trả `Script function not found. Please make sure script is deployed as API executable.` nên không dùng làm đường kiểm thử chính.

## Trạng thái xác thực/deploy ngày 2026-05-30

- Firebase Hosting live trả HTML UTF-8 hợp lệ, có `firebaseConfig`, có progressive login và có luồng `loginWithFirebase`.
- GAS public `getAuthConfig` hoạt động và trả captcha, chứng tỏ endpoint anonymous vẫn reachable.
- GAS protected API như `getEmployees` vẫn trả `AUTH_REQUIRED` khi không có session, chứng tỏ session gate chưa bị bypass.
- `loginWithFirebase` đã deploy nhưng live invalid-token test đang bị Apps Script chặn ở runtime với lỗi thiếu quyền `UrlFetchApp.fetch` dù manifest đã có `https://www.googleapis.com/auth/script.external_request`.
- Root cause còn lại: owner/deployer `hr@longthaisteel.com` cần re-authorize OAuth scopes mới của Apps Script sau khi thêm UrlFetch. Anonymous web app call không thể tự bật consent này.
- Sau khi owner authorize scope mới, invalid-token test phải chuyển từ `FIREBASE_LOGIN_FAILED` do thiếu quyền UrlFetch sang `FIREBASE_TOKEN_INVALID`; lúc đó mới kiểm thử được owner auto-login bằng Firebase Auth session thật.

## RCA auto-login owner ngày 2026-06-01

- GAS verifier đã được owner cấp scope mới. Live `loginWithFirebase` với token giả hiện trả `FIREBASE_TOKEN_INVALID`, đúng kỳ vọng.
- Frontend bootstrap không bị login page chặn: splash render trước; `showLoginFlow_()` chỉ chạy sau `validateStoredSession_()` và `tryFirebaseAutoLogin_()` thất bại.
- Router không ghi đè auth: `AppShell.start()` chỉ chạy sau `showApp_()`.
- Không có `sessionStorage` auth flow. LocalStorage chỉ giữ GAS session token/user/pending OTP; không dùng email localStorage để cấp quyền.
- Firebase SDK Web mặc định persistence local; code hiện đặt `firebase.auth.Auth.Persistence.LOCAL` rõ ràng.
- Ban đầu Public Identity Toolkit API và Admin Auth Config API đều trả `CONFIGURATION_NOT_FOUND`: Firebase Authentication chưa được khởi tạo cho project `hanhchinh-nhansu`.
- Ngày 2026-06-01 đã hoàn tất Firebase Console Authentication **Get started**. Public Auth config hiện trả `200` và có authorized domains `localhost`, `hanhchinh-nhansu.firebaseapp.com`, `hanhchinh-nhansu.web.app`.
- Google provider đã được Save: Admin API `defaultSupportedIdpConfigs/google.com` trả `enabled: true`; public `accounts:createAuthUri` trả `providerId=google.com` và OAuth URL hợp lệ.
- Root cause code còn lại: source cũ chỉ restore Firebase session có sẵn; chưa có Google Sign-In/One Tap để tạo session lần đầu từ Google browser session sau consent.
- Bản deploy `260601_1032` bổ sung GIS `auto_select` với FedCM. GIS credential chỉ được dùng để gọi Firebase `GoogleAuthProvider.credential()` + `signInWithCredential()`, sau đó frontend vẫn gửi Firebase ID token về GAS `loginWithFirebase`.
- Client chỉ decode email trong GIS credential để bỏ qua tài khoản không phải owner trước khi tạo Firebase persistence. Đây không phải boundary cấp quyền; GAS vẫn xác minh token, `email_verified`, provider Google và whitelist owner.
- Logout gọi cả GAS logout, Firebase `signOut()` và GIS `disableAutoSelect()` để tránh vòng lặp đăng xuất rồi tự vào lại.

## Migration Firebase sang `hcns-lt` ngày 2026-06-01

- Frontend `public/index.html` và mirror `gas-upload/index.html` đã đổi toàn bộ Firebase Web config sang `hcns-lt`.
- GAS verifier `gas-upload/code.gs` đã đổi fallback `FIREBASE_API_KEY_DEFAULT` sang API key Web App mới để xác minh token của `hcns-lt`.
- `.firebaserc` và `deploy.config.psd1` đã đổi project deploy sang `hcns-lt`; Firebase CLI local đã thêm và chọn owner `hr@longthaisteel.com`.
- Firebase Auth public config của `hcns-lt` trả authorized domains đúng. Public `accounts:createAuthUri` trả `providerId = google.com` và OAuth URL hợp lệ.
- OAuth client id GIS cũ đã bị gỡ khỏi frontend; client id mới của `hcns-lt` đã được nhúng.
- GAS đã push/deploy riêng từ `gas-upload/` lên deployment version `60`; protected API không session vẫn trả `AUTH_REQUIRED`, token Firebase giả vẫn trả `FIREBASE_TOKEN_INVALID`.
- `firebase deploy --only hosting --project hcns-lt` đã PASS từ root; CLI xác nhận Hosting deploy `14 files in public`.
- Live `https://hcns-lt.web.app` trả `200`, chứa config `hcns-lt`, không chứa project cũ và không có log `origin_mismatch` trong browser smoke sạch.
- Owner auto-login end-to-end trên Chrome profile thật vẫn chưa được xác nhận vì profile Chrome hiện thiếu Codex Chrome Extension.

## RCA owner chọn Google account nhưng phải F5 ngày 2026-06-01

- Triệu chứng: khi browser prompt hiện ở góc phải, owner chọn `hr@longthaisteel.com` nhưng app vẫn đứng ở login; F5 mới vào Dashboard.
- Nguyên nhân 1: callback `googleIdentity.prompt()` cũ gọi `finish(false)` ngay cả khi notification chỉ báo `displayed`, làm flow coi prompt đang hiển thị là thất bại.
- Nguyên nhân 2: callback credential cũ bỏ qua response khi promise đã `settled`; account được chọn sau đó không kích hoạt `signInWithCredential()` và cập nhật UI ngay.
- Nguyên nhân 3: listener `onAuthStateChanged` dùng để restore session ban đầu là listener một lần rồi unsubscribe, nên không làm fallback cho auth event phát sinh sau khi login form đã render.
- Bản sửa build `260601_1544`: giữ listener auth lâu dài, gom xử lý owner vào `handleAuthenticatedUser_()`, chống exchange trùng, không settle khi prompt chỉ displayed, và vẫn xử lý credential đến muộn.
- Build `260601_1544` đã deploy: GAS version `60`, Firebase Hosting release `hcns-lt` complete.

## Quy tắc khi sửa

- Luôn giữ parity giữa `public/` và `gas-upload/`.
- Chỉ sửa root `.gs`, root `appsscript.json` và `public/`. `gas-upload/` là output deploy.
- Chỉ dùng `deploy-all.bat` làm entrypoint deploy chính thức. `deploy.bat` chỉ là wrapper deprecated.
- Không đổi kiến trúc sang Next.js/Supabase.
- Không hard-code bypass auth ở client.
- Không tắt captcha, OTP, session gate hoặc protected API.
- Khi sửa text tiếng Việt, giữ UTF-8; tránh dùng PowerShell `Set-Content` lên file HTML lớn vì dễ gây mojibake.
- Với `.gs`, nếu cần syntax check bằng Node thì copy tạm sang `.js` rồi chạy `node --check`.
- Browser không thể bypass consent Google chỉ vì user đang đăng nhập Google. Firebase session còn hạn luôn được restore trực tiếp; GIS auto-select chỉ tạo session mới không tương tác khi Google/FedCM xác định browser đủ điều kiện.
