# Auto-login tài khoản HR bằng Firebase Auth

## Vấn đề ban đầu

Website đang chạy theo mô hình Firebase Hosting frontend + Google Apps Script backend. Phần đăng nhập hiện tại không dùng Firebase Auth SDK trong frontend mà dùng màn hình OTP nội bộ:

- người dùng nhập email, mã bí mật, captcha;
- GAS gửi OTP qua email;
- sau khi OTP hợp lệ, GAS tạo `hrAuthSessionToken`;
- frontend lưu token trong `localStorage` và gửi token này vào các API GAS;
- các API không public vẫn đi qua `requireAuthenticatedSession_()`.

Vì vậy nếu người dùng đã có Firebase Auth session Google hợp lệ trong trình duyệt thì trước đây ứng dụng chưa đọc được session đó để đi thẳng vào dashboard.

## Kiến trúc GAS + Firebase liên quan

- Firebase hiện là bề mặt frontend/hosting. Firebase Auth được nạp động trên frontend khi chạy trong Firebase Hosting hoặc khi có `window.APP_CONFIG.firebaseConfig`.
- Firebase Web App `HanhChinh-NhanSu Web` đã được tạo cho project `hanhchinh-nhansu` để frontend có cấu hình Auth rõ ràng thay vì phụ thuộc mơ hồ vào Hosting init.
- GAS vẫn là backend xác thực session nội bộ và vẫn giữ chặn API bằng `requireAuthenticatedSession_()`.
- Auto-login không dựa vào email trong `localStorage`. Frontend chỉ lấy `currentUser` từ Firebase Auth, gọi `getIdToken(false)`, rồi gửi ID token về GAS.
- GAS xác thực ID token bằng Google Identity Toolkit `accounts:lookup` với `AUTH_FIREBASE_API_KEY` nếu có, hoặc Firebase Web API key mặc định trong `AUTH_CONFIG.FIREBASE_API_KEY_DEFAULT`.
- GAS chỉ cấp session nội bộ nếu token hợp lệ, email đã xác minh, provider là Google, và email nằm trong danh sách auto-login hợp lệ.

Script Properties liên quan:

- `AUTH_FIREBASE_API_KEY`: optional override cho Firebase Web API key của project `hanhchinh-nhansu`. Code hiện có default key vì Firebase Web API key là cấu hình công khai, không phải secret.
- `AUTH_FIREBASE_AUTO_LOGIN_EMAILS`: tùy chọn, danh sách email cách nhau bằng dấu phẩy/khoảng trắng/chấm phẩy. Nếu không cấu hình, mặc định chỉ cho `hr@longthaisteel.com`.

## File đã sửa

- `code.gs`: thêm action public `loginWithFirebase`, xác thực Firebase ID token, kiểm tra Google provider/email hợp lệ, rồi tạo session GAS bằng `createSessionRecord_()`.
- `gas-upload/code.gs`: đồng bộ bản deploy GAS.
- `public/index.html`: thêm bước kiểm tra Firebase Auth session sau khi kiểm tra session GAS hiện có và trước khi hiển thị login OTP.
- `gas-upload/index.html`: đồng bộ bản deploy GAS.
- `appsscript.json`, `gas-upload/appsscript.json`: thêm OAuth scopes cần cho UrlFetch/MailApp/Drive/Sheets.
- `docs/AUTH_AUTO_LOGIN_HR_ACCOUNT.md`: ghi lại luồng mới và cách kiểm tra.

Firebase Web App đã tạo:

- App id: `1:95778640168:web:d38de988d76fc09fb4401d`
- Auth domain: `hanhchinh-nhansu.firebaseapp.com`
- Project id: `hanhchinh-nhansu`

## Luồng xử lý mới

1. Mở website.
2. Frontend hiển thị trạng thái đang kiểm tra auth, chưa quyết định chuyển dashboard/login ngay.
3. Nếu có `hrAuthSessionToken` cũ, frontend gọi `getSessionInfo`. Nếu GAS xác nhận token còn hợp lệ thì vào dashboard như hiện tại.
4. Nếu không có session GAS hợp lệ, frontend thử nạp Firebase Auth và chờ `onAuthStateChanged`.
5. Nếu Firebase Auth có `currentUser.email === hr@longthaisteel.com`, frontend lấy Firebase ID token và gọi `loginWithFirebase`.
6. GAS xác thực token qua Google Identity Toolkit, kiểm tra provider Google và email được phép.
7. Nếu hợp lệ, GAS phát session token nội bộ mới, frontend lưu token và vào dashboard.
8. Nếu không có Firebase Auth session, thiếu cấu hình, token không hợp lệ, hoặc là email khác, frontend rơi về màn hình đăng nhập OTP hiện tại.

Luồng này tránh vòng lặp vì dashboard chỉ hiện sau khi GAS session hợp lệ, còn login OTP chỉ hiện sau khi bước khôi phục session ban đầu kết thúc.

## Cách test

1. Đảm bảo Firebase project `hanhchinh-nhansu` đã bật Google provider trong Firebase Authentication.
2. Owner/deployer `hr@longthaisteel.com` phải re-authorize Apps Script sau khi manifest có scope `https://www.googleapis.com/auth/script.external_request`.
3. Gọi `loginWithFirebase` với token giả: kết quả mong muốn sau khi authorize là `FIREBASE_TOKEN_INVALID`, không còn lỗi thiếu quyền `UrlFetchApp.fetch`.
4. Mở Firebase Hosting khi trình duyệt đã có Firebase Auth session của `hr@longthaisteel.com`: ứng dụng phải tự vào dashboard, không hiện form OTP.
5. Refresh dashboard: ứng dụng phải kiểm tra `hrAuthSessionToken` bằng `getSessionInfo` và vẫn ở dashboard nếu session GAS còn hạn.
6. Đóng mở lại trình duyệt khi session Firebase/GAS còn hạn: ứng dụng không yêu cầu bấm lại đăng nhập Google.
7. Mở bằng trình duyệt/tài khoản chưa có Firebase Auth session: ứng dụng phải hiện màn hình OTP hiện tại.
8. Mở bằng Firebase Auth session của email Google khác: ứng dụng không auto-login, vẫn xử lý theo luồng OTP/phân quyền hiện tại.
9. Xóa hoặc làm sai `AUTH_FIREBASE_API_KEY` nếu đang dùng override: auto-login phải không cấp session, form OTP vẫn hoạt động như trước.

## Rủi ro còn lại

- Nếu Firebase Hosting không phục vụ được `/__/firebase/init.js` và không có `window.APP_CONFIG.firebaseConfig`, frontend không thể khởi tạo Firebase Auth và sẽ rơi về OTP. Bản hiện tại đã nhúng `window.APP_CONFIG.firebaseConfig` nên không phụ thuộc riêng vào Hosting init.
- Nếu Apps Script owner chưa re-authorize scope `script.external_request`, GAS sẽ trả lỗi thiếu quyền `UrlFetchApp.fetch` trước khi xác thực token. Đây là blocker live còn lại ngày 2026-05-30.
- Browser không cho website đọc "tài khoản Google đang đăng nhập" một cách im lặng nếu trước đó chưa có Firebase Auth session hợp lệ cho app. Vì vậy auto-login hoạt động với Firebase Auth session hiện có, không thay thế lần đăng nhập Google đầu tiên.
- Firebase CLI đã từng trả `No apps found` trước khi tạo Web App, đây là root cause khiến frontend không thể có `currentUser` để auto-login dù Hosting vẫn chạy.
