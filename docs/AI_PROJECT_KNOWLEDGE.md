# AI Project Knowledge - HanhChinh-NhanSu

Last updated: 2026-05-30 11:36 +07:00

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
- `gas-upload/`: bundle đưa lên Apps Script bằng `clasp`.
- Root `.gs`/`.html`: nguồn GAS/HTML lịch sử. Luồng deploy hiện tại copy root GAS và `public` vào `gas-upload` theo cấu hình.

## File cấu hình quan trọng

- `firebase.json`: Firebase Hosting public folder là `public`, rewrite mọi route về `/index.html`.
- `.firebaserc`: project Firebase default là `hanhchinh-nhansu`.
- `.clasp.json`: root hiện trỏ script cũ; khi thao tác GAS chính nên dùng `gas-upload/.clasp.json` hoặc deploy script.
- `gas-upload/.clasp.json`: script GAS chính theo `deploy.config.psd1`.
- `appsscript.json` và `gas-upload/appsscript.json`: manifest Apps Script, web app chạy `USER_DEPLOYING`, access `ANYONE_ANONYMOUS`, có Drive advanced service và các OAuth scopes cần cho MailApp/UrlFetch/Drive/Sheets.
- `deploy.config.psd1`: nguồn cấu hình deploy chính, gồm Firebase project id, GAS script id, deployment id, web app URL, account dự kiến. Hiện dùng `ClaspUserName = 'default'` vì profile `gas-hr` chưa login, còn default đang là `hr@longthaisteel.com`.
- `deploy-all.ps1`: deploy automation chính cho Firebase + GAS. Script đã xử lý fallback khi `$PSScriptRoot` rỗng bằng `$PSCommandPath`.
- `deploy-all.bat`, `deploy.bat`: wrapper deploy.

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

Không được dựa vào email trong localStorage để cấp quyền. LocalStorage chỉ lưu session token do GAS cấp.

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

Firebase project: `hanhchinh-nhansu`.

Firebase Web App đã tạo ngày 2026-05-30:

- App display name: `HanhChinh-NhanSu Web`
- App id: `1:95778640168:web:d38de988d76fc09fb4401d`
- Auth domain: `hanhchinh-nhansu.firebaseapp.com`
- API key đang được nhúng trong frontend như Firebase Web config công khai.

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

1. Sửa `public/`, root GAS, docs.
2. Đồng bộ `public/*` sang `gas-upload/*` nếu không dùng deploy script.
3. Chạy kiểm tra syntax.
4. Chạy `deploy-all.ps1` để:
   - kiểm tra Node/Firebase/clasp;
   - cập nhật `.firebaserc`;
   - cập nhật `.clasp.json`/manifest;
   - copy root GAS sang `gas-upload`;
   - copy `public` sang `gas-upload`;
   - cập nhật Web App URL/build version;
   - deploy GAS bằng clasp;
   - deploy Firebase Hosting.

Trong môi trường hiện tại:

- `firebase` và `clasp` có trong PATH.
- `git` không có trong PATH.
- `clasp deployments --json` tại root bị quyền/tài khoản hoặc project mismatch; cần dùng deploy script hoặc `-P gas-upload`.
- `clasp -P gas-upload push`, `clasp -P gas-upload deploy -i <deployment-id>` và `firebase deploy --only hosting --project hanhchinh-nhansu` đã chạy được.
- `clasp -P gas-upload run ...` hiện trả `Script function not found. Please make sure script is deployed as API executable.` nên không dùng làm đường kiểm thử chính.

## Trạng thái xác thực/deploy ngày 2026-05-30

- Firebase Hosting live trả HTML UTF-8 hợp lệ, có `firebaseConfig`, có progressive login và có luồng `loginWithFirebase`.
- GAS public `getAuthConfig` hoạt động và trả captcha, chứng tỏ endpoint anonymous vẫn reachable.
- GAS protected API như `getEmployees` vẫn trả `AUTH_REQUIRED` khi không có session, chứng tỏ session gate chưa bị bypass.
- `loginWithFirebase` đã deploy nhưng live invalid-token test đang bị Apps Script chặn ở runtime với lỗi thiếu quyền `UrlFetchApp.fetch` dù manifest đã có `https://www.googleapis.com/auth/script.external_request`.
- Root cause còn lại: owner/deployer `hr@longthaisteel.com` cần re-authorize OAuth scopes mới của Apps Script sau khi thêm UrlFetch. Anonymous web app call không thể tự bật consent này.
- Sau khi owner authorize scope mới, invalid-token test phải chuyển từ `FIREBASE_LOGIN_FAILED` do thiếu quyền UrlFetch sang `FIREBASE_TOKEN_INVALID`; lúc đó mới kiểm thử được owner auto-login bằng Firebase Auth session thật.

## Quy tắc khi sửa

- Luôn giữ parity giữa `public/` và `gas-upload/`.
- Không đổi kiến trúc sang Next.js/Supabase.
- Không hard-code bypass auth ở client.
- Không tắt captcha, OTP, session gate hoặc protected API.
- Khi sửa text tiếng Việt, giữ UTF-8; tránh dùng PowerShell `Set-Content` lên file HTML lớn vì dễ gây mojibake.
- Với `.gs`, nếu cần syntax check bằng Node thì copy tạm sang `.js` rồi chạy `node --check`.
- Browser không thể đọc im lặng Google account chỉ vì user đang đăng nhập Google ở trình duyệt. Auto-login im lặng chỉ hoạt động khi app đã có Firebase Auth session hợp lệ.
