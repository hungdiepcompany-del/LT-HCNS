const CONFIG = Object.freeze({
  SHEET_NAME: 'DANH SÁCH NHÂN VIÊN',
  FIRST_DATA_ROW: 3,
  FOLDER_ID: '1SlEICe48ZAhPbycCgfcttwCbtdr5U3bP',
  MENU_NAME: '🔑Quản lý',
  MENU_ITEM_OPEN: '👉 mở MENU',
  MENU_REFRESH_IMAGE: '🔄 Refresh ảnh',
  MENU_EMPLOYEE_LIST: '📋 Mở Web Danh sách nhân sự',

  WEB_APP_URL: 'https://script.google.com/macros/s/AKfycbx4mk1YSyGvVd9f2PwNwjSG_l1TtITJKzBAI9BK6OOiAS-FXtrEKOnJwIxGIdLsjjOw/exec',
  
  PROP_SELECTED_PROFILE: 'selected_employee_profile_v2',
  PROP_PROFILE_VERSION: 'selected_employee_profile_version_v1',
  PROP_IMAGE_CACHE: 'employee_image_cache_v2',
  PROP_IMAGE_CACHE_UPDATED_AT: 'employee_image_cache_updated_at_v1',
  PROP_DEFAULT_IMAGE_FILE_ID: 'employee_default_image_file_id_v1',
  IMAGE_CACHE_TTL_HOURS: 24,
  IMAGE_CACHE_REFRESH_HOUR: 2,
  DEFAULT_DEPARTMENT_PAGE_SIZE: 4,
  DATA_SHEET_NAME: 'Data',
  COLUMNS: Object.freeze({
    CODE: 3, NAME: 4, DEPARTMENT: 5, START_DATE: 6, GENDER: 10, BIRTH_DATE: 11, ID_NUMBER: 15, SOCIAL_INSURANCE: 16,
    EMAIL: 18, PHONE: 19, TEMP_ADDR_1: 20, TEMP_ADDR_2: 21, TEMP_ADDR_3: 22, CONTRACT_TYPE: 27, NOTES: 28, STATUS: 29,
  }),
});

const RUNTIME_CACHE = Object.create(null);

function getSheetData_(sheetName, startRow, startCol, numCols) {
  try {
    const cacheKey = [sheetName, startRow, startCol, numCols].join('|');
    if (RUNTIME_CACHE[cacheKey]) return RUNTIME_CACHE[cacheKey];

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < startRow) return [];

    const values = sheet.getRange(startRow, startCol, lastRow - startRow + 1, numCols).getDisplayValues();
    RUNTIME_CACHE[cacheKey] = values;
    return values;
  } catch (error) {
    console.error('getSheetData_ error:', error);
    return [];
  }
}

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu(CONFIG.MENU_NAME)
      .addItem(CONFIG.MENU_ITEM_OPEN, 'showEmployeeProfileSidebar')
      .addItem(CONFIG.MENU_REFRESH_IMAGE, 'rebuildImageCache_')
      .addItem(CONFIG.MENU_EMPLOYEE_LIST, 'openWebApp')
      .addToUi();
    ensureImageCacheRefreshTrigger_();
  } catch (error) {
    console.error('onOpen error:', error);
  }
}

function openWebApp() {
  try {
    const url = CONFIG.WEB_APP_URL;
    const html = HtmlService.createHtmlOutput(`<div style="padding:20px;font-family:sans-serif"><h3>Quản lý nhân sự</h3><button onclick="window.open('${url}', '_blank')" style="padding:10px 15px;border:none;background:#1a73e8;color:#fff;border-radius:6px;cursor:pointer">Mở Web App</button></div>`);
    SpreadsheetApp.getUi().showSidebar(html);
  } catch (error) {
    console.error('openWebApp error:', error);
  }
}

function onSelectionChange(e) {
  try {
    if (!e || !e.range) return;
    const range = e.range;
    const sheet = range.getSheet();
    if (!sheet || sheet.getName() !== CONFIG.SHEET_NAME || range.getNumRows() !== 1 || range.getNumColumns() !== 1 || range.getRow() < CONFIG.FIRST_DATA_ROW) return;

    const profile = buildProfileFromRow_(sheet, range.getRow());
    const docProps = PropertiesService.getDocumentProperties();
    if (!profile || !profile.code || !profile.name) {
      docProps.deleteProperty(CONFIG.PROP_SELECTED_PROFILE);
    } else {
      docProps.setProperty(CONFIG.PROP_SELECTED_PROFILE, JSON.stringify(profile));
    }
    docProps.setProperty(CONFIG.PROP_PROFILE_VERSION, String(Date.now()));
  } catch (error) {
    console.error('onSelectionChange error:', error);
  }
}

function showEmployeeProfileSidebar() {
  try {
    const template = HtmlService.createTemplateFromFile('sidebar');
    template.mode = 'sidebar';
    SpreadsheetApp.getUi().showSidebar(template.evaluate().setTitle('Nhân sự'));
  } catch (error) {
    console.error('showEmployeeProfileSidebar error:', error);
  }
}

function openFullProfile() {
  try {
    const template = HtmlService.createTemplateFromFile('sidebar');
    template.mode = 'modal';
    SpreadsheetApp.getUi().showModalDialog(template.evaluate().setWidth(1700).setHeight(1000), 'Chi tiết hồ sơ nhân sự');
  } catch (error) {
    console.error('openFullProfile error:', error);
  }
}

function getDepartmentList() {
  try {
    const values = getSheetData_(CONFIG.DATA_SHEET_NAME, 5, 3, 1);
    const bucket = Object.create(null);
    values.forEach((row) => {
      const department = normalizeText_(row[0]);
      if (department) bucket[department] = true;
    });
    const list = Object.keys(bucket).sort((a, b) => a.localeCompare(b, 'vi'));
    return { ok: true, data: list };
  } catch (error) {
    console.error('getDepartmentList error:', error);
    return { ok: false, message: 'Không thể tải danh sách bộ phận', data: [] };
  }
}

function openDepartmentDetail(departmentName) {
  try {
    const template = HtmlService.createTemplateFromFile('department');
    template.departmentName = normalizeText_(departmentName) || '-';
    SpreadsheetApp.getUi().showModalDialog(template.evaluate().setWidth(1700).setHeight(1000), 'Chi tiết bộ phận');
  } catch (error) {
    console.error('openDepartmentDetail error:', error);
  }
}

function getDepartmentEmployees(departmentName, page, pageSize) {
  try {
    const targetDepartment = normalizeText_(departmentName).toLowerCase();
    const currentPage = Math.max(1, Number(page) || 1);
    const normalizedPageSize = Math.max(1, Number(pageSize) || CONFIG.DEFAULT_DEPARTMENT_PAGE_SIZE);

    if (!targetDepartment) {
      return { ok: false, message: 'Vui lòng chọn bộ phận', data: [], total: 0, totalPages: 0, page: currentPage, pageSize: normalizedPageSize };
    }

    const values = getSheetData_(CONFIG.SHEET_NAME, CONFIG.FIRST_DATA_ROW, 1, CONFIG.COLUMNS.STATUS);
    if (!values.length) {
      return { ok: true, data: [], total: 0, totalPages: 0, page: currentPage, pageSize: normalizedPageSize };
    }

    const matchedIndexes = [];
    const departmentIndex = CONFIG.COLUMNS.DEPARTMENT - 1;
    values.forEach((rowValues, index) => {
      const department = normalizeText_(rowValues[departmentIndex]);
      if (department.toLowerCase() === targetDepartment) matchedIndexes.push(index);
    });

    const total = matchedIndexes.length;
    const totalPages = total > 0 ? Math.ceil(total / normalizedPageSize) : 0;
    const safePage = totalPages > 0 ? Math.min(currentPage, totalPages) : 1;
    const start = (safePage - 1) * normalizedPageSize;
    const pageIndexes = matchedIndexes.slice(start, start + normalizedPageSize);

    const imageMap = getEmployeeImageMap_();
    const pageData = pageIndexes
      .map((matchedIndex) => {
        const rowValues = values[matchedIndex];
        const profile = buildProfileFromRowValues_(rowValues, CONFIG.FIRST_DATA_ROW + matchedIndex);
        if (!profile || !profile.code || !profile.name) return null;
        profile.imageUrl = getEmployeeImageUrl(profile.code, imageMap);
        return profile;
      })
      .filter(Boolean);

    return { ok: true, data: pageData, total, totalPages, page: safePage, pageSize: normalizedPageSize };
  } catch (error) {
    console.error('getDepartmentEmployees error:', error);
    return { ok: false, message: 'Không thể tải dữ liệu bộ phận', data: [], total: 0, totalPages: 0, page: Math.max(1, Number(page) || 1), pageSize: Math.max(1, Number(pageSize) || CONFIG.DEFAULT_DEPARTMENT_PAGE_SIZE) };
  }
}

function getProfileVersion() {
  try {
    const docProps = PropertiesService.getDocumentProperties();
    return { ok: true, version: docProps.getProperty(CONFIG.PROP_PROFILE_VERSION) || '' };
  } catch (error) {
    console.error('getProfileVersion error:', error);
    return { ok: false, version: '' };
  }
}

function getCurrentProfile() {
  try {
    const docProps = PropertiesService.getDocumentProperties();
    const raw = docProps.getProperty(CONFIG.PROP_SELECTED_PROFILE);
    if (!raw) return { ok: false, message: 'Vui lòng chọn nhân viên' };

    const profile = JSON.parse(raw);
    if (!profile || !profile.code || !profile.name) return { ok: false, message: 'Vui lòng chọn nhân viên' };

    profile.imageUrl = getEmployeeImageUrl(profile.code);
    return { ok: true, data: profile };
  } catch (error) {
    console.error('getCurrentProfile error:', error);
    return { ok: false, message: 'Không thể tải dữ liệu' };
  }
}

function getEmployeeImageUrl(employeeCode, imageMap = null) {
  try {
    if (!employeeCode) return '';
    
    const code = normalizeText_(employeeCode).toUpperCase();
    const map = imageMap || getEmployeeImageMap_();
    
    if (!map || Object.keys(map).length === 0) return '';
    
    let fileId = normalizeText_(map[code]) || normalizeText_(map._NO_IMAGE);
    return fileId ? buildDriveViewUrl_(fileId) : '';
  } catch (error) {
    console.error('getEmployeeImageUrl error:', error);
    return '';
  }
}

function rebuildImageCache_() {
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    const cache = { _NO_IMAGE: '' };
    
    try {
      const folder = DriveApp.getFolderById(CONFIG.FOLDER_ID);
      const files = folder.getFiles();
      
      while (files.hasNext()) {
        try {
          const file = files.next();
          const fileId = normalizeText_(file.getId());
          const fileName = normalizeText_(file.getName());
          if (!fileId || !fileName) continue;
          
          const name = fileName.toLowerCase().replace(/[\s_-]+/g, '');
          if (name.includes('noimage')) {
            cache._NO_IMAGE = fileId;
            continue;
          }
          
          const fileCode = extractCodeFromFileName_(fileName);
          if (fileCode && !cache[fileCode]) {
            cache[fileCode] = fileId;
          }
        } catch (fileError) {
          console.warn('Error processing file:', fileError.message);
        }
      }
    } catch (driveError) {
      console.error('Drive API error during cache rebuild:', driveError);
    }
    
    if (!cache._NO_IMAGE) {
      const fallback = normalizeText_(scriptProps.getProperty(CONFIG.PROP_DEFAULT_IMAGE_FILE_ID));
      if (fallback) cache._NO_IMAGE = fallback;
    }
    
    persistImageCache_(scriptProps, cache);
    scriptProps.setProperty(CONFIG.PROP_IMAGE_CACHE_UPDATED_AT, String(Date.now()));
    
    CacheService.getScriptCache().put(CONFIG.PROP_IMAGE_CACHE, JSON.stringify(cache), 3600);
    return cache;
  } catch (error) {
    console.error('rebuildImageCache_ error:', error);
    return { _NO_IMAGE: '' };
  }
}

function refreshImageCacheBySchedule() {
  try {
    rebuildImageCache_();
  } catch (error) {
    console.error('refreshImageCacheBySchedule error:', error);
  }
}

function ensureImageCacheRefreshTrigger_() {
  try {
    const triggerExists = ScriptApp.getProjectTriggers().some(
      trigger => trigger.getHandlerFunction() === 'refreshImageCacheBySchedule' && 
                  trigger.getEventType() === ScriptApp.EventType.CLOCK
    );
    if (triggerExists) return;
    
    ScriptApp.newTrigger('refreshImageCacheBySchedule')
      .timeBased()
      .everyDays(1)
      .atHour(CONFIG.IMAGE_CACHE_REFRESH_HOUR)
      .create();
  } catch (error) {
    console.error('ensureImageCacheRefreshTrigger_ error:', error);
  }
}

function isImageCacheExpired_(scriptProps) {
  const updatedAt = Number(scriptProps.getProperty(CONFIG.PROP_IMAGE_CACHE_UPDATED_AT) || 0);
  if (!updatedAt) return true;
  const ageMs = Date.now() - updatedAt;
  const ttlMs = Math.max(1, Number(CONFIG.IMAGE_CACHE_TTL_HOURS) || 24) * 60 * 60 * 1000;
  return ageMs >= ttlMs;
}

function buildProfileFromRow_(sheet, row) {
  try {
    const col = CONFIG.COLUMNS;
    const rowValues = sheet.getRange(row, 1, 1, col.STATUS).getDisplayValues()[0];
    return buildProfileFromRowValues_(rowValues, row);
  } catch (error) {
    console.error('buildProfileFromRow_ error:', error);
    return null;
  }
}

function buildProfileFromRowValues_(rowValues, row) {
  try {
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

    const tempAddress = [
      normalizeText_(rowValues[col.TEMP_ADDR_1 - 1]),
      normalizeText_(rowValues[col.TEMP_ADDR_2 - 1]),
      normalizeText_(rowValues[col.TEMP_ADDR_3 - 1]),
    ].filter(Boolean).join(', ');

    return {
      code, name, gender, department, status, birthDate, phone, idNumber,
      socialInsurance, email, tempAddress, notes: notes || '-', startDate, contractType,
      imageUrl: '', row, updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('buildProfileFromRowValues_ error:', error);
    return null;
  }
}


function getPage(name) {
  try {
    return HtmlService.createHtmlOutputFromFile(name).getContent();
  } catch (error) {
    console.error('getPage error:', error);
    return '';
  }
}

function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (error) {
    console.error('include error:', error);
    return '';
  }
}

function setProfileVersion_(docProps, version) {
  try {
    if (!version) {
      docProps.deleteProperty(CONFIG.PROP_PROFILE_VERSION);
    } else {
      docProps.setProperty(CONFIG.PROP_PROFILE_VERSION, version);
    }
  } catch (error) {
    console.error('setProfileVersion_ error:', error);
  }
}

function extractCodeFromFileName_(fileName) {
  try {
    const match = normalizeText_(fileName).toUpperCase().match(/^([A-Z0-9]+)/);
    return match ? match[1] : '';
  } catch (error) {
    console.error('extractCodeFromFileName_ error:', error);
    return '';
  }
}

function readImageCache_(scriptProps) {
  try {
    const cached = CacheService.getScriptCache().get(CONFIG.PROP_IMAGE_CACHE);
    if (cached) return JSON.parse(cached);
    
    const raw = scriptProps.getProperty(CONFIG.PROP_IMAGE_CACHE);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.warn('readImageCache_ error:', error);
    return {};
  }
}

function persistImageCache_(scriptProps, cache) {
  try {
    scriptProps.setProperty(CONFIG.PROP_IMAGE_CACHE, JSON.stringify(cache));
    CacheService.getScriptCache().put(CONFIG.PROP_IMAGE_CACHE, JSON.stringify(cache), 3600);
  } catch (error) {
    console.warn('persistImageCache_ error:', error);
  }
}

function buildDriveViewUrl_(fileId) {
  try {
    return fileId ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w400` : '';
  } catch (error) {
    console.error('buildDriveViewUrl_ error:', error);
    return '';
  }
}

function normalizeText_(value) {
  try {
    return String(value == null ? '' : value).trim();
  } catch (error) {
    console.error('normalizeText_ error:', error);
    return '';
  }
}

function getEmployeeImageMap_() {
  try {
    const scriptProps = PropertiesService.getScriptProperties();
    let cache = readImageCache_(scriptProps);
    
    if (cache && Object.keys(cache).length > 0 && !isImageCacheExpired_(scriptProps)) {
      return cache;
    }
    
    return rebuildImageCache_();
  } catch (error) {
    console.error('getEmployeeImageMap_ error:', error);
    return {};
  }
}

function isImageCacheExpired_(scriptProps) {
  try {
    const updatedAt = Number(scriptProps.getProperty(CONFIG.PROP_IMAGE_CACHE_UPDATED_AT) || 0);
    if (!updatedAt) return true;
    const ageMs = Date.now() - updatedAt;
    const ttlMs = Math.max(1, Number(CONFIG.IMAGE_CACHE_TTL_HOURS) || 24) * 60 * 60 * 1000;
    return ageMs >= ttlMs;
  } catch (error) {
    console.error('isImageCacheExpired_ error:', error);
    return true;
  }
}

