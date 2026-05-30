const CONFIG = Object.freeze({
  SPREADSHEET_ID: '1PurCiZ66HOr9BIG08qMcrHVFD43PMmC57nEIxZq7Nk4',
  SHEET_NAME: 'DANH SÁCH NHÂN VIÊN',
  FIRST_DATA_ROW: 3,
  AVATAR_FOLDER_ID: '1v3nxsG_Vb2FY9Bde0kHor4wT1MraD1rr',

  MENU_NAME: '🔑 QUẢN LÝ',
  MENU_ITEM_OPEN: '👉 mở MENU',
  MENU_REFRESH_IMAGE: '🔄 Refresh ảnh',
  MENU_EMPLOYEE_LIST: '📋 Mở Web Danh sách nhân sự',

  WEB_APP_URL : "https://script.google.com/macros/s/AKfycbxCWUHr-33sTja9_mOE1r0-wDEfQ2iHnMiEerja0gujBicQpI82uWRbsMpDMk-b6oNw0g/exec",
  

  PROP_SELECTED_PROFILE: 'selected_employee_profile_v2',
  PROP_PROFILE_VERSION: 'selected_employee_profile_version_v1',
  PROP_SELECTED_DEPARTMENT: 'selected_department_detail_v1',
  PROP_IMAGE_CACHE: 'employee_image_cache_v2',
  PROP_IMAGE_CACHE_UPDATED_AT: 'employee_image_cache_updated_at_v1',
  PROP_DEFAULT_IMAGE_FILE_ID: 'employee_default_image_file_id_v1',
  IMAGE_CACHE_TTL_HOURS: 8,
  IMAGE_CACHE_REFRESH_HOUR: 2,
  DEFAULT_DEPARTMENT_PAGE_SIZE: 4,
  DATA_SHEET_NAME: 'Data',
  COLUMNS: Object.freeze({
    CODE: 3, // C
    NAME: 4, // D
    DEPARTMENT: 5, // E
    START_DATE: 6, // F
    GENDER: 10, // J
    BIRTH_DATE: 11, // K
    ID_NUMBER: 15, // O
    SOCIAL_INSURANCE: 16, // P
    EMAIL: 18, // R
    PHONE: 19, // S
    TEMP_ADDR_1: 20, // T
    TEMP_ADDR_2: 21, // U
    TEMP_ADDR_3: 22, // V
    CONTRACT_TYPE: 27, // AA
    NOTES: 28, // AB (optional)
    STATUS: 29, // AC
  }),
});

const IMAGE_CACHE_STORE = Object.freeze({
  META_KEY: 'employee_image_cache_runtime_meta_v1',
  CHUNK_KEY_PREFIX: 'employee_image_cache_runtime_chunk_v1_',
  CHUNK_SIZE: 80000,
  MAX_CACHE_TTL_SECONDS: 21600,
  RESET_TRIGGER_HANDLER: 'resetImageCacheBySchedule',
  LEGACY_TRIGGER_HANDLER: 'refreshImageCacheBySchedule',
});

const PUBLIC_HTML_FILES = Object.freeze({
  index: 'index',
  login: 'login',
  sidebar: 'sidebar',
  page_dashboard: 'page_dashboard',
  page_employee_birth: 'page_employee_birth',
  page_employee_list: 'page_employee_list',
  page_feedback: 'page_feedback',
  page_safety: 'page_safety',
  department: 'department',
  birthday_client: 'birthday_client',
});

const AUTH_CONFIG = Object.freeze({
  SESSION_TTL_HOURS: 8,
  OTP_TTL_SECONDS: 180,
  CAPTCHA_TTL_SECONDS: 300,
  DEFAULT_MAX_ATTEMPTS: 5,
  DEFAULT_ATTEMPT_WINDOW_MINUTES: 15,
  DEFAULT_LOCK_MINUTES: 30,
  PROP_SECRET_CODE: 'AUTH_SECRET_CODE',
  PROP_CAPTCHA_SECRET: 'AUTH_CAPTCHA_SECRET',
  PROP_MAIL_SENDER_NAME: 'AUTH_MAIL_SENDER_NAME',
  PROP_MAX_ATTEMPTS: 'AUTH_MAX_ATTEMPTS',
  PROP_ATTEMPT_WINDOW_MINUTES: 'AUTH_ATTEMPT_WINDOW_MINUTES',
  PROP_LOCK_MINUTES: 'AUTH_LOCK_MINUTES',
  PROP_FIREBASE_API_KEY: 'AUTH_FIREBASE_API_KEY',
  PROP_FIREBASE_AUTO_LOGIN_EMAILS: 'AUTH_FIREBASE_AUTO_LOGIN_EMAILS',
  FIREBASE_API_KEY_DEFAULT: 'AIzaSyAKJmjHxu1Pyh2uPYVp_BtkmhnLzKvwTow',
  FIREBASE_AUTO_LOGIN_EMAILS: Object.freeze(['hr@longthaisteel.com']),
  OTP_KEY_PREFIX: 'auth_otp_',
  SESSION_KEY_PREFIX: 'auth_session_',
  LOCK_KEY_PREFIX: 'auth_lock_',
  CAPTCHA_KEY_PREFIX: 'auth_captcha_',
});

function getHrSpreadsheet_() {
  const spreadsheetId = normalizeText_(CONFIG.SPREADSHEET_ID);
  if (spreadsheetId) {
    return SpreadsheetApp.openById(spreadsheetId);
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Khong tim thay Google Sheet nhan su.');
  }
  return ss;
}

function getMigrationAuthProperties_() {
  const allProps = PropertiesService.getScriptProperties().getProperties();
  const authProps = {};
  Object.keys(allProps || {}).forEach(function (key) {
    if (key.indexOf('AUTH_') === 0) {
      authProps[key] = allProps[key];
    }
  });
  return authProps;
}

function setMigrationAuthProperties_(props) {
  const safeProps = props || {};
  Object.keys(safeProps).forEach(function (key) {
    if (key.indexOf('AUTH_') === 0) {
      PropertiesService.getScriptProperties().setProperty(key, String(safeProps[key]));
    }
  });
  return { ok: true, count: Object.keys(safeProps).length };
}

function setDeploymentAuthProperties(props) {
  return setMigrationAuthProperties_(props);
}

function onOpen() {
  cleanupLegacyImageCacheProperties_(PropertiesService.getScriptProperties());
  SpreadsheetApp.getUi()
    .createMenu(CONFIG.MENU_NAME)
    .addItem(CONFIG.MENU_ITEM_OPEN, 'showEmployeeProfileSidebar')
    .addItem(CONFIG.MENU_REFRESH_IMAGE, 'rebuildImageCache_')
    .addItem(CONFIG.MENU_EMPLOYEE_LIST, 'openWebApp')
    .addToUi();

  ensureImageCacheRefreshTrigger_();
}

function openWebApp() {
  const url = CONFIG.WEB_APP_URL;

  const html = HtmlService.createHtmlOutput(`
    <div style="padding:20px;font-family:sans-serif">
      <h3>Quản lý nhân sự</h3>
      <button onclick="window.open('${url}', '_blank')" 
        style="padding:10px 15px;border:none;background:#1a73e8;color:#fff;border-radius:6px;cursor:pointer">
        Mở Web App
      </button>
    </div>
  `);

  SpreadsheetApp.getUi().showSidebar(html);
}

function doGet(e) {
  cleanupLegacyImageCacheProperties_(PropertiesService.getScriptProperties());
  const callback = getJsonpCallbackName_(e);
  const action = getApiActionFromRequest_(e);
  if (callback && action) {
    return createJsonpResponse_(callback, action, getApiPayloadFromRequest_(e));
  }

  const publicFile = getPublicHtmlFileFromRequest_(e);
  if (publicFile) {
    return HtmlService
      .createHtmlOutputFromFile(publicFile)
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  return renderIndexApp_();
}

function doPost(e) {
  try {
    cleanupLegacyImageCacheProperties_(PropertiesService.getScriptProperties());
    const body = parseApiBody_(e);
    const action = normalizeText_(body.action);
    const result = dispatchApiAction_(action, body.data);
    return createJsonResponse_(result);
  } catch (error) {
    console.error('doPost error:', error);
    return createJsonResponse_({
      ok: false,
      error: error && error.message ? error.message : 'API error',
    });
  }
}

function doOptions() {
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function parseApiBody_(e) {
  const contents = e && e.postData && e.postData.contents;
  if (!contents) return {};

  const parsed = JSON.parse(contents);
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function getApiActionFromRequest_(e) {
  return normalizeText_(e && e.parameter && e.parameter.action);
}

function getApiPayloadFromRequest_(e) {
  const raw = e && e.parameter ? e.parameter.data : null;
  if (raw === null || raw === undefined || raw === '') return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    return raw;
  }
}

function getJsonpCallbackName_(e) {
  const callback = e && e.parameter ? String(e.parameter.callback || '') : '';
  return /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback) ? callback : '';
}

function createJsonpResponse_(callback, action, data) {
  try {
    const result = dispatchApiAction_(action, data);
    return ContentService
      .createTextOutput(`${callback}(${serializePayload_(result)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (error) {
    return ContentService
      .createTextOutput(`${callback}(${serializePayload_({
        ok: false,
        error: error && error.message ? error.message : 'API error',
      })});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

function dispatchApiAction_(action, data) {
  const request = unwrapApiRequest_(data);
  const payload = request.payload;
  const authCheck = isPublicApiAction_(action)
    ? { ok: true, session: null }
    : requireAuthenticatedSession_(request.authToken);

  if (!authCheck.ok) {
    return authCheck.response;
  }

  switch (action) {
    case 'getPage':
      return getPublicPage_(payload);
    case 'getAuthConfig':
      return getAuthConfig();
    case 'requestOtp':
      return requestOtp(payload);
    case 'login':
      return login(payload);
    case 'loginWithFirebase':
      return loginWithFirebase(payload);
    case 'logout':
      return logout(Object.assign({}, isPlainObject_(payload) ? payload : {}, {
        authToken: request.authToken,
      }));
    case 'getSessionInfo':
      return getSessionInfo(Object.assign({}, isPlainObject_(payload) ? payload : {}, {
        authToken: request.authToken,
      }));
    case 'getOnlineUsers':
      return getOnlineUsers();
    case 'getEmployees':
      return invokeApiFunction_(getEmployees, payload);
    case 'getDashboardData':
      return invokeApiFunction_(getDashboardData, payload);
    case 'getTrendByYear':
      return invokeApiFunction_(getTrendByYear, payload);
    case 'getEmployeeAvatar':
      return invokeApiFunction_(getEmployeeAvatar, payload);
    case 'getEmployeesByMonth':
      return invokeApiFunction_(getEmployeesByMonth, payload);
    case 'getDepartments':
    case 'getDepartmentList':
      return invokeApiFunction_(getDepartmentList, payload);
    case 'getDepartmentEmployees':
      return invokeApiFunction_(getDepartmentEmployees, payload);
    case 'getSelectedDepartment':
      return getSelectedDepartment();
    case 'getProfileVersion':
      return getProfileVersion();
    case 'getCurrentProfile':
      return getCurrentProfile();
    case 'getEmployeeImageUrl':
      return invokeApiFunction_(getEmployeeImageUrl, data);
    case 'openFullProfile':
    case 'openDepartmentDetail':
      return {
        ok: false,
        error: 'This action is only available inside the GAS Spreadsheet UI.',
      };
    default:
      return {
        ok: false,
        error: 'Unknown action',
      };
  }
}

function invokeApiFunction_(fn, data) {
  const args = Array.isArray(data)
    ? data
    : (data === undefined || data === null ? [] : [data]);
  return fn.apply(null, args);
}

function getPublicPage_(name) {
  const fileName = normalizePublicHtmlName_(name);
  if (!fileName) {
    return {
      ok: false,
      error: 'Unknown page',
    };
  }

  return HtmlService.createHtmlOutputFromFile(fileName).getContent();
}

function getPublicHtmlFileFromRequest_(e) {
  const path = e && e.pathInfo ? String(e.pathInfo) : '';
  const fileName = normalizePublicHtmlName_(path);
  return fileName === 'index' ? fileName : '';
}

function normalizePublicHtmlName_(name) {
  const key = normalizeText_(name)
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\.html$/i, '');

  return PUBLIC_HTML_FILES[key] || '';
}

function createJsonResponse_(payload) {
  return ContentService
    .createTextOutput(serializePayload_(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function serializePayload_(payload) {
  return JSON.stringify(payload == null ? null : payload)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function getPage(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function onSelectionChange(e) {
  try {
    if (!e || !e.range) return;

    const range = e.range;
    const sheet = range.getSheet();

    if (sheet.getName() !== CONFIG.SHEET_NAME) return;
    if (range.getNumRows() !== 1 || range.getNumColumns() !== 1) return;
    if (range.getRow() < CONFIG.FIRST_DATA_ROW) return;

    const profile = buildProfileFromRow_(sheet, range.getRow());
    const docProps = PropertiesService.getDocumentProperties();

    if (!profile.code || !profile.name) {
      docProps.deleteProperty(CONFIG.PROP_SELECTED_PROFILE);
      docProps.setProperty(CONFIG.PROP_PROFILE_VERSION, String(Date.now()));
      return;
    }

    docProps.setProperty(CONFIG.PROP_SELECTED_PROFILE, JSON.stringify(profile));
    docProps.setProperty(CONFIG.PROP_PROFILE_VERSION, String(Date.now()));

  } catch (error) {
    console.error('onSelectionChange error:', error);
  }
}

function showEmployeeProfileSidebar() {
  const html = HtmlService
    .createHtmlOutputFromFile('profile_sidebar')
    .setTitle('Nhân sự');
  SpreadsheetApp.getUi().showSidebar(html);
}

function openFullProfile() {
  const html = HtmlService
    .createHtmlOutputFromFile('profile_sidebar')
    .setWidth(1700)
    .setHeight(1000);

  SpreadsheetApp.getUi().showModalDialog(html, 'Chi tiết hồ sơ nhân sự');
}

function getDepartmentList() {
  try {
    const ss = getHrSpreadsheet_();
    const sheet = ss.getSheetByName(CONFIG.DATA_SHEET_NAME);
    if (!sheet) return { ok: true, data: [] };

    const lastRow = sheet.getLastRow();
    if (lastRow < 5) return { ok: true, data: [] };

    const values = sheet.getRange(5, 3, lastRow - 4, 1).getDisplayValues();
    const list = values
      .map((r) => normalizeText_(r[0]))
      .filter(Boolean)
      .filter((v, i, arr) => arr.indexOf(v) === i)
      .sort((a, b) => a.localeCompare(b, 'vi'));

    return { ok: true, data: list };
  } catch (error) {
    console.error('getDepartmentList error:', error);
    return { ok: false, message: 'Không thể tải danh sách bộ phận', data: [] };
  }
}

function openDepartmentDetail(departmentName) {
  const department = normalizeText_(departmentName) || '-';
  PropertiesService
    .getDocumentProperties()
    .setProperty(CONFIG.PROP_SELECTED_DEPARTMENT, department);

  const html = HtmlService
    .createHtmlOutputFromFile('department')
    .setWidth(1700)
    .setHeight(1000);
  SpreadsheetApp.getUi().showModalDialog(html, 'Chi tiết bộ phận');
}

function getSelectedDepartment() {
  const department = PropertiesService
    .getDocumentProperties()
    .getProperty(CONFIG.PROP_SELECTED_DEPARTMENT);

  return {
    ok: true,
    data: normalizeText_(department),
  };
}

function getDepartmentEmployees(departmentName, page, pageSize) {
  try {
    const targetDepartment = normalizeText_(departmentName);
    const currentPage = Math.max(1, Number(page) || 1);
    const normalizedPageSize = Math.max(1, Number(pageSize) || CONFIG.DEFAULT_DEPARTMENT_PAGE_SIZE);

    if (!targetDepartment) {
      return {
        ok: false,
        message: 'Vui lòng chọn bộ phận',
        data: [],
        total: 0,
        totalPages: 0,
        page: currentPage,
        pageSize: normalizedPageSize,
      };
    }

    const ss = getHrSpreadsheet_();
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      return {
        ok: false,
        message: 'Không tìm thấy sheet nhân sự',
        data: [],
        total: 0,
        totalPages: 0,
        page: currentPage,
        pageSize: normalizedPageSize,
      };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.FIRST_DATA_ROW) {
      return {
        ok: true,
        data: [],
        total: 0,
        totalPages: 0,
        page: currentPage,
        pageSize: normalizedPageSize,
      };
    }

    const totalRows = lastRow - CONFIG.FIRST_DATA_ROW + 1;
    const values = sheet
      .getRange(CONFIG.FIRST_DATA_ROW, 1, totalRows, CONFIG.COLUMNS.STATUS)
      .getDisplayValues();

    const normalizedTarget = targetDepartment.toLowerCase();
    const matchedIndexes = [];

    values.forEach((rowValues, index) => {
      const department = normalizeText_(rowValues[CONFIG.COLUMNS.DEPARTMENT - 1]);
      if (!department || department.toLowerCase() !== normalizedTarget) return;
      matchedIndexes.push(index);
    });

    const total = matchedIndexes.length;
    const totalPages = total > 0 ? Math.ceil(total / normalizedPageSize) : 0;
    const safePage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
    const start = (safePage - 1) * normalizedPageSize;
    const pageIndexes = total > 0 ? matchedIndexes.slice(start, start + normalizedPageSize) : [];

    const pageData = pageIndexes
      .map((matchedIndex) => {
        const rowValues = values[matchedIndex];
        const rowNumber = CONFIG.FIRST_DATA_ROW + matchedIndex;
        const profile = buildProfileFromRowValues_(rowValues, rowNumber);
        if (!profile.code || !profile.name) return null;

        profile.imageUrl = getEmployeeImageUrl(profile.code);
        return profile;
      })
      .filter(Boolean);

    return {
      ok: true,
      data: pageData,
      total,
      totalPages,
      page: safePage,
      pageSize: normalizedPageSize,
    };
  } catch (error) {
    console.error('getDepartmentEmployees error:', error);
    return {
      ok: false,
      message: 'Không thể tải dữ liệu bộ phận',
      data: [],
      total: 0,
      totalPages: 0,
      page: Math.max(1, Number(page) || 1),
      pageSize: Math.max(1, Number(pageSize) || CONFIG.DEFAULT_DEPARTMENT_PAGE_SIZE),
    };
  }
}

function getProfileVersion() {
  const docProps = PropertiesService.getDocumentProperties();
  return {
    ok: true,
    version: docProps.getProperty(CONFIG.PROP_PROFILE_VERSION) || ""
  };
}


function getCurrentProfile() {
  try {
    const docProps = PropertiesService.getDocumentProperties();
    const raw = docProps.getProperty(CONFIG.PROP_SELECTED_PROFILE);

    if (!raw) return { ok: false, message: 'Vui lòng chọn nhân viên' };

    const profile = JSON.parse(raw);

    if (!profile || !profile.code || !profile.name) {
      return { ok: false, message: 'Vui lòng chọn nhân viên' };
    }

    profile.imageUrl = getEmployeeImageUrl(profile.code);
    return { ok: true, data: profile };

  } catch (error) {
    console.error('getCurrentProfile error:', error);
    return { ok: false, message: 'Không thể tải dữ liệu' };
  }
}

function getEmployeeImageUrl(employeeCode) {
  const scriptProps = PropertiesService.getScriptProperties();
  const code = normalizeText_(employeeCode).toUpperCase();

  let cache = readImageCache_(scriptProps);

  // Nếu cache rỗng → rebuild ngay
  if (!cache || Object.keys(cache).length === 0) {
    cache = rebuildImageCache_();
  }

  // Lấy fallback
  let fallbackFileId =
    normalizeText_(cache._NO_IMAGE) ||
    normalizeText_(scriptProps.getProperty(CONFIG.PROP_DEFAULT_IMAGE_FILE_ID));

  // Nếu vẫn chưa có → rebuild lần nữa (tránh cache lỗi)
  if (!fallbackFileId) {
    cache = rebuildImageCache_();
    fallbackFileId = normalizeText_(cache._NO_IMAGE);
  }

  if (!fallbackFileId) {
    throw new Error('Không tìm thấy ảnh mặc định _noimage.jpg trong folder');
  }

  // Lấy ảnh nhân viên
  let fileId = normalizeText_(cache[code]);

  // Nếu không có → dùng fallback
  if (!fileId) {
    console.log('Fallback image used for:', code);
    fileId = fallbackFileId;
  }

  return buildDriveViewUrl_(fileId);
}

function rebuildImageCache_() {
  const scriptProps = PropertiesService.getScriptProperties();
  cleanupLegacyImageCacheProperties_(scriptProps);
  const cache = {};
  const folder = DriveApp.getFolderById(CONFIG.AVATAR_FOLDER_ID);
  const files = folder.getFiles();

  while (files.hasNext()) {
    const file = files.next();
    const fileId = normalizeText_(file.getId());
    const fileName = normalizeText_(file.getName());
    if (!fileId || !fileName) continue;

    const name = fileName.toLowerCase().replace(/[\s_-]+/g, '');
    if (name.includes('noimage')) {
      cache._NO_IMAGE = fileId;
    }

    const fileCode = extractCodeFromFileName_(fileName);
    if (fileCode && !cache[fileCode]) {
      cache[fileCode] = fileId;
    }
  }

  const fallbackFileId =
    normalizeText_(cache._NO_IMAGE) ||
    normalizeText_(scriptProps.getProperty(CONFIG.PROP_DEFAULT_IMAGE_FILE_ID));
  if (fallbackFileId) cache._NO_IMAGE = fallbackFileId;
  if (!cache._NO_IMAGE) {
    throw new Error('Missing default image file (_no image) in Drive folder');
  }

  persistImageCache_(scriptProps, cache);
  return cache;
}

function refreshImageCacheBySchedule() {
  resetImageCacheBySchedule();
}

function resetImageCacheBySchedule() {
  resetImageCacheStorage_();
}

function ensureImageCacheRefreshTrigger_() {
  try {
    let triggerExists = false;
    ScriptApp.getProjectTriggers().forEach((trigger) => {
      if (trigger.getEventType() !== ScriptApp.EventType.CLOCK) return;
      const handler = trigger.getHandlerFunction();
      if (handler === IMAGE_CACHE_STORE.LEGACY_TRIGGER_HANDLER) {
        ScriptApp.deleteTrigger(trigger);
        return;
      }
      if (handler === IMAGE_CACHE_STORE.RESET_TRIGGER_HANDLER) {
        triggerExists = true;
      }
    });
    if (triggerExists) return;

    ScriptApp.newTrigger(IMAGE_CACHE_STORE.RESET_TRIGGER_HANDLER)
      .timeBased()
      .everyHours(Math.max(1, Number(CONFIG.IMAGE_CACHE_TTL_HOURS) || 8))
      .create();
  } catch (error) {
    console.warn('ensureImageCacheRefreshTrigger_ error:', error);
  }
}

function isImageCacheExpired_(scriptProps) {
  const meta = readImageCacheMeta_();
  if (!meta) return true;
  return Number(meta.expiresAt || 0) <= Date.now();
}

function buildProfileFromRow_(sheet, row) {
  const col = CONFIG.COLUMNS;
  const rowValues = sheet.getRange(row, 1, 1, col.STATUS).getDisplayValues()[0];
  return buildProfileFromRowValues_(rowValues, row);
}

function buildProfileFromRowValues_(rowValues, row) {
  const col = CONFIG.COLUMNS;

  const code = normalizeText_(rowValues[col.CODE - 1]);
  const name = normalizeText_(rowValues[col.NAME - 1]);
  const department = normalizeText_(rowValues[col.DEPARTMENT - 1]);
  const startDate = normalizeText_(rowValues[col.START_DATE - 1]);
  const gender = normalizeText_(rowValues[col.GENDER - 1]);
  const birthDate = normalizeText_(rowValues[col.BIRTH_DATE - 1]);
  const idNumber = normalizeText_(rowValues[col.ID_NUMBER - 1]);
  const socialInsurance = normalizeText_(rowValues[col.SOCIAL_INSURANCE - 1]);
  const email = normalizeText_(rowValues[col.EMAIL - 1]);
  const phone = normalizeText_(rowValues[col.PHONE - 1]);
  const contractType = normalizeText_(rowValues[col.CONTRACT_TYPE - 1]);
  const notes = normalizeText_(rowValues[col.NOTES - 1]);
  const status = normalizeText_(rowValues[col.STATUS - 1]);

  // Tạm thời gộp 3 cột địa chỉ tạm thời thành 1 trường để hiển thị, có thể điều chỉnh lại sau nếu cần thiết
  const tempAddress = [
    normalizeText_(rowValues[col.TEMP_ADDR_1 - 1]),
    normalizeText_(rowValues[col.TEMP_ADDR_2 - 1]),
    normalizeText_(rowValues[col.TEMP_ADDR_3 - 1]),
  ]
    .filter(Boolean)
    .join(', ');

  return {
    code,
    name,
    gender,
    department,
    status,
    birthDate,
    phone,
    idNumber,
    socialInsurance,
    email,
    tempAddress,
    notes: notes || '-',
    startDate,
    contractType,
    imageUrl: '',
    row,
    updatedAt: new Date().toISOString(),
  };
}

// Hàm này được sử dụng để lấy nội dung của một file HTML từ thư mục dự án, giúp tái sử dụng các thành phần giao diện như sidebar
// hoặc modal trong ứng dụng. Bằng cách gọi hàm này với tên file HTML, bạn có thể dễ dàng chèn nội dung của file đó vào các phần
// khác nhau của ứng dụng mà không cần phải viết lại mã HTML nhiều lần, đồng thời giúp tổ chức mã nguồn rõ ràng và dễ bảo trì hơn.
function getPage(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

// Hàm này được sử dụng để lấy nội dung của một file HTML từ thư mục dự án, giúp tái sử dụng các thành phần giao diện như sidebar
// hoặc modal trong ứng dụng. Bằng cách gọi hàm này với tên file HTML, bạn có thể dễ dàng chèn nội dung của file đó vào các phần
// khác nhau của ứng dụng mà không cần phải viết lại mã HTML nhiều lần, đồng thời giúp tổ chức mã nguồn rõ ràng và dễ bảo trì hơn.
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}
function setProfileVersion_(docProps, version) {
  if (!version) {
    docProps.deleteProperty(CONFIG.PROP_PROFILE_VERSION);
    return;
  }
  docProps.setProperty(CONFIG.PROP_PROFILE_VERSION, version);
}


function extractCodeFromFileName_(fileName) {
  const match = normalizeText_(fileName).toUpperCase().match(/^([A-Z0-9]+)/);
  return match ? match[1] : '';
}

// Hàm này được sử dụng để đọc cache ảnh nhân viên từ Script Properties, với cơ chế xử lý lỗi và đảm bảo rằng dữ liệu trả về luôn có
// cấu trúc đúng và an toàn. Nếu có lỗi xảy ra trong quá trình đọc hoặc phân tích dữ liệu cache, hàm sẽ ghi log lỗi và trả về một
// đối tượng cache rỗng để tránh gây rasự cố trong các phần khác của ứng dụng khi cố gắng truy cập dữ liệu cache. Điều này giúp đảm bảo
// rằng ứng dụng vẫn có thể hoạt động bình thường ngay cả khi có vấn đề với cache, đồng thời cung cấp thông tin hữu ích để theo dõi
// và khắc phục sự cố liên quan đến cache ảnh nhân viên.
function readImageCache_(scriptProps) {
  cleanupLegacyImageCacheProperties_(scriptProps);
  try {
    const cacheService = CacheService.getScriptCache();
    const meta = readImageCacheMeta_();
    if (!meta) return {};

    const chunkCount = Math.max(0, Number(meta.chunkCount) || 0);
    if (!chunkCount) return {};

    let raw = '';
    for (let index = 0; index < chunkCount; index += 1) {
      const part = cacheService.get(getImageCacheChunkKey_(index));
      if (!part) {
        clearImageCacheCacheService_();
        return {};
      }
      raw += part;
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn('readImageCache_ error:', error);
    return {};
  }
}

// Hàm này sẽ xóa cache hiện tại và xây dựng lại cache mới từ Google Drive, được gọi khi cache bị lỗi hoặc không tồn tại để
// đảm bảo rằng dữ liệu ảnh nhân viên luôn được cập nhật và chính xác. Sau khi xây dựng lại cache, hàm cũng sẽ lưu trữ cache mới
// vào Script Properties để sử dụng cho các lần truy cập sau, đồng thời cập nhật thời gian tạo cache để theo dõi tuổi thọ của cache.
// Nếu có lỗi xảy ra trong quá trình xây dựng cache, hàm sẽ ghi log lỗi để dễ dàng theo dõi và khắc phục sự cố.
function persistImageCache_(scriptProps, cache) {
  cleanupLegacyImageCacheProperties_(scriptProps);
  clearImageCacheCacheService_();
  try {
    const cacheService = CacheService.getScriptCache();
    const raw = JSON.stringify(cache);
    const ttlSeconds = getImageCacheStoreTtlSeconds_();
    const chunkSize = IMAGE_CACHE_STORE.CHUNK_SIZE;
    const chunkCount = Math.max(1, Math.ceil(raw.length / chunkSize));
    const expiresAt = Date.now() + Math.max(1, Number(CONFIG.IMAGE_CACHE_TTL_HOURS) || 8) * 60 * 60 * 1000;

    for (let index = 0; index < chunkCount; index += 1) {
      cacheService.put(
        getImageCacheChunkKey_(index),
        raw.slice(index * chunkSize, (index + 1) * chunkSize),
        ttlSeconds
      );
    }

    cacheService.put(IMAGE_CACHE_STORE.META_KEY, JSON.stringify({
      chunkCount: chunkCount,
      updatedAt: Date.now(),
      expiresAt: expiresAt,
    }), ttlSeconds);
  } catch (error) {
    console.warn('persistImageCache_ error:', error);
  }
}

function resetImageCacheStorage_() {
  cleanupLegacyImageCacheProperties_(PropertiesService.getScriptProperties());
  clearImageCacheCacheService_();
}

function cleanupLegacyImageCacheProperties_(scriptProps) {
  try {
    scriptProps.deleteProperty(CONFIG.PROP_IMAGE_CACHE);
    scriptProps.deleteProperty(CONFIG.PROP_IMAGE_CACHE_UPDATED_AT);
  } catch (error) {
    console.warn('cleanupLegacyImageCacheProperties_ error:', error);
  }
}

function clearImageCacheCacheService_() {
  try {
    const cacheService = CacheService.getScriptCache();
    const meta = readImageCacheMeta_();
    const chunkCount = meta ? Math.max(0, Number(meta.chunkCount) || 0) : 0;

    for (let index = 0; index < chunkCount; index += 1) {
      cacheService.remove(getImageCacheChunkKey_(index));
    }

    cacheService.remove(IMAGE_CACHE_STORE.META_KEY);
  } catch (error) {
    console.warn('clearImageCacheCacheService_ error:', error);
  }
}

function readImageCacheMeta_() {
  try {
    const raw = CacheService.getScriptCache().get(IMAGE_CACHE_STORE.META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (error) {
    console.warn('readImageCacheMeta_ error:', error);
    return null;
  }
}

function getImageCacheChunkKey_(index) {
  return IMAGE_CACHE_STORE.CHUNK_KEY_PREFIX + String(index);
}

function getImageCacheStoreTtlSeconds_() {
  const targetTtlSeconds = Math.max(1, Number(CONFIG.IMAGE_CACHE_TTL_HOURS) || 8) * 60 * 60;
  return Math.min(targetTtlSeconds, IMAGE_CACHE_STORE.MAX_CACHE_TTL_SECONDS);
}

// function buildDriveViewUrl_(fileId) {
//   return fileId ? `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}` : '';
// }

// function buildDriveViewUrl_(fileId) {
//   return fileId
//     ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
//     : '';
// }

function buildDriveViewUrl_(fileId) {
  return fileId
    ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`
    : '';
}

// Lấy danh sách nhân viên có sinh nhật trong tháng, có sử dụng cache để tối ưu hiệu năng. Dữ liệu được cache trong 10 phút 
// để tránh việc đọc sheet quá nhiều lần khi có nhiều người dùng truy cập cùng lúc.
function normalizeText_(value) {
  return String(value == null ? '' : value).trim();
}

function getAuthConfig() {
  try {
    const setupStatus = getAuthSetupStatus_();
    const captcha = setupStatus.hasCaptchaSecret ? createCaptchaChallenge_() : null;

    return {
      ok: true,
      configReady: setupStatus.ready,
      missingKeys: setupStatus.missingKeys,
      message: setupStatus.ready
        ? 'Cấu hình đăng nhập đã sẵn sàng.'
        : 'Thiếu Script Properties: ' + setupStatus.missingKeys.join(', '),
      sessionTtlHours: AUTH_CONFIG.SESSION_TTL_HOURS,
      otpTtlSeconds: AUTH_CONFIG.OTP_TTL_SECONDS,
      captcha: captcha,
    };
  } catch (error) {
    return mapAuthErrorResponse_(
      error,
      'Không thể tải cấu hình đăng nhập.',
      'AUTH_CONFIG_ERROR'
    );
  }
}

function requestOtp(payload) {
  try {
    ensureAuthSetup_([
      AUTH_CONFIG.PROP_SECRET_CODE,
      AUTH_CONFIG.PROP_CAPTCHA_SECRET,
    ]);
    const input = normalizeAuthPayload_(payload);
    const existingLock = getDeviceLockResponse_(input.deviceHash);
    if (existingLock) return existingLock;

    const validation = validateLoginInput_(input, { requireOtp: false });
    if (!validation.ok) return validation;

    const captchaCheck = validateCaptchaChallenge_(input.captchaId, input.captchaAnswer);
    if (!captchaCheck.ok) {
      registerFailedAttempt_(input.deviceHash);
      return captchaCheck;
    }

    const otpKey = buildOtpPropertyKey_(input.email, input.deviceHash);
    const activeOtp = readJsonScriptProperty_(otpKey);
    if (activeOtp && Number(activeOtp.expiresAt) > Date.now()) {
      return {
        ok: true,
        message: 'Mã OTP đã được gửi. Vui lòng kiểm tra email.',
        otpExpiresAt: Number(activeOtp.expiresAt),
        otpTtlSeconds: AUTH_CONFIG.OTP_TTL_SECONDS,
        alreadyActive: true,
      };
    }

    const otpCode = createOtpCode_();
    const expiresAt = Date.now() + AUTH_CONFIG.OTP_TTL_SECONDS * 1000;

    writeJsonScriptProperty_(otpKey, {
      email: input.email,
      deviceHash: input.deviceHash,
      otpHash: hashText_(otpCode),
      createdAt: Date.now(),
      expiresAt: expiresAt,
    });

    MailApp.sendEmail({
      to: input.email,
      subject: 'Mã OTP đăng nhập hệ thống Hành chính - Nhân sự',
      name: getMailSenderName_(),
      htmlBody: buildOtpEmailHtml_(input.email, otpCode, expiresAt),
    });

    return {
      ok: true,
      message: 'Đã gửi mã OTP về email của bạn.',
      otpExpiresAt: expiresAt,
      otpTtlSeconds: AUTH_CONFIG.OTP_TTL_SECONDS,
      alreadyActive: false,
    };
  } catch (error) {
    return mapAuthErrorResponse_(
      error,
      'Không thể gửi OTP.',
      'OTP_REQUEST_FAILED'
    );
  }
}

function login(payload) {
  try {
    ensureAuthSetup_([
      AUTH_CONFIG.PROP_SECRET_CODE,
    ]);
    const input = normalizeAuthPayload_(payload);
    const existingLock = getDeviceLockResponse_(input.deviceHash);
    if (existingLock) return existingLock;

    const validation = validateLoginInput_(input, { requireOtp: true });
    if (!validation.ok) return validation;

    const otpKey = buildOtpPropertyKey_(input.email, input.deviceHash);
    const otpRecord = readJsonScriptProperty_(otpKey);
    if (!otpRecord) {
      registerFailedAttempt_(input.deviceHash);
      return createAuthErrorResponse_(
        'Không tìm thấy mã OTP. Vui lòng gửi lại OTP mới.',
        'OTP_NOT_FOUND',
        { refreshOtp: true }
      );
    }

    if (Number(otpRecord.expiresAt) <= Date.now()) {
      deleteScriptProperty_(otpKey);
      registerFailedAttempt_(input.deviceHash);
      return createAuthErrorResponse_(
        'Mã OTP đã hết hạn. Vui lòng gửi lại OTP mới.',
        'OTP_EXPIRED',
        { refreshOtp: true }
      );
    }

    if (hashText_(input.otpCode) !== String(otpRecord.otpHash || '')) {
      const lockState = registerFailedAttempt_(input.deviceHash);
      if (lockState && Number(lockState.lockedUntil) > Date.now()) {
        return createAuthErrorResponse_(
          'Thiết bị đang tạm khóa do đăng nhập sai quá nhiều lần.',
          'DEVICE_LOCKED',
          { lockedUntil: Number(lockState.lockedUntil) }
        );
      }
      return createAuthErrorResponse_('Mã OTP không đúng.', 'OTP_INVALID');
    }

    deleteScriptProperty_(otpKey);
    clearFailedAttempts_(input.deviceHash);

    const session = createSessionRecord_(input.email, input.deviceHash);
    return {
      ok: true,
      message: 'Đăng nhập thành công.',
      sessionToken: session.token,
      sessionExpiresAt: session.expiresAt,
      sessionTtlHours: AUTH_CONFIG.SESSION_TTL_HOURS,
      user: {
        email: input.email,
      },
    };
  } catch (error) {
    return mapAuthErrorResponse_(
      error,
      'Đăng nhập thất bại.',
      'LOGIN_FAILED'
    );
  }
}

function loginWithFirebase(payload) {
  try {
    const input = isPlainObject_(payload) ? payload : {};
    const idToken = normalizeText_(input.idToken);
    if (!idToken) {
      return createAuthErrorResponse_(
        'Thieu Firebase Auth ID token.',
        'FIREBASE_TOKEN_REQUIRED'
      );
    }

    const verification = verifyFirebaseIdToken_(idToken);
    if (!verification.ok) return verification;

    const email = normalizeText_(verification.email).toLowerCase();
    const allowedEmails = getFirebaseAutoLoginEmails_();
    if (allowedEmails.indexOf(email) === -1) {
      return createAuthErrorResponse_(
        'Tai khoan Google nay khong duoc phep auto-login.',
        'FIREBASE_EMAIL_NOT_ALLOWED'
      );
    }

    const device = normalizeDeviceInfo_(input.device);
    const deviceHash = hashText_(JSON.stringify(device)).slice(0, 40);
    const session = createSessionRecord_(email, deviceHash);

    return {
      ok: true,
      message: 'Dang nhap bang Firebase Auth thanh cong.',
      sessionToken: session.token,
      sessionExpiresAt: session.expiresAt,
      sessionTtlHours: AUTH_CONFIG.SESSION_TTL_HOURS,
      user: {
        email: email,
        authProvider: 'firebase-google',
      },
    };
  } catch (error) {
    return mapAuthErrorResponse_(
      error,
      'Khong the dang nhap bang Firebase Auth.',
      'FIREBASE_LOGIN_FAILED'
    );
  }
}

function verifyFirebaseIdToken_(idToken) {
  const apiKey = getScriptPropertyValue_(AUTH_CONFIG.PROP_FIREBASE_API_KEY) || AUTH_CONFIG.FIREBASE_API_KEY_DEFAULT;
  if (!apiKey) {
    return createAuthErrorResponse_(
      'Chua cau hinh Firebase API key cho GAS.',
      'FIREBASE_AUTH_NOT_CONFIGURED',
      { missingKeys: [AUTH_CONFIG.PROP_FIREBASE_API_KEY] }
    );
  }

  const url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(apiKey);
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ idToken: idToken }),
    muteHttpExceptions: true,
  });
  const statusCode = response.getResponseCode();
  let body = null;
  try {
    body = JSON.parse(response.getContentText() || '{}');
  } catch (error) {
    body = null;
  }

  if (statusCode < 200 || statusCode >= 300) {
    return createAuthErrorResponse_(
      'Firebase Auth token khong hop le hoac da het han.',
      'FIREBASE_TOKEN_INVALID'
    );
  }

  const users = body && Array.isArray(body.users) ? body.users : [];
  const user = users.length ? users[0] : null;
  const email = normalizeText_(user && user.email).toLowerCase();
  if (!user || !isValidEmail_(email)) {
    return createAuthErrorResponse_(
      'Firebase Auth token khong co email hop le.',
      'FIREBASE_EMAIL_INVALID'
    );
  }

  if (user.emailVerified === false || String(user.emailVerified).toLowerCase() === 'false') {
    return createAuthErrorResponse_(
      'Email Google chua duoc xac minh.',
      'FIREBASE_EMAIL_NOT_VERIFIED'
    );
  }

  const providers = Array.isArray(user.providerUserInfo) ? user.providerUserInfo : [];
  const hasGoogleProvider = providers.some(function(provider) {
    return String(provider && provider.providerId || '').toLowerCase() === 'google.com';
  });
  if (!hasGoogleProvider) {
    return createAuthErrorResponse_(
      'Firebase Auth session khong phai Google provider.',
      'FIREBASE_PROVIDER_NOT_GOOGLE'
    );
  }

  return {
    ok: true,
    email: email,
  };
}

function getFirebaseAutoLoginEmails_() {
  const configured = getScriptPropertyValue_(AUTH_CONFIG.PROP_FIREBASE_AUTO_LOGIN_EMAILS);
  const source = configured
    ? configured.split(/[,\s;]+/)
    : AUTH_CONFIG.FIREBASE_AUTO_LOGIN_EMAILS;

  return source
    .map(function(email) { return normalizeText_(email).toLowerCase(); })
    .filter(function(email, index, list) {
      return isValidEmail_(email) && list.indexOf(email) === index;
    });
}

function logout(payload) {
  try {
    const token = resolveAuthToken_(payload);
    if (token) {
      deleteScriptProperty_(buildSessionPropertyKey_(token));
    }
    return {
      ok: true,
      message: 'Đã đăng xuất.',
    };
  } catch (error) {
    return createAuthErrorResponse_(
      error && error.message ? error.message : 'Không thể đăng xuất.',
      'LOGOUT_FAILED'
    );
  }
}

function getSessionInfo(payload) {
  try {
    const token = resolveAuthToken_(payload);
    if (!token) {
      return createAuthErrorResponse_(
        'Chưa có phiên đăng nhập hợp lệ.',
        'AUTH_REQUIRED'
      );
    }

    const sessionCheck = requireAuthenticatedSession_(token);
    if (!sessionCheck.ok) {
      return sessionCheck.response;
    }

    return {
      ok: true,
      authenticated: true,
      sessionExpiresAt: Number(sessionCheck.session.expiresAt),
      user: {
        email: String(sessionCheck.session.email || ''),
      },
    };
  } catch (error) {
    return createAuthErrorResponse_(
      error && error.message ? error.message : 'Không thể kiểm tra phiên đăng nhập.',
      'SESSION_INFO_FAILED'
    );
  }
}

function getOnlineUsers() {
  try {
    const props = PropertiesService.getScriptProperties();
    const allProps = props.getProperties();
    const now = Date.now();
    const usersByEmail = {};
    let activeSessions = 0;

    Object.keys(allProps).forEach(function(key) {
      if (key.indexOf(AUTH_CONFIG.SESSION_KEY_PREFIX) !== 0) return;
      const session = readJsonScriptProperty_(key);
      if (!session || Number(session.expiresAt) <= now) {
        deleteScriptProperty_(key);
        return;
      }

      const email = normalizeText_(session.email).toLowerCase();
      if (!email) return;
      activeSessions += 1;
      if (!usersByEmail[email] || Number(session.expiresAt) > Number(usersByEmail[email].expiresAt || 0)) {
        usersByEmail[email] = {
          email: email,
          expiresAt: Number(session.expiresAt),
          createdAt: Number(session.createdAt) || 0,
        };
      }
    });

    const users = Object.keys(usersByEmail)
      .sort(function(a, b) { return a.localeCompare(b); })
      .map(function(email) { return usersByEmail[email]; });

    return {
      ok: true,
      count: users.length,
      activeSessions: activeSessions,
      users: users,
      generatedAt: now,
    };
  } catch (error) {
    return createAuthErrorResponse_(
      error && error.message ? error.message : 'Không thể tải danh sách tài khoản online.',
      'ONLINE_USERS_FAILED'
    );
  }
}

function unwrapApiRequest_(data) {
  if (!isPlainObject_(data) || !Object.prototype.hasOwnProperty.call(data, '__payload')) {
    return {
      payload: data,
      authToken: '',
    };
  }

  return {
    payload: data.__payload,
    authToken: normalizeText_(data.__authToken),
  };
}

function isPublicApiAction_(action) {
  switch (action) {
    case 'getPage':
    case 'getAuthConfig':
    case 'requestOtp':
    case 'login':
    case 'loginWithFirebase':
    case 'logout':
    case 'getSessionInfo':
      return true;
    default:
      return false;
  }
}

function requireAuthenticatedSession_(token) {
  const authToken = normalizeText_(token);
  if (!authToken) {
    return {
      ok: false,
      response: createAuthErrorResponse_(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        'AUTH_REQUIRED'
      ),
    };
  }

  const key = buildSessionPropertyKey_(authToken);
  const session = readJsonScriptProperty_(key);
  if (!session) {
    return {
      ok: false,
      response: createAuthErrorResponse_(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        'SESSION_EXPIRED'
      ),
    };
  }

  if (Number(session.expiresAt) <= Date.now()) {
    deleteScriptProperty_(key);
    return {
      ok: false,
      response: createAuthErrorResponse_(
        'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
        'SESSION_EXPIRED'
      ),
    };
  }

  return {
    ok: true,
    session: session,
  };
}

function ensureAuthSetup_(requiredKeys) {
  const status = getAuthSetupStatus_();
  const required = Array.isArray(requiredKeys) && requiredKeys.length
    ? requiredKeys
    : [AUTH_CONFIG.PROP_SECRET_CODE, AUTH_CONFIG.PROP_CAPTCHA_SECRET];
  const missingKeys = required.filter(function (key) {
    return status.missingKeys.indexOf(key) !== -1;
  });

  if (missingKeys.length) {
    throw createAuthSetupError_(missingKeys);
  }
}

function normalizeAuthPayload_(payload) {
  const input = isPlainObject_(payload) ? payload : {};
  const email = normalizeText_(input.email).toLowerCase();
  const secretCode = normalizeText_(input.secretCode);
  const otpCode = normalizeText_(input.otpCode || input.otp);
  const captchaId = normalizeText_(input.captchaId);
  const captchaAnswer = normalizeText_(input.captchaAnswer);
  const device = normalizeDeviceInfo_(input.device);
  const deviceHash = hashText_(JSON.stringify(device)).slice(0, 40);

  return {
    email: email,
    secretCode: secretCode,
    otpCode: otpCode,
    captchaId: captchaId,
    captchaAnswer: captchaAnswer,
    device: device,
    deviceHash: deviceHash,
  };
}

function validateLoginInput_(input, options) {
  const config = options || {};
  if (!isValidEmail_(input.email)) {
    return createAuthErrorResponse_('Email không đúng định dạng.', 'EMAIL_INVALID');
  }

  const expectedSecret = getScriptPropertyValue_(AUTH_CONFIG.PROP_SECRET_CODE);
  if (!expectedSecret) {
    return createAuthErrorResponse_(
      'Thiếu Script Properties: ' + AUTH_CONFIG.PROP_SECRET_CODE,
      'AUTH_SETUP_INCOMPLETE',
      { missingKeys: [AUTH_CONFIG.PROP_SECRET_CODE] }
    );
  }

  if (!input.secretCode || input.secretCode !== expectedSecret) {
    registerFailedAttempt_(input.deviceHash);
    return createAuthErrorResponse_('Mã bí mật không đúng.', 'SECRET_INVALID');
  }

  if (config.requireOtp && !/^\d{6}$/.test(input.otpCode)) {
    return createAuthErrorResponse_('Mã OTP phải gồm 6 chữ số.', 'OTP_FORMAT_INVALID');
  }

  if (!config.requireOtp) {
    if (!input.captchaId || !input.captchaAnswer) {
      return createAuthErrorResponse_('Vui lòng nhập đầy đủ captcha.', 'CAPTCHA_REQUIRED');
    }
  }

  return { ok: true };
}

function createCaptchaChallenge_() {
  const secret = getScriptPropertyValue_(AUTH_CONFIG.PROP_CAPTCHA_SECRET);
  if (!secret) {
    throw createAuthSetupError_([AUTH_CONFIG.PROP_CAPTCHA_SECRET]);
  }
  const nonce = Utilities.getUuid().replace(/-/g, '');
  const digest = hashText_([secret, nonce, Date.now()].join(':'));
  const left = (parseInt(digest.slice(0, 2), 16) % 8) + 1;
  const right = (parseInt(digest.slice(2, 4), 16) % 8) + 1;
  const challengeId = Utilities.getUuid();
  const expiresAt = Date.now() + AUTH_CONFIG.CAPTCHA_TTL_SECONDS * 1000;

  CacheService.getScriptCache().put(
    AUTH_CONFIG.CAPTCHA_KEY_PREFIX + challengeId,
    JSON.stringify({
      answer: String(left + right),
      expiresAt: expiresAt,
    }),
    AUTH_CONFIG.CAPTCHA_TTL_SECONDS
  );

  return {
    id: challengeId,
    prompt: 'Nhập kết quả phép tính: ' + left + ' + ' + right,
    expiresAt: expiresAt,
  };
}

function validateCaptchaChallenge_(captchaId, captchaAnswer) {
  const id = normalizeText_(captchaId);
  const answer = normalizeText_(captchaAnswer);
  if (!id || !answer) {
    return createAuthErrorResponse_('Vui lòng nhập đầy đủ captcha.', 'CAPTCHA_REQUIRED');
  }

  const cacheKey = AUTH_CONFIG.CAPTCHA_KEY_PREFIX + id;
  const cached = CacheService.getScriptCache().get(cacheKey);
  if (!cached) {
    return createAuthErrorResponse_(
      'Captcha đã hết hạn. Vui lòng tải lại captcha mới.',
      'CAPTCHA_EXPIRED',
      { refreshCaptcha: true }
    );
  }

  let record = null;
  try {
    record = JSON.parse(cached);
  } catch (error) {
    record = null;
  }

  if (!record || Number(record.expiresAt) <= Date.now()) {
    CacheService.getScriptCache().remove(cacheKey);
    return createAuthErrorResponse_(
      'Captcha đã hết hạn. Vui lòng tải lại captcha mới.',
      'CAPTCHA_EXPIRED',
      { refreshCaptcha: true }
    );
  }

  if (String(record.answer || '') !== answer) {
    return createAuthErrorResponse_(
      'Captcha không chính xác.',
      'CAPTCHA_INVALID',
      { refreshCaptcha: true }
    );
  }

  CacheService.getScriptCache().remove(cacheKey);
  return { ok: true };
}

function createSessionRecord_(email, deviceHash) {
  const token = createRandomToken_();
  const expiresAt = Date.now() + AUTH_CONFIG.SESSION_TTL_HOURS * 60 * 60 * 1000;
  const session = {
    email: normalizeText_(email).toLowerCase(),
    deviceHash: normalizeText_(deviceHash),
    createdAt: Date.now(),
    expiresAt: expiresAt,
  };

  writeJsonScriptProperty_(buildSessionPropertyKey_(token), session);

  return {
    token: token,
    expiresAt: expiresAt,
  };
}

function getDeviceLockResponse_(deviceHash) {
  const record = readJsonScriptProperty_(buildLockPropertyKey_(deviceHash));
  if (!record || Number(record.lockedUntil) <= Date.now()) {
    return null;
  }

  return createAuthErrorResponse_(
    'Thiết bị này đang bị tạm khóa do đăng nhập sai quá nhiều lần.',
    'DEVICE_LOCKED',
    { lockedUntil: Number(record.lockedUntil) }
  );
}

function registerFailedAttempt_(deviceHash) {
  const key = buildLockPropertyKey_(deviceHash);
  const limits = getAuthLimitSettings_();
  const now = Date.now();
  let record = readJsonScriptProperty_(key) || {
    count: 0,
    firstAttemptAt: now,
    lockedUntil: 0,
  };

  if (Number(record.lockedUntil) > now) {
    return record;
  }

  if (!record.firstAttemptAt || now - Number(record.firstAttemptAt) > limits.windowMs) {
    record = {
      count: 0,
      firstAttemptAt: now,
      lockedUntil: 0,
    };
  }

  record.count = Number(record.count || 0) + 1;
  if (record.count >= limits.maxAttempts) {
    record.lockedUntil = now + limits.lockMs;
  }

  writeJsonScriptProperty_(key, record);
  return record;
}

function clearFailedAttempts_(deviceHash) {
  deleteScriptProperty_(buildLockPropertyKey_(deviceHash));
}

function getAuthLimitSettings_() {
  const scriptProps = PropertiesService.getScriptProperties();
  const maxAttempts = Math.max(1, Number(scriptProps.getProperty(AUTH_CONFIG.PROP_MAX_ATTEMPTS) || AUTH_CONFIG.DEFAULT_MAX_ATTEMPTS));
  const windowMinutes = Math.max(1, Number(scriptProps.getProperty(AUTH_CONFIG.PROP_ATTEMPT_WINDOW_MINUTES) || AUTH_CONFIG.DEFAULT_ATTEMPT_WINDOW_MINUTES));
  const lockMinutes = Math.max(1, Number(scriptProps.getProperty(AUTH_CONFIG.PROP_LOCK_MINUTES) || AUTH_CONFIG.DEFAULT_LOCK_MINUTES));

  return {
    maxAttempts: maxAttempts,
    windowMs: windowMinutes * 60 * 1000,
    lockMs: lockMinutes * 60 * 1000,
  };
}

function resolveAuthToken_(payload) {
  return isPlainObject_(payload)
    ? normalizeText_(payload.authToken || payload.token)
    : '';
}

function normalizeDeviceInfo_(device) {
  const input = isPlainObject_(device) ? device : {};
  return {
    userAgent: normalizeText_(input.userAgent).slice(0, 400),
    platform: normalizeText_(input.platform).slice(0, 100),
    language: normalizeText_(input.language).slice(0, 50),
    timezone: normalizeText_(input.timezone).slice(0, 80),
    screen: normalizeText_(input.screen).slice(0, 40),
    colorDepth: normalizeText_(input.colorDepth).slice(0, 10),
    hardwareConcurrency: normalizeText_(input.hardwareConcurrency).slice(0, 10),
    deviceMemory: normalizeText_(input.deviceMemory).slice(0, 10),
    touch: Boolean(input.touch) ? '1' : '0',
  };
}

function isValidEmail_(email) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(normalizeText_(email));
}

function createOtpCode_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function createRandomToken_() {
  return Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
}

function getMailSenderName_() {
  const configured = normalizeText_(PropertiesService.getScriptProperties().getProperty(AUTH_CONFIG.PROP_MAIL_SENDER_NAME));
  return configured || 'HR Admin';
}

function buildOtpEmailHtml_(email, otpCode, expiresAt) {
  const expireTime = Utilities.formatDate(
    new Date(expiresAt),
    Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh',
    'dd/MM/yyyy HH:mm:ss'
  );

  return [
    '<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937">',
    '<h2 style="margin:0 0 12px">Xac thuc dang nhap</h2>',
    '<p>Email dang nhap: <strong>' + sanitizeHtmlText_(email) + '</strong></p>',
    '<p>Mã OTP của bạn là:</p>',
    '<div style="font-size:28px;font-weight:700;letter-spacing:6px;padding:14px 18px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;display:inline-block;color:#1d4ed8">' + sanitizeHtmlText_(otpCode) + '</div>',
    '<p style="margin-top:16px">Mã có hiệu lực đến <strong>' + sanitizeHtmlText_(expireTime) + '</strong> và sẽ hết hạn sau 3 phút.</p>',
    '<p style="color:#6b7280">Nếu bạn không yêu cầu đăng nhập, vui lòng bỏ qua email này.</p>',
    '</div>',
  ].join('');
}

function createAuthErrorResponse_(message, code, extra) {
  return Object.assign({
    ok: false,
    error: message,
    code: code,
  }, extra || {});
}

function mapAuthErrorResponse_(error, fallbackMessage, fallbackCode) {
  const message = error && error.message ? error.message : fallbackMessage;
  const code = error && error.code ? error.code : fallbackCode;
  const extra = {};

  if (error && Array.isArray(error.missingKeys) && error.missingKeys.length) {
    extra.missingKeys = error.missingKeys.slice();
  }

  return createAuthErrorResponse_(message, code, extra);
}

function readJsonScriptProperty_(key) {
  try {
    const raw = PropertiesService.getScriptProperties().getProperty(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function writeJsonScriptProperty_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, JSON.stringify(value));
}

function deleteScriptProperty_(key) {
  PropertiesService.getScriptProperties().deleteProperty(key);
}

function buildOtpPropertyKey_(email, deviceHash) {
  return AUTH_CONFIG.OTP_KEY_PREFIX + hashText_([normalizeText_(email).toLowerCase(), normalizeText_(deviceHash)].join(':')).slice(0, 40);
}

function buildSessionPropertyKey_(token) {
  return AUTH_CONFIG.SESSION_KEY_PREFIX + hashText_(normalizeText_(token)).slice(0, 40);
}

function buildLockPropertyKey_(deviceHash) {
  return AUTH_CONFIG.LOCK_KEY_PREFIX + hashText_(normalizeText_(deviceHash)).slice(0, 40);
}

function getAuthSetupStatus_() {
  const secretCode = getScriptPropertyValue_(AUTH_CONFIG.PROP_SECRET_CODE);
  const captchaSecret = getScriptPropertyValue_(AUTH_CONFIG.PROP_CAPTCHA_SECRET);
  const missingKeys = [];

  if (!secretCode) missingKeys.push(AUTH_CONFIG.PROP_SECRET_CODE);
  if (!captchaSecret) missingKeys.push(AUTH_CONFIG.PROP_CAPTCHA_SECRET);

  return {
    ready: missingKeys.length === 0,
    missingKeys: missingKeys,
    hasSecretCode: Boolean(secretCode),
    hasCaptchaSecret: Boolean(captchaSecret),
  };
}

function createAuthSetupError_(missingKeys) {
  const keys = Array.isArray(missingKeys) ? missingKeys.filter(Boolean) : [];
  const error = new Error('Thiếu Script Properties: ' + keys.join(', '));
  error.code = 'AUTH_SETUP_INCOMPLETE';
  error.missingKeys = keys;
  return error;
}

function getRequiredScriptProperty_(key) {
  const value = normalizeText_(PropertiesService.getScriptProperties().getProperty(key));
  if (!value) {
    throw new Error('Thiếu Script Property bắt buộc: ' + key);
  }
  return value;
}

function getScriptPropertyValue_(key) {
  return normalizeText_(PropertiesService.getScriptProperties().getProperty(key));
}

function hashText_(value) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value == null ? '' : value));
  return bytes.map(function (byte) {
    const normalized = byte < 0 ? byte + 256 : byte;
    return ('0' + normalized.toString(16)).slice(-2);
  }).join('');
}

function isPlainObject_(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function sanitizeHtmlText_(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
