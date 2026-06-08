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
- Firebase Web App hiện hành thuộc project `hcns-lt` để frontend có cấu hình Auth rõ ràng thay vì phụ thuộc mơ hồ vào Hosting init.
- Firebase Authentication Google provider của `hcns-lt` đã được bật. Frontend nhúng OAuth `client_id` công khai mới `904438352439-m8706ivb3np83jgj5n06846lobgrgl8a.apps.googleusercontent.com`.
- GAS vẫn là backend xác thực session nội bộ và vẫn giữ chặn API bằng `requireAuthenticatedSession_()`.
- Auto-login không dựa vào email trong `localStorage`. Frontend chỉ lấy `currentUser` từ Firebase Auth, gọi `getIdToken(false)`, rồi gửi ID token về GAS.
- GAS xác thực ID token bằng Google Identity Toolkit `accounts:lookup` với `AUTH_FIREBASE_API_KEY` nếu có, hoặc Firebase Web API key mặc định trong `AUTH_CONFIG.FIREBASE_API_KEY_DEFAULT`.
- GAS chỉ cấp session nội bộ nếu token hợp lệ, email đã xác minh, provider là Google, và email nằm trong danh sách auto-login hợp lệ.

Script Properties liên quan:

- `AUTH_FIREBASE_API_KEY`: optional override cho Firebase Web API key của project `hcns-lt`. Code hiện có default key vì Firebase Web API key là cấu hình công khai, không phải secret.
- `AUTH_FIREBASE_AUTO_LOGIN_EMAILS`: tùy chọn, danh sách email cách nhau bằng dấu phẩy/khoảng trắng/chấm phẩy. Nếu không cấu hình, mặc định chỉ cho `hr@longthaisteel.com`.

## File đã sửa

- `code.gs`: thêm action public `loginWithFirebase`, xác thực Firebase ID token, kiểm tra Google provider/email hợp lệ, rồi tạo session GAS bằng `createSessionRecord_()`.
- `gas-upload/code.gs`: đồng bộ bản deploy GAS.
- `public/index.html`: thêm bước kiểm tra Firebase Auth session, GIS auto-select và Firebase credential exchange sau khi kiểm tra session GAS hiện có và trước khi hiển thị login OTP.
- `gas-upload/index.html`: đồng bộ bản deploy GAS.
- `appsscript.json`, `gas-upload/appsscript.json`: thêm OAuth scopes cần cho UrlFetch/MailApp/Drive/Sheets.
- `docs/AUTH_AUTO_LOGIN_HR_ACCOUNT.md`: ghi lại luồng mới và cách kiểm tra.

Firebase Web App đã tạo:

- App id: `1:904438352439:web:fe377de7a75a819f304db2`
- Auth domain: `hcns-lt.firebaseapp.com`
- Project id: `hcns-lt`

## Luồng xử lý mới

1. Mở website.
2. Frontend hiển thị trạng thái đang kiểm tra auth, chưa quyết định chuyển dashboard/login ngay.
3. Nếu có `hrAuthSessionToken` cũ, frontend gọi `getSessionInfo`. Nếu GAS xác nhận token còn hợp lệ thì vào dashboard như hiện tại.
4. Nếu không có session GAS hợp lệ, frontend thử nạp Firebase Auth và chờ `onAuthStateChanged`.
5. Nếu Firebase Auth có `currentUser.email === hr@longthaisteel.com`, frontend lấy Firebase ID token và gọi `loginWithFirebase`.
6. Nếu chưa có Firebase `currentUser`, frontend thử GIS `auto_select` với OAuth client id công khai. GIS chỉ tiếp tục nếu credential thuộc owner, rồi đổi Google ID token thành Firebase credential bằng `firebase.auth.GoogleAuthProvider.credential()` và `signInWithCredential()`.
7. Frontend lấy Firebase ID token vừa tạo và gọi `loginWithFirebase`.
8. GAS xác thực token qua Google Identity Toolkit, kiểm tra provider Google và email được phép.
9. Nếu hợp lệ, GAS phát session token nội bộ mới, frontend lưu token và vào dashboard.
10. Nếu không có session hợp lệ, thiếu cấu hình, token không hợp lệ, hoặc là email khác, frontend rơi về màn hình đăng nhập OTP hiện tại.

Luồng này tránh vòng lặp vì dashboard chỉ hiện sau khi GAS session hợp lệ, còn login OTP chỉ hiện sau khi bước khôi phục session ban đầu kết thúc.

## Quy tắc bắt buộc cho owner

- `hr@longthaisteel.com` là owner/chủ quản của hệ thống GAS + Firebase.
- Nếu Firebase Auth `currentUser` hoặc ID token hợp lệ thuộc owner, ứng dụng phải vào thẳng dashboard.
- Owner không đi qua OTP form, không nhập thêm thông tin và không bấm xác nhận lại khi session còn hợp lệ.
- Trong lúc Firebase đang khôi phục session, UI chỉ hiện splash `Đang khôi phục phiên đăng nhập`; partial `login.html` chưa được tải vào `#authScreen`.
- Chỉ sau khi `validateStoredSession_()`, `tryFirebaseAutoLogin_()` và `tryGoogleIdentityAutoLogin_()` đều không thành công thì `showLoginFlow_()` mới tải form OTP cho tài khoản khác.
- Firebase persistence được đặt rõ ràng là `LOCAL`.
- Logout xóa GAS session, gọi `firebase.auth().signOut()` và GIS `disableAutoSelect()` để không tự đăng nhập owner lại ngay sau thao tác logout.

Lưu ý kỹ thuật: browser đã đăng nhập Gmail không phải là tín hiệu bảo mật mà website được phép đọc im lặng. GIS auto-select chỉ tạo Firebase session không tương tác khi chính sách Google/FedCM cho phép, ví dụ tài khoản phù hợp và consent trước đó còn hiệu lực. App không bypass consent lần đầu.

## Cách test

1. Đảm bảo Firebase project `hcns-lt` đã bật Google provider trong Firebase Authentication.
2. Owner/deployer `hr@longthaisteel.com` phải re-authorize Apps Script sau khi manifest có scope `https://www.googleapis.com/auth/script.external_request`.
3. Gọi `loginWithFirebase` với token giả: kết quả mong muốn sau khi authorize là `FIREBASE_TOKEN_INVALID`, không còn lỗi thiếu quyền `UrlFetchApp.fetch`.
4. Mở Firebase Hosting khi trình duyệt đã có Firebase Auth session của `hr@longthaisteel.com`: ứng dụng phải tự vào dashboard, không hiện form OTP.
5. Xóa riêng Firebase session nhưng giữ Google browser session owner đã consent: GIS auto-select phải tự tạo lại Firebase session nếu Chrome/FedCM cho phép.
6. Refresh dashboard: ứng dụng phải kiểm tra `hrAuthSessionToken` bằng `getSessionInfo` và vẫn ở dashboard nếu session GAS còn hạn.
7. Đóng mở lại trình duyệt khi session Firebase/GAS còn hạn: ứng dụng không yêu cầu bấm lại đăng nhập Google.
8. Mở bằng trình duyệt/tài khoản chưa có Firebase Auth session: ứng dụng phải hiện màn hình OTP hiện tại.
9. Mở bằng Firebase Auth session của email Google khác: ứng dụng không auto-login, vẫn xử lý theo luồng OTP/phân quyền hiện tại.
10. Logout: ứng dụng phải xóa GAS/Firebase session và disable GIS auto-select.
11. Xóa hoặc làm sai `AUTH_FIREBASE_API_KEY` nếu đang dùng override: auto-login phải không cấp session, form OTP vẫn hoạt động như trước.

## Rủi ro còn lại

- Nếu Firebase Hosting không phục vụ được `/__/firebase/init.js` và không có `window.APP_CONFIG.firebaseConfig`, frontend không thể khởi tạo Firebase Auth và sẽ rơi về OTP. Bản hiện tại đã nhúng `window.APP_CONFIG.firebaseConfig` nên không phụ thuộc riêng vào Hosting init.
- Nếu Apps Script owner chưa re-authorize scope `script.external_request`, GAS sẽ trả lỗi thiếu quyền `UrlFetchApp.fetch` trước khi xác thực token. Đây là blocker live còn lại ngày 2026-05-30.
- Browser không cho website bypass consent Google. GIS auto-select hỗ trợ khôi phục từ Google browser session sau consent, nhưng Google/FedCM có thể từ chối auto-select tùy trạng thái browser.
- Firebase CLI đã từng trả `No apps found` trước khi tạo Web App, đây là root cause khiến frontend không thể có `currentUser` để auto-login dù Hosting vẫn chạy.

## RCA cập nhật ngày 2026-06-01

- Owner đã authorize scope Apps Script `script.external_request`. Live token giả hiện trả `FIREBASE_TOKEN_INVALID`, chứng tỏ GAS verifier hoạt động.
- Ban đầu Firebase public API và Admin API đều trả `CONFIGURATION_NOT_FOUND`: Firebase Authentication chưa được khởi tạo.
- Sau khi hoàn tất Firebase Console **Get started**, public API hiện trả `200`, `accounts:createAuthUri` trả session id và authorized domains đã có Hosting domain.
- Google provider đã được Save. Admin API trả `enabled: true`; public `accounts:createAuthUri` trả `providerId=google.com` và OAuth URL hợp lệ.
- OAuth client id công khai đã được nhúng vào `window.APP_CONFIG.firebaseGoogleClientId`; không lưu OAuth client secret vào source hoặc tài liệu.
- Root cause source còn lại đã được sửa: trước đó code chỉ restore session, chưa có Google Sign-In/One Tap để tạo Firebase session lần đầu. Bản hiện tại thêm GIS auto-select -> Firebase `signInWithCredential()` -> GAS `loginWithFirebase`.

## Migration sang Firebase `hcns-lt` ngày 2026-06-01

- Firebase Web config frontend và fallback API key GAS đã đổi sang project `hcns-lt`.
- Public Auth config đã trả authorized domains `localhost`, `hcns-lt.firebaseapp.com`, `hcns-lt.web.app`.
- Google provider project mới đã được cấu hình; public `accounts:createAuthUri` trả `providerId = google.com` và OAuth URL hợp lệ.
- OAuth client id GIS project cũ đã gỡ khỏi frontend để tránh `origin_mismatch`. Frontend đã nhúng client id mới của `hcns-lt`.
