/**
 * Cấu hình tên sheet nguồn dữ liệu.
 */
const EMPLOYEE_SHEET_NAME = 'DANH SÁCH NHÂN VIÊN';
const AVATAR_FOLDER_ID = '1SlEICe48ZAhPbycCgfcttwCbtdr5U3bP';

/**
 * Render Web App chính (Birthday Timeline 3D).
 * @returns {HtmlOutput}
 */
function renderBirthdayTimelineApp_() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Birthday Timeline 3D')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Helper include HTML partial (nếu cần tách nhỏ template).
 * @param {string} filename
 * @returns {string}
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Trả về danh sách nhân sự theo tháng sinh.
 * @param {number} month Tháng cần lấy (1-12)
 * @returns {{success: boolean, month: number, employees: Array<Object>, message: string}}
 */
function getEmployeesByMonth(month) {
  const monthNumber = Number(month);

  if (!monthNumber || monthNumber < 1 || monthNumber > 12) {
    return {
      success: false,
      month: monthNumber,
      employees: [],
      message: 'Tháng không hợp lệ. Vui lòng truyền giá trị từ 1 đến 12.'
    };
  }

  try {
    const allEmployees = getAllEmployees_();

    const avatarMap = getAvatarMap();

    const employees = allEmployees
      .filter((emp) => emp.birthMonth === monthNumber)
      .sort((a, b) => a.birthDay - b.birthDay)
      .map((emp) => ({
        employeeCode: emp.employeeCode,
        employeeName: emp.employeeName,
        employeeDepartment: emp.employeeDepartment,
        gender: emp.gender,
        birthDate: emp.birthDateDisplay,
        avatar: avatarMap[(emp.employeeCode || '').toLowerCase()] || ''
      }));

    return {
      success: true,
      month: monthNumber,
      employees,
      message: employees.length ? '' : 'Không có nhân sự trong tháng này.'
    };
  } catch (error) {
    return {
      success: false,
      month: monthNumber,
      employees: [],
      message: 'Có lỗi khi đọc dữ liệu: ' + error.message
    };
  }
}

/**
 * Lấy toàn bộ dữ liệu nhân sự từ cache/sheet để tối ưu hiệu năng.
 * @returns {Array<Object>}
 */
function getAllEmployees_() {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'employee_birthdays_v2';

  const cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  const ss = getHrSpreadsheet_();
  const sheet = ss.getSheetByName(EMPLOYEE_SHEET_NAME);

  if (!sheet) {
    throw new Error('Không tìm thấy sheet: ' + EMPLOYEE_SHEET_NAME);
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }

  // Cột C -> K (9 cột), bắt đầu từ dòng 2.
  const values = sheet.getRange(2, 3, lastRow - 1, 9).getValues();
  const timezone = Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh';

  const employees = values
    .map((row) => {
      const employeeCode = String(row[0] || '').trim(); // C
      const employeeName = String(row[1] || '').trim(); // D
      const employeeDepartment = String(row[2] || '').trim(); // E
      const gender = String(row[7] || '').trim(); // J
      const birthRaw = row[8]; // K

      if (!employeeCode && !employeeName) return null;

      const birthDate = birthRaw instanceof Date ? birthRaw : new Date(birthRaw);
      if (!(birthDate instanceof Date) || isNaN(birthDate.getTime())) return null;

      return {
        employeeCode,
        employeeName,
        employeeDepartment,
        gender,
        birthMonth: birthDate.getMonth() + 1,
        birthDay: birthDate.getDate(),
        birthDateDisplay: Utilities.formatDate(birthDate, timezone, 'dd/MM')
      };
    })
    .filter(Boolean);

  // Cache 10 phút.
  cache.put(cacheKey, JSON.stringify(employees), 600);
  return employees;
}

// Lấy map mã nhân viên -> URL avatar từ thư mục Drive, có sử dụng cache để tối ưu hiệu năng.
function getAvatarMap() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('avatarMap');

  if (cached) {
    return JSON.parse(cached);
  }

  const folder = DriveApp.getFolderById(AVATAR_FOLDER_ID);
  const files = folder.getFiles();

  const map = {};

  while (files.hasNext()) {
    const file = files.next();
    const name = file.getName().toLowerCase();

    const code = name.split('.')[0]; // NV001.jpg → NV001

    map[code] = `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w200`;
  }

  cache.put('avatarMap', JSON.stringify(map), 21600); // cache 6h

  return map;
}
