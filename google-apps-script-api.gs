/**
 * Google Apps Script Web App for Room Weather Data (TOO COLD)
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet
 * 2. Extensions > Apps Script
 * 3. Paste this entire file
 * 4. Deploy > New Deployment > Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 5. Copy URL to your ESP32 code and config.js
 */

// ========================================
// CONFIGURATION
// ========================================
const SECRET_KEY = "l,8MD_<e£C/jIoZ)U2EeYQ8Z@:VL}8I}&Q#fA3NBi>N0bf0];f"; // Must match ESP32
const MAX_ROWS = 1000;         // Keep last 1000 readings
const RATE_LIMIT_MIN = 60;     // Max 60 requests/min per IP

// ========================================
// POST HANDLER (ESP32 WRITES DATA)
// ========================================
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10s

  try {
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    
    // 1. SECURITY CHECK
    if (data.key !== SECRET_KEY) {
      return ContentService.createTextOutput("Unauthorized").setMimeType(ContentService.MimeType.TEXT);
    }
    
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 2. AUTO-SETUP HEADERS
    if (sheet.getLastRow() === 0) {
      var headers = ["Timestamp", "Temperature (°C)", "Humidity (%)", "Status", "Raw Data"];
      sheet.appendRow(headers);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    // 3. ADD ROW
    sheet.appendRow([
      new Date(),
      data.temp,
      data.hum,
      data.status,
      rawData
    ]);
    
    // 4. CLEANUP OLD DATA (Optional, keeps sheet fast)
    var totalRows = sheet.getLastRow();
    if (totalRows > MAX_ROWS + 100) {
      sheet.deleteRows(2, totalRows - MAX_ROWS);
    }
    
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    return ContentService.createTextOutput("Error: " + err.message);
  } finally {
    lock.releaseLock();
  }
}

// ========================================
// GET HANDLER (DASHBOARD READS DATA)
// ========================================
function doGet(e) {
  // Rate Limiting (Basic)
  var cache = CacheService.getScriptCache();
  var ip = (e.parameter && e.parameter.userip) ? e.parameter.userip : "anon";
  var count = cache.get(ip);
  if (count && parseInt(count) > RATE_LIMIT_MIN) {
     return jsonResponse({error: "Rate limit exceeded"}, 429);
  }
  cache.put(ip, count ? parseInt(count) + 1 : 1, 60);

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = getRecentData(sheet);
    return jsonResponse(data);
    
  } catch (error) {
    return jsonResponse({error: error.toString()}, 500);
  }
}

// Helper to get last 50 rows efficiently
function getRecentData(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  var startRow = Math.max(2, lastRow - 49); // Last 50 rows
  var numRows = lastRow - startRow + 1;
  var range = sheet.getRange(startRow, 1, numRows, 4); // Columns A-D
  var values = range.getValues();
  
  return values.map(function(row) {
    return {
      timestamp: row[0],
      temp: row[1],
      hum: row[2],
      status: row[3]
    };
  });
}

// Helper for JSON/CORS
function jsonResponse(data, status) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
