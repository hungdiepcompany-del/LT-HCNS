/**
 * Cấu hình hệ thống.
 */
const EMPLOYEE_CONFIG = {
  SHEET_NAME: 'DANH SÁCH NHÂN VIÊN',
  START_ROW: 3,
  START_COL: 3, // C
  NUM_COLS: 36, // C..AL
  STATUS_OFFSET: 26, // AC so với C
  AVATAR_FOLDER_ID: '1v3nxsG_Vb2FY9Bde0kHor4wT1MraD1rr',
  DEFAULT_AVATAR_URL: 'https://via.placeholder.com/320x320.png?text=No+Avatar',
};

// Cache cho avatar để tối ưu tốc độ
let avatarCache = null;

/**
 * Web App entrypoint.
 */
function renderIndexApp_() {
  return HtmlService
    .createHtmlOutputFromFile('index')
    .setTitle('PHÒNG HÀNH CHÍNH NHÂN SỰ - BẢNG TỔNG HỢP NHÂN SỰ')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Lấy danh sách nhân sự từ Google Sheets.
 */
function getEmployees() {
  return getEmployeeRecords_({ includeInactive: false })
    .map(mapEmployeeRecordToPublic_);
}

function getDashboardData() {
  const tz = Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh';
  const now = new Date();
  const allRecords = getEmployeeRecords_({ includeInactive: true });
  const activeRecords = allRecords.filter((record) => record.isActive);
  const normalize_ = (s) => String(s || '').trim().toLowerCase();
  const statusSummary = allRecords.reduce((acc, record) => {
    const status = normalize_(record.trangThai);
    if (status === 'đã nghỉ việc') {
      acc.resigned += 1;
      return acc;
    }
    if (status === 'đang đi làm') {
      acc.working += 1;
      return acc;
    }
    if (status.indexOf('thử việc') !== -1) {
      acc.trial += 1;
      return acc;
    }
    acc.other += 1;
    return acc;
  }, {
    working: 0,
    trial: 0,
    other: 0,
    resigned: 0,
  });
  const activeDisplayTotal = statusSummary.working + statusSummary.trial + statusSummary.other;
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const inactiveCount = allRecords.length - activeRecords.length;
  const departmentStats = buildDepartmentStats_(activeRecords);
  const birthdaysThisMonth = activeRecords.filter((record) =>
    record.birthDate && record.birthDate.getMonth() === now.getMonth()
  ).length;
  const currentYear = now.getFullYear();
  const availableYears = [];
  for (let y = currentYear; y >= currentYear - 4; y--) availableYears.push(y);

  return {
    ok: true,
    generatedAt: formatDateTime_(now, tz),
    totals: {
      activeEmployees: statusSummary.working,
      activeDisplayTotal: activeDisplayTotal,
      trialEmployees: statusSummary.trial,
      otherStatusEmployees: statusSummary.other,
      totalRecords: allRecords.length,
      newEmployeesThisMonth: countRecordsInRange_(allRecords, 'startDate', currentMonthStart, nextMonthStart),
      birthdaysThisMonth: birthdaysThisMonth,
      inactiveEmployees: inactiveCount,
      departmentCount: departmentStats.length,
    },
    departmentStats: departmentStats.slice(0, 8),
    hireTrend: buildHireTrend_(allRecords, now, 6, tz),
    recentHires: buildRecentHires_(allRecords),
    upcomingBirthdays: buildMonthBirthdays_(activeRecords, now, tz),
    availableYears: availableYears,
  };
}

function getEmployeeRecords_(options) {
  const settings = options || {};
  const ss = getHrSpreadsheet_();
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

  return values.reduce((acc, row) => {
    const ma = asText(row[0]);       // C
    const ten = asText(row[1]);      // D
    const boPhan = asText(row[2]);   // E
    const startDate = parseDateCell_(row[3]);
    const birthDate = parseDateCell_(row[8]);
    const leaveDate = parseDateCell_(row[27]);
    const ngayBatDau = formatDateCell(startDate || row[3], tz); // F
    const viTri = asText(row[5]);    // H
    const capBac = asText(row[6]);   // I
    const gioiTinh = asText(row[7]); // J
    const ngaySinh = formatDateCell(birthDate || row[8], tz); // K
    const honNhan = asText(row[9]);  // L
    const cccd = asText(row[12]);    // O
    const bhxh = asText(row[13]);    // P
    const trinhDo = asText(row[14]); // Q
    const email = asText(row[15]);   // R
    const sdt = asText(row[16]);     // S
    const diaChi1_tmp = asText(row[17]);     // T
    const diaChi2_tmp = asText(row[18]);     // U
    const diaChi3_tmp = asText(row[19]);     // V
    const trangThaiDisplay = asText(row[EMPLOYEE_CONFIG.STATUS_OFFSET]); // AC
    const trangThai = normalizeText(trangThaiDisplay);
    const ngayNghiViec = formatDateCell(leaveDate || row[27], tz); // AD
    const tenNguoiThan = asText(row[33]); // AJ
    const quanHeNguoiThan = asText(row[34]); // AK
    const sdtNguoiThan = asText(row[35]); // AL

    const isEmpty = !ma && !ten && !boPhan && !ngayBatDau && !viTri && !capBac && !gioiTinh;
    const isActive = trangThai !== 'đã nghỉ việc';
    if (isEmpty) return acc;
    if (!settings.includeInactive && !isActive) return acc;

    const diaChi = [diaChi1_tmp, diaChi2_tmp, diaChi3_tmp].filter(Boolean).join(', ');
    const thongTinThem = sdtNguoiThan + " (" + tenNguoiThan + " - " + quanHeNguoiThan + ")";

    acc.push({
      ma,
      ten,
      boPhan,
      ngayBatDau,
      startDate,
      viTri,
      capBac,
      gioiTinh,
      ngaySinh,
      birthDate,
      honNhan,
      cccd,
      bhxh,
      trinhDo,
      email,
      sdt,
      diaChi,
      trangThai,
      trangThaiDisplay,
      ngayNghiViec,
      leaveDate,
      thongTinThem,
      isActive,
    });

    return acc;
  }, []);
}

function mapEmployeeRecordToPublic_(record) {
  return {
    ma: record.ma,
    ten: record.ten,
    boPhan: record.boPhan,
    ngayBatDau: record.ngayBatDau,
    viTri: record.viTri,
    capBac: record.capBac,
    gioiTinh: record.gioiTinh,
    ngaySinh: record.ngaySinh,
    honNhan: record.honNhan,
    cccd: record.cccd,
    bhxh: record.bhxh,
    trinhDo: record.trinhDo,
    email: record.email,
    sdt: record.sdt,
    diaChi: record.diaChi,
    trangThai: record.trangThaiDisplay || record.trangThai,
    thongTinThem: record.thongTinThem,
  };
}

function buildDepartmentStats_(records) {
  const counts = {};

  records.forEach((record) => {
    const department = record.boPhan || 'Chưa phân bổ';
    counts[department] = (counts[department] || 0) + 1;
  });

  return Object.keys(counts)
    .map((name) => ({ name, count: counts[name] }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, 'vi');
    });
}

function buildHireTrend_(records, now, months, timezone) {
  const bucketMap = {};
  const buckets = [];

  for (let index = months - 1; index >= 0; index -= 1) {
    const bucketDate = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = Utilities.formatDate(bucketDate, timezone, 'yyyy-MM');
    const item = {
      key,
      label: 'T' + Utilities.formatDate(bucketDate, timezone, 'MM'),
      fullLabel: Utilities.formatDate(bucketDate, timezone, 'MM/yyyy'),
      count: 0,
      resignedCount: 0,
    };
    bucketMap[key] = item;
    buckets.push(item);
  }

  records.forEach((record) => {
    if (record.startDate) {
      const key = Utilities.formatDate(record.startDate, timezone, 'yyyy-MM');
      if (bucketMap[key]) bucketMap[key].count += 1;
    }
    if (record.leaveDate) {
      const key = Utilities.formatDate(record.leaveDate, timezone, 'yyyy-MM');
      if (bucketMap[key]) bucketMap[key].resignedCount += 1;
    }
  });

  return buckets.map((item) => ({
    label: item.label,
    fullLabel: item.fullLabel,
    count: item.count,
    resignedCount: item.resignedCount,
  }));
}

function buildRecentHires_(records) {
  const normalize_ = (s) => String(s || '').trim().toLowerCase();
  return records
    .filter((record) => !!record.startDate && normalize_(record.trangThai) === 'thử việc')
    .sort((left, right) => right.startDate.getTime() - left.startDate.getTime())
    .map((record) => ({
      ma: record.ma,
      ten: record.ten,
      boPhan: record.boPhan || 'Chưa phân bổ',
      ngayBatDau: record.ngayBatDau,
      viTri: record.viTri,
      capBac: record.capBac,
      gioiTinh: record.gioiTinh,
      ngaySinh: record.ngaySinh,
      honNhan: record.honNhan,
      cccd: record.cccd,
      bhxh: record.bhxh,
      trinhDo: record.trinhDo,
      email: record.email,
      sdt: record.sdt,
      diaChi: record.diaChi,
      trangThai: record.trangThaiDisplay || 'Thử việc',
      thongTinThem: record.thongTinThem,
      avatar: getEmployeeAvatar(record.ma),
      statusTone: 'trial',
    }));
}

/**
 * Trả về toàn bộ sinh nhật trong tháng hiện tại của nhân viên đang làm việc.
 * isUpcoming = true nếu sinh nhật từ hôm nay trở đi, isPast = true nếu đã qua.
 */
function buildMonthBirthdays_(records, now, timezone) {
  const today = startOfDay_(now);
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  return records
    .filter((record) => !!record.birthDate && record.birthDate.getMonth() === currentMonth)
    .map((record) => {
      const thisBirthday = new Date(currentYear, record.birthDate.getMonth(), record.birthDate.getDate());
      const daysAway = Math.round((startOfDay_(thisBirthday).getTime() - today.getTime()) / 86400000);
      return {
        ma: record.ma,
        ten: record.ten,
        boPhan: record.boPhan || 'Chưa phân bổ',
        gioiTinh: record.gioiTinh,
        ngaySinh: record.ngaySinh,
        cccd: record.cccd,
        bhxh: record.bhxh,
        sdt: record.sdt,
        email: record.email,
        trinhDo: record.trinhDo,
        diaChi: record.diaChi,
        honNhan: record.honNhan,
        trangThai: record.trangThaiDisplay || record.trangThai,
        thongTinThem: record.thongTinThem,
        statusTone: record.trangThai.indexOf('thử việc') !== -1 ? 'trial' : (record.trangThai === 'đang đi làm' ? 'active' : 'neutral'),
        avatar: getEmployeeAvatar(record.ma),
        dayLabel: Utilities.formatDate(thisBirthday, timezone, 'dd'),
        dateLabel: Utilities.formatDate(thisBirthday, timezone, 'dd/MM'),
        relativeLabel: daysAway === 0 ? 'Hôm nay 🎉' : (daysAway < 0 ? `${Math.abs(daysAway)} ngày trước` : (daysAway === 1 ? 'Ngày mai' : `Còn ${daysAway} ngày`)),
        daysAway: daysAway,
        isUpcoming: daysAway >= 0 && daysAway <= 7,
        isToday: daysAway === 0,
        sortValue: thisBirthday.getTime(),
      };
    })
    .sort((left, right) => {
      if (left.sortValue !== right.sortValue) return left.sortValue - right.sortValue;
      return left.ten.localeCompare(right.ten, 'vi');
    });
}

/**
 * Lấy dữ liệu tuyển mới + nghỉ việc theo tháng trong một năm cụ thể.
 */
function getTrendByYear(yearOrPayload) {
  try {
    const tz = Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh';
    // invokeApiFunction_ passes payload as first arg — handle both {year:N} and plain number
    const rawYear = (yearOrPayload !== null && typeof yearOrPayload === 'object')
      ? yearOrPayload.year
      : yearOrPayload;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based
    const targetYear = Number(rawYear) || currentYear;
    const allRecords = getEmployeeRecords_({ includeInactive: true });
    const months = [];
    const bucketMap = {};
    for (let m = 0; m < 12; m++) {
      const bucketDate = new Date(targetYear, m, 1);
      const key = Utilities.formatDate(bucketDate, tz, 'yyyy-MM');
      // Tháng tương lai → count = null (chưa có dữ liệu, không phải 0)
      const isFuture = (targetYear > currentYear) || (targetYear === currentYear && m > currentMonth);
      const item = {
        key,
        label: 'T' + String(m + 1).padStart(2, '0'),
        fullLabel: String(m + 1).padStart(2, '0') + '/' + targetYear,
        count: isFuture ? null : 0,
        resignedCount: isFuture ? null : 0,
      };
      bucketMap[key] = item;
      months.push(item);
    }
    allRecords.forEach((record) => {
      if (record.startDate) {
        const key = Utilities.formatDate(record.startDate, tz, 'yyyy-MM');
        if (bucketMap[key] && bucketMap[key].count !== null) bucketMap[key].count += 1;
      }
      if (record.leaveDate) {
        const key = Utilities.formatDate(record.leaveDate, tz, 'yyyy-MM');
        if (bucketMap[key] && bucketMap[key].resignedCount !== null) bucketMap[key].resignedCount += 1;
      }
    });
    return {
      ok: true, year: targetYear,
      months: months.map((m) => ({ label: m.label, fullLabel: m.fullLabel, count: m.count, resignedCount: m.resignedCount })),
    };
  } catch (error) {
    return { ok: false, error: error.message || 'Không thể tải dữ liệu' };
  }
}

function countRecordsInRange_(records, fieldName, startDate, endDate) {
  return records.filter((record) => {
    const value = record[fieldName];
    return value && value.getTime() >= startDate.getTime() && value.getTime() < endDate.getTime();
  }).length;
}

function isSameMonthDay_(dateValue, now) {
  return !!dateValue
    && dateValue.getDate() === now.getDate()
    && dateValue.getMonth() === now.getMonth();
}

function startOfDay_(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function getStatusTone_(statusValue) {
  const value = normalizeText(statusValue);
  if (!value || value === 'đang đi làm') return 'active';
  if (value.indexOf('thử việc') !== -1) return 'trial';
  if (value.indexOf('nghỉ') !== -1) return 'inactive';
  return 'neutral';
}

function parseDateCell_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return new Date(value.getTime());
  }

  const text = String(value).trim();
  if (!text) return null;

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateTime_(value, timezone) {
  return Utilities.formatDate(value, timezone, 'dd/MM/yyyy HH:mm:ss');
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
