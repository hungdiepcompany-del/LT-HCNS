# Project File Audit - HanhChinh-NhanSu

Ngày rà soát: 2026-06-01

## Mục tiêu

Xác định source-of-truth, workspace deploy, file legacy và nguy cơ sửa nhầm nơi trong project `D:\CODE\HanhChinh-NhanSu`.

Không xóa file trong đợt audit này.

## Kết luận nhanh

- Source backend GAS chính thức: root `code.gs`, `employee.gs`, `employee_birth.gs`, `trigger.gs`.
- Source frontend chính thức: `public/`.
- Source manifest GAS chính thức: root `appsscript.json`.
- Workspace deploy sinh ra: `gas-upload/`. Deploy script copy source vào đây rồi chạy `clasp push`.
- Firebase Hosting deploy trực tiếp từ `public/` theo `firebase.json`.
- Root HTML cũ, root `.js` và `Code (1).gs` là nhóm legacy/nghi ngờ dư. Root `.clasp.json` legacy đã bị xóa; `deploy.bat` đã chuyển thành wrapper deprecated.

## Phương pháp so sánh

- `100%` và `IDENTICAL`: byte content giống nhau.
- Với file khác nhau, `%` là Dice similarity trên các dòng đã trim và bỏ dòng rỗng. Mục đích là nhận diện mức độ trùng lặp để audit, không thay thế diff review.
- Cột “Đang sử dụng” dựa trên `firebase.json`, `deploy.config.psd1`, `deploy-all.ps1` và reference trong source.

## Bảng source và deploy mirror

| File | Thư mục gốc | Thư mục trùng | Nội dung giống % | Đang được sử dụng hay không |
|---|---|---|---:|---|
| `code.gs` | root | `gas-upload/code.gs` | 100% | Root là source GAS; mirror được `clasp push` |
| `employee.gs` | root | `gas-upload/employee.gs` | 100% | Root là source GAS; mirror được `clasp push` |
| `employee_birth.gs` | root | `gas-upload/employee_birth.gs` | 100% | Root là source GAS; mirror được `clasp push` |
| `trigger.gs` | root | `gas-upload/trigger.gs` | 100% | Root là source GAS; mirror được `clasp push` |
| `appsscript.json` | root | `gas-upload/appsscript.json` | tương đương cấu hình | Root là source manifest; mirror được format/cập nhật khi deploy |
| `birthday_client.html` | `public/` | `gas-upload/` | 100% | `public/` là source; mirror cho GAS |
| `department.html` | `public/` | `gas-upload/` | 100% | `public/` là source; mirror cho GAS |
| `index.html` | `public/` | `gas-upload/` | 100% | `public/` là source SPA; mirror cho GAS |
| `login.html` | `public/` | `gas-upload/` | 100% | `public/` là source login; mirror cho GAS |
| `page_dashboard.html` | `public/` | `gas-upload/` | 100% | `public/` là source; mirror cho GAS |
| `page_employee_birth.html` | `public/` | `gas-upload/` | 100% | `public/` là source; mirror cho GAS |
| `page_employee_list.html` | `public/` | `gas-upload/` | 100% | `public/` là source; mirror cho GAS |
| `page_feedback.html` | `public/` | `gas-upload/` | 100% | `public/` là source; mirror cho GAS |
| `page_safety.html` | `public/` | `gas-upload/` | 100% | `public/` là source; mirror cho GAS |
| `profile_sidebar.html` | `public/` | `gas-upload/` | 100% | `public/` là source; mirror cho GAS |
| `sidebar.html` | `public/` | `gas-upload/` | 100% | `public/` là source; mirror cho GAS |

## Bảng file root HTML legacy

| File | Thư mục gốc | Thư mục trùng hiện hành | Nội dung giống % | Phân loại |
|---|---|---|---:|---|
| `birthday_client.html` | root | `public/birthday_client.html` | 98.5% | Legacy gần giống; không được deploy bởi flow chuẩn |
| `department.html` | root | `public/department.html` | 87.6% | Legacy; không được deploy bởi flow chuẩn |
| `index.html` | root | `public/index.html` | 35.5% | Legacy SPA cũ; không được Firebase Hosting sử dụng |
| `page_employee_birth.html` | root | `public/page_employee_birth.html` | 100% | Trùng lặp legacy |
| `page_employee_list.html` | root | `public/page_employee_list.html` | 97.5% | Legacy gần giống |
| `sidebar.html` | root | `public/sidebar.html` | 1.5% | Legacy khác đáng kể |

## Bảng file nghi ngờ dư hoặc legacy

| File/thư mục | Phân loại | Lý do | Rủi ro nếu xóa | Đề xuất |
|---|---|---|---|---|
| `gas-upload/` | Deploy-generated | `deploy-all.ps1` copy root GAS và `public/*.html` vào đây trước `clasp push` | Cao nếu xóa khi chưa cập nhật deploy config | Giữ; không sửa thủ công |
| `gas-upload/README.txt` | Legacy instruction | Hướng dẫn copy thủ công cũ, flow hiện tại đã có `deploy-all.ps1` | Thấp | Giữ tạm, sau này thay bằng link đến `docs/DEPLOY_ARCHITECTURE.md` |
| root HTML trong bảng trên | Legacy | Firebase deploy chỉ dùng `public/`; GAS deploy lấy HTML từ `public/` | Trung bình vì có thể còn lịch sử tham chiếu thủ công | Không sửa; archive/xóa ở đợt cleanup riêng sau khi review |
| `code.js` | Legacy GAS snapshot | Không được `deploy-all.ps1` copy; chỉ giống `code.gs` khoảng 27.8% | Trung bình | Không dùng; review trước khi archive |
| `employee.js` | Legacy GAS snapshot | Không được copy; chỉ giống `employee.gs` khoảng 46.6% | Trung bình | Không dùng; review trước khi archive |
| `employee_birth.js` | Legacy GAS snapshot | Không được copy; giống `employee_birth.gs` khoảng 97.4% | Thấp-trung bình | Không dùng; review trước khi archive |
| `Code (1).gs` | Backup nhỏ | Chỉ có wrapper `getPage`, giống `code.gs` khoảng 0.4% | Thấp | Archive/xóa ở đợt cleanup riêng |
| root `.clasp.json` | Legacy config nguy hiểm đã xóa | Từng trỏ script id cũ `1xaB...`; flow chuẩn dùng `gas-upload/.clasp.json` được sinh từ config | Đã giảm rủi ro | Không tạo lại |
| `deploy.bat` | Wrapper deprecated | Logic cũ từng `cd /d D:\HanhChinh-NhanSu` và gọi `inject-version.js` không tồn tại; nay chỉ chuyển tiếp sang `deploy-all.bat` | Thấp | Giữ để tương thích thao tác cũ |
| `public/css/app.css` | Legacy/minimal | SPA hiện có CSS inline, không thấy reference | Thấp | Giữ tạm |
| `public/js/api.js` | Legacy helper | SPA chính có `window.API` inline; file vẫn được deploy nhưng không thấy reference từ SPA | Trung bình | Giữ tạm vì view cũ có thể dùng độc lập |
| `public/404.html` | Firebase-generated | File mẫu Firebase CLI | Thấp | Có thể thay nội dung sau; không ảnh hưởng route rewrite |

## Nguy cơ vận hành

1. Sửa trực tiếp `gas-upload/*` sẽ bị ghi đè ở lần chạy `deploy-all.ps1`.
2. Sửa root HTML cũ sẽ không xuất hiện trên Firebase Hosting.
3. Không chạy `clasp push` tại root; root `.clasp.json` legacy đã bị xóa.
4. `deploy.bat` chỉ là wrapper deprecated; entrypoint chính thức là `deploy-all.bat`.

## Chuẩn sau audit

- Sửa backend tại root `.gs`.
- Sửa frontend tại `public/`.
- Sửa manifest tại root `appsscript.json`.
- Chạy `deploy-all.bat --no-pause` hoặc `powershell -ExecutionPolicy Bypass -File .\deploy-all.ps1`.
- Không sửa thủ công `gas-upload/`.
- Không xóa file legacy trong đợt này.
