/**
 * Google Apps Script Web App for Room Weather Data
 * 
 * SETUP INSTRUCTIONS:
 * 1. Open your Google Sheet with ESP32 sensor data
 * 2. Go to Extensions → Apps Script
 * 3. Replace the existing code with this file
 * 4. Save the project
 * 5. Click Deploy → New deployment
 * 6. Select type: Web app
 * 7. Configure:
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 8. Click Deploy
 * 9. Copy the deployment URL
 * 10. Paste the URL into app.js CONFIG.GOOGLE_SHEETS_API_URL
 */

// ========================================
// CONFIGURATION
// ========================================
const API_CONFIG = {
  // Rate limiting: Max requests per minute per IP
  RATE_LIMIT: 60,
  
  // CORS: Allowed origins (use '*' for development, specific domain for production)
  // For production, replace with your domain: 'https://yourdomain.com'
  ALLOWED_ORIGINS: '*',
  
  // Maximum rows to return (prevent abuse)
  MAX_ROWS: 1000,
  
  // Cache duration in seconds (reduce API calls)
  CACHE_DURATION: 30,
};

// ========================================
// RATE LIMITING
// ========================================
const rateLimitCache = CacheService.getScriptCache();

function checkRateLimit(identifier) {
  const cacheKey = 'ratelimit_' + identifier;
  const cached = rateLimitCache.get(cacheKey);
  
  if (cached) {
    const count = parseInt(cached);
    if (count >= API_CONFIG.RATE_LIMIT) {
      return false; // Rate limit exceeded
    }
    rateLimitCache.put(cacheKey, (count + 1).toString(), 60); // Increment for 1 minute
  } else {
    rateLimitCache.put(cacheKey, '1', 60); // First request
  }
  
  return true;
}

// ========================================
// MAIN GET HANDLER
// ========================================
function doGet(e) {
  try {
    // Get client IP for rate limiting (approximate)
    const identifier = e.parameter.userip || 'anonymous';
    
    // Check rate limit
    if (!checkRateLimit(identifier)) {
      return createJsonResponse({
        error: 'Rate limit exceeded. Please try again later.'
      }, 429);
    }
    
    // Try to get from cache first
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get('sensor_data');
    
    if (cachedData) {
      Logger.log('Returning cached data');
      return createJsonResponse(JSON.parse(cachedData), 200);
    }
    
    // Fetch fresh data
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    const data = getSensorData(sheet);
    
    // Cache the data
    cache.put('sensor_data', JSON.stringify(data), API_CONFIG.CACHE_DURATION);
    
    return createJsonResponse(data, 200);
    
  } catch (error) {
    Logger.log('Error in doGet: ' + error.toString());
    return createJsonResponse({
      error: 'Internal server error',
      message: error.toString()
    }, 500);
  }
}

// ========================================
// DATA PROCESSING
// ========================================
function getSensorData(sheet) {
  // Get all data from the sheet
  const lastRow = sheet.getLastRow();
  
  if (lastRow <= 1) {
    // Only headers exist or sheet is empty
    return [];
  }
  
  // Limit rows to prevent abuse
  const startRow = Math.max(2, lastRow - API_CONFIG.MAX_ROWS + 1);
  const numRows = lastRow - startRow + 1;
  
  // Get data range (skip header row)
  const range = sheet.getRange(startRow, 1, numRows, 5); // 5 columns: Timestamp, Temp, Humidity, Status, Raw
  const values = range.getValues();
  
  // Process data
  const processedData = values
    .filter(row => row[0] && row[1] && row[2]) // Filter out empty rows
    .map(row => ({
      timestamp: formatTimestamp(row[0]),
      temp: parseFloat(row[1]) || 0,
      hum: parseFloat(row[2]) || 0,
      status: row[3] || 'Unknown'
    }));
  
  return processedData;
}

/**
 * Format timestamp to ISO 8601 string
 */
function formatTimestamp(timestamp) {
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  // Try to parse as date
  const date = new Date(timestamp);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  
  // Return as-is if can't parse
  return timestamp.toString();
}

// ========================================
// RESPONSE HELPERS
// ========================================
function createJsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  
  // Add CORS headers
  const headers = {
    'Access-Control-Allow-Origin': API_CONFIG.ALLOWED_ORIGINS,
    'Access-Control-Allow-Methods': 'GET',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
  
  // Note: Apps Script doesn't support custom status codes directly
  // The statusCode parameter is for documentation purposes
  
  return output;
}

// ========================================
// TESTING FUNCTION
// ========================================
/**
 * Test function to verify the API works
 * Run this from the Apps Script editor to test
 */
function testApi() {
  const result = doGet({ parameter: {} });
  const content = result.getContent();
  Logger.log(content);
  
  const data = JSON.parse(content);
  Logger.log('Total records: ' + data.length);
  
  if (data.length > 0) {
    Logger.log('Latest reading:');
    Logger.log(data[data.length - 1]);
  }
}
