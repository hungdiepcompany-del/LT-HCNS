# Huong dan deploy project len Firebase Hosting

Project nay khong chi co Firebase Hosting. Giao dien duoc host tren Firebase, con du lieu/API dang chay qua Google Apps Script (GAS).

Neu chi deploy Firebase ma khong deploy GAS, trang web van mo duoc nhung cac chuc nang doc du lieu nhan su se loi.

## Lenh deploy chinh thuc

Chay tai `D:\CODE\HanhChinh-NhanSu`:

```bat
deploy-all.bat --no-pause
```

Khong chay `clasp push` tai root project. `deploy-all.bat` se copy source sang `gas-upload/`, chay clasp trong `gas-upload/`, va deploy Firebase Hosting theo `firebase.json` voi `hosting.public = "public"`.

`deploy.bat` chi la wrapper deprecated chuyen tiep sang `deploy-all.bat`, khong con logic deploy rieng.

## 1. Kien truc hien tai cua repo

- `public/`: bo file frontend Firebase Hosting su dung de public len web
- `firebase.json`: cau hinh Hosting, hien dang tro `public`
- `code.gs`, `employee.gs`, `employee_birth.gs`, `trigger.gs`: backend Google Apps Script
- Cac file HTML dung cho Firebase dang nam trong `public/`
- Cac file HTML dung cho Apps Script can copy rieng vao project GAS
- Thu muc `gas-upload/` la output deploy GAS, khong sua tay

Luu y quan trong:

- Root project chua source/config/script, khong phai workspace chay `clasp push`
- `public/` la source frontend va thu muc deploy Firebase Hosting
- `gas-upload/` la output do deploy script sinh lai truoc khi `clasp push`

## 2. Dieu kien can truoc khi deploy

Ban can co:

- Tai khoan Google co quyen tao Firebase project
- Tai khoan Google co quyen tao va deploy Apps Script Web App
- Node.js da cai
- Firebase CLI da cai

May hien tai da co:

- `node -v` -> `v24.14.1`
- `npm -v` -> `11.11.0`
- `firebase --version` -> `15.15.0`

Theo tai lieu Firebase CLI, CLI hien yeu cau Node.js `18+`, nen may nay dat dieu kien.

## 3. Deploy backend Google Apps Script truoc

Firebase frontend trong repo goi API qua URL Apps Script, vi vay phai deploy GAS truoc.

### 3.1. Tao Apps Script project

1. Mo [Google Apps Script](https://script.google.com/)
2. Tao mot project moi
3. Copy cac file sau trong repo len Apps Script:

- `code.gs`
- `employee.gs`
- `employee_birth.gs`
- `trigger.gs`
- `index.html`
- `department.html`
- `profile_sidebar.html`
- `sidebar.html`
- `birthday_client.html`
- `page_dashboard.html`
- `page_employee_birth.html`
- `page_employee_list.html`
- `page_feedback.html`
- `page_safety.html`

Neu Apps Script dang lien ket voi Google Sheet nhan su, ban can dat project nay vao dung file Sheet hoac bao dam code dang dung `SpreadsheetApp.getActiveSpreadsheet()` se tro ve dung bang tinh.

### 3.2. Deploy Web App

1. Trong Apps Script, bam `Deploy`
2. Chon `New deployment`
3. O `Select type`, chon `Web app`
4. O muc thuc thi, thong thuong chon:

- `Execute as`: `Me`
- `Who has access`: 
  - `Anyone` neu web public va nguoi dung ben ngoai can truy cap
  - hoac muc phu hop voi domain/noi bo cua ban

5. Bam `Deploy`
6. Cap quyen neu he thong yeu cau
7. Copy URL dang:

```text
https://script.google.com/macros/s/XXXXX/exec
```

Khong dung URL `/dev` cho Firebase production. Can dung URL `/exec`.

## 4. Cap nhat URL Apps Script trong repo

Sau khi co URL `/exec`, cap nhat cac diem dang hard-code URL cu.

### 4.1. File can sua cho Apps Script

- `code.gs`
  - bien `CONFIG.WEB_APP_URL`
- `index.html`
  - bien `API_BASE_URL`
- `department.html`
  - bien `API_BASE_URL`
- `profile_sidebar.html`
  - bien `API_BASE_URL`

### 4.2. File can sua cho Firebase Hosting

- `public/index.html`
  - bien `API_BASE_URL`
- `public/department.html`
  - bien `API_BASE_URL`
- `public/profile_sidebar.html`
  - bien `API_BASE_URL`
- `public/js/api.js`
  - bien `API_BASE_URL`

Neu ban bo sot buoc nay, trang Firebase se mo duoc nhung goi API se van tro toi URL cu.

## 5. Tao Firebase project

1. Mo [Firebase Console](https://console.firebase.google.com/)
2. Bam `Create a project`
3. Dat ten project
4. Neu khong can Analytics thi co the tat
5. Tao xong project va vao phan `Hosting`

## 6. Link thu muc local voi Firebase project

Repo hien da co `firebase.json` va `.firebaserc`, dang gan voi Firebase project `hcns-lt`.
Phan ben duoi chi dung khi can cau hinh lai project tren mot moi truong moi.

### Cach nhanh nhat

Mo PowerShell tai thu muc project:

```powershell
cd D:\CODE\HanhChinh-NhanSu
firebase login
firebase projects:list
firebase use --add
```

Khi chay `firebase use --add`:

1. Chon Firebase project vua tao
2. Dat alias, vi du `prod`

Lenh nay se tao file `.firebaserc`.

### Neu ban muon chay init lai

Chi dung cach nay neu ban muon tao cau hinh moi. Repo da co `firebase.json`, nen thuong khong can.

```powershell
cd D:\CODE\HanhChinh-NhanSu
firebase init hosting
```

Khi duoc hoi:

- `Use an existing project` -> chon project da tao
- `What do you want to use as your public directory?` -> nhap `public`
- `Configure as a single-page app (rewrite all urls to /index.html)?` -> `Yes`
- `Set up automatic builds and deploys with GitHub?` -> tuy chon, thuong `No` neu deploy tay
- Neu hoi co ghi de `index.html` hay khong -> `No`

## 7. Cau hinh Hosting hien tai

Repo dang co file `firebase.json` nhu sau:

```json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

Y nghia:

- Firebase se public noi dung trong `public/`
- Moi route khong map truc tiep den file se rewrite ve `index.html`

## 8. Chay thu truoc khi deploy

Ban co the test local:

```powershell
cd D:\CODE\HanhChinh-NhanSu
firebase emulators:start --only hosting
```

Hoac:

```powershell
firebase serve --only hosting
```

Sau do mo URL local ma CLI hien ra de kiem tra:

- giao dien co hien thi
- cac file HTML partial load duoc
- frontend goi duoc Apps Script API

## 9. Deploy len Firebase Hosting

Sau khi da cap nhat URL GAS va link dung project:

```powershell
cd D:\CODE\HanhChinh-NhanSu
deploy-all.bat --no-pause
```

Sau khi deploy xong, CLI se tra ve URL dang:

```text
https://<project-id>.web.app
https://<project-id>.firebaseapp.com
```

## 10. Checklist sau deploy

Sau khi len production, kiem tra:

1. Trang chu mo duoc
2. Danh sach nhan su hien du lieu
3. Cac trang phong ban/profile load duoc
4. Console trinh duyet khong bao loi CORS/403/404
5. Apps Script URL dang la URL moi nhat `/exec`

## 11. Loi thuong gap

### Trang Firebase mo duoc nhung khong co du lieu

Nguyen nhan thuong la:

- chua deploy Apps Script
- dang dung URL cu
- Apps Script khong cap quyen truy cap phu hop

### Loi 403 tu Apps Script

Thuong do `Who has access` cua Web App dang qua hep. Neu frontend Firebase la public, Apps Script cung phai cho doi tuong tuong ung truy cap.

### Sua file goc xong nhung Firebase khong thay doi

Do Firebase chi doc thu muc `public/`.

Neu ban chi sua:

- `index.html`
- `department.html`
- `profile_sidebar.html`

ma khong sua cac ban trong `public/`, thi deploy Firebase se khong an thay doi do.

### Apps Script mo duoc nhung URL trong menu van tro ve ban cu

Can cap nhat them:

- `code.gs` -> `CONFIG.WEB_APP_URL`

## 12. Lenh deploy day du de tham khao

```powershell
cd D:\CODE\HanhChinh-NhanSu
firebase login
firebase use --add
firebase emulators:start --only hosting
deploy-all.bat --no-pause
```

## 13. Tai lieu chinh thuc

- Firebase CLI: https://firebase.google.com/docs/cli
- Firebase Hosting: https://firebase.google.com/docs/hosting
- Apps Script Web Apps: https://developers.google.com/apps-script/guides/web
