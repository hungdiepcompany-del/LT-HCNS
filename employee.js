/**
 * Cấu hình hệ thống.
 */
const EMPLOYEE_CONFIG = {
  SHEET_NAME: 'DANH SÁCH NHÂN VIÊN',
  START_ROW: 3,
  START_COL: 3, // C
  NUM_COLS: 36, // C..AL
  STATUS_OFFSET: 26, // AC so với C
  AVATAR_FOLDER_ID: '1SlEICe48ZAhPbycCgfcttwCbtdr5U3bP',
  DEFAULT_AVATAR_URL: 'https://via.placeholder.com/320x320.png?text=No+Avatar',
};

// Cache cho avatar để tối ưu tốc độ
let avatarCache = null;

/**
 * Web App entrypoint.
 */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('PHÒNG HÀNH CHÍNH NHÂN SỰ - BẢNG TỔNG HỢP NHÂN SỰ')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Lấy danh sách nhân sự từ Google Sheets.
 */
function getEmployees() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(EMPLOYEE_CONFIG.SHEET_NAME);
  if (!sheet) {
    throw new Error(`Không tìm thấy sheet "${EMPLOYEE_CONFIG.SHEET_NAME}"`);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < EMPLOYEE_CONFIG.START_ROW) return [];

  // Đọc range 1 lần để tối ưu tốc độ (C..AC).
  const values = sheet
    .getRange(EMPLOYEE_CONFIG.START_ROW, EMPLOYEE_CONFIG.START_COL, lastRow - EMPLOYEE_CONFIG.START_ROW + 1, EMPLOYEE_CONFIG.NUM_COLS)
    .getValues();

  const tz = Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh';

  // Đọc range 1 lần để tối ưu tốc độ (C..AJ).
  // Chuyển dữ liệu thô thành đối tượng nhân viên có cấu trúc rõ ràng, 
  // đồng thời lọc bỏ các dòng trống hoặc đã nghỉ việc.
  return values.reduce((acc, row) => {
    const ma = asText(row[0]);       // C
    const ten = asText(row[1]);      // D
    const boPhan = asText(row[2]);   // E
    const ngayBatDau = formatDateCell(row[3], tz); // F
    const viTri = asText(row[5]);    // H
    const capBac = asText(row[6]);   // I
    const gioiTinh = asText(row[7]); // J
    const ngaySinh = formatDateCell(row[8], tz); // K
    const honNhan = asText(row[9]);  // L
    const cccd = asText(row[12]);    // O
    const bhxh = asText(row[13]);    // P
    const trinhDo = asText(row[14]); // Q
    const email = asText(row[15]);   // R
    const sdt = asText(row[16]);     // S
    const diaChi1_tmp = asText(row[17]);     // T
    const diaChi2_tmp = asText(row[18]);     // U
    const diaChi3_tmp = asText(row[19]);     // V
    const trangThai = normalizeText(row[EMPLOYEE_CONFIG.STATUS_OFFSET]); // AC
    const tenNguoiThan = asText(row[33]); // AJ
    const quanHeNguoiThan = asText(row[34]); // AK
    const sdtNguoiThan = asText(row[35]); // AL

    const isEmpty = !ma && !ten && !boPhan && !ngayBatDau && !viTri && !capBac && !gioiTinh;
    if (isEmpty || trangThai === 'đã nghỉ việc') return acc;

    const diaChi = `${diaChi1_tmp}, ${diaChi2_tmp}, ${diaChi3_tmp}`;
    const thongTinThem = sdtNguoiThan + " (" + tenNguoiThan + " - " + quanHeNguoiThan + ")";

    acc.push({
      ma,
      ten,
      boPhan,
      ngayBatDau,
      viTri,
      capBac,
      gioiTinh,
      ngaySinh,
      honNhan,
      cccd,
      bhxh,
      trinhDo,
      email,
      sdt,
      diaChi,
      trangThai,
      thongTinThem,
    });

    return acc;
  }, []);
}

/**
 * Trả về URL avatar nhân viên từ Google Drive folder.
 * Tên file chứa mã NV (ví dụ: A001.jpg, W001.png).
 *
 * @param {string} maNV Mã nhân viên
 * @return {string} URL ảnh
 */
function getEmployeeAvatar(maNV) {
  const keyword = asText(maNV);
  if (!keyword) return EMPLOYEE_CONFIG.DEFAULT_AVATAR_URL;

  // Build cache nếu chưa có
  if (!avatarCache) {
    avatarCache = {};
    const folder = DriveApp.getFolderById(EMPLOYEE_CONFIG.AVATAR_FOLDER_ID);
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      const fileName = asText(file.getName()).toLowerCase();
      const url = `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w400`;
      avatarCache[fileName] = url;
    }
  }

  // Tìm trong cache
  const target = keyword.toLowerCase();
  for (const fileName in avatarCache) {
    if (fileName.indexOf(target) !== -1) {
      return avatarCache[fileName];
    }
  }

  return EMPLOYEE_CONFIG.DEFAULT_AVATAR_URL;
}

/**
 * Chuyển về text an toàn.
 */
function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

/**
 * Normalize text để so sánh không phân biệt hoa thường.
 */
function normalizeText(value) {
  return asText(value).toLowerCase();
}

/**
 * Format ngày về dd/MM/yyyy.
 */
function formatDateCell(value, timezone) {
  if (!value) return '';

  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone, 'dd/MM/yyyy');
  }

  const text = String(value).trim();
  if (!text) return '';

  const parsed = new Date(text);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, timezone, 'dd/MM/yyyy');
  }

  return text;
}
