Well your task is simple I have used a esp32 and am currently fetching data from its attached sensor and sending it to a google sheet

I am attaching the code of the google sheet your task is to create a seamless , minimal modern mobile first web app which showcases the primary things , highlights the max , minimum and average temperature or humidity , you are also to create adequate graphics or images for a more visually appealing application and also create security features in order to prevent abuse .
the example of data --> 
12/24/2025 14:31:21	21.5	72.200008	Live	
12/24/2025 14:31:37	21.4	72.6	Live	
12/24/2025 14:31:51	21.300002	73.4	Live	{"status": "Live", "hum": 73.4, "temp": 21.300002}
12/24/2025 14:32:07	21.2	73.6	Live	{"status": "Live", "hum": 73.6, "temp": 21.2}
12/24/2025 14:32:22	21.1	74.6	Live	{"status": "Live", "hum": 74.6, "temp": 21.1}
12/24/2025 14:32:35	21	75.8	Live	{"status": "Live", "hum": 75.8, "temp": 21.0}
12/24/2025 14:32:50	21	75.700008	Live	{"status": "Live", "hum": 75.700008, "temp": 21.0}
12/24/2025 14:33:04	20.9	75.4	Live	{"status": "Live", "hum": 75.4, "temp": 20.9}
12/24/2025 14:33:19	20.9	75.4	Live	{"status": "Live", "hum": 75.4, "temp": 20.9}
12/24/2025 14:33:35	20.800002	75.8	Live	{"status": "Live", "hum": 75.8, "temp": 20.800002}
12/24/2025 14:33:50	20.800002	75.700008	Live	{"status": "Live", "hum": 75.700008, "temp": 20.800002}
12/24/2025 14:35:07	20.7	76.3	Live	{"status": "Live", "hum": 76.3, "temp": 20.7}
12/24/2025 14:36:12	20.7	76.9	Live	{"status": "Live", "hum": 76.9, "temp": 20.7}
12/24/2025 14:37:17	20.7	76.9	Live	{"status": "Live", "hum": 76.9, "temp": 20.7}
12/24/2025 14:38:22	20.800002	76.5	Live	{"status": "Live", "hum": 76.5, "temp": 20.800002}
12/24/2025 14:39:27	20.800002	76.3	Live	{"status": "Live", "hum": 76.3, "temp": 20.800002}
12/24/2025 14:40:34	20.9	76.4	Live	{"status": "Live", "hum": 76.4, "temp": 20.9}


the google sheet code --> function doPost(e) {
  // 1. LOCK SERVICE: Prevents "collisions" if multiple attempts happen at once
  var lock = LockService.getScriptLock();
  lock.tryLock(10000); // Wait up to 10 seconds for other processes to finish

  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    
    // 2. PARSE DATA: Read the JSON sent by ESP32
    var rawData = e.postData.contents;
    var data = JSON.parse(rawData);
    
    // 3. AUTO-SETUP: If the sheet is empty, add Headers automatically
    if (sheet.getLastRow() === 0) {
      var headers = ["Timestamp", "Temperature (°C)", "Humidity (%)", "Status", "Raw Data"];
      sheet.appendRow(headers);
      // Make headers bold and freeze top row
      sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
      sheet.setFrozenRows(1);
    }

    // 4. LOGGING: Add the new row
    // We add 'rawData' at the end just in case you need to debug later
    sheet.appendRow([
      new Date(),     // Column A: Time
      data.temp,      // Column B: Temperature
      data.hum,       // Column C: Humidity
      data.status,    // Column D: Live vs Synced
      rawData         // Column E: Backup of exactly what was sent
    ]);
    
    // 5. SUCCESS RESPONSE
    return ContentService.createTextOutput("Success").setMimeType(ContentService.MimeType.TEXT);

  } catch (err) {
    // Error Handling
    return ContentService.createTextOutput("Error: " + err.message);
    
  } finally {
    // Always release the lock
    lock.releaseLock();
  }
}





You will find the images of the inspirations in the insp folder 

The links for the inspiration are here : https://dribbble.com/shots/24443101-Weather



You are free to create any features and libraries you want but make sure to make it mobile first and responsive . 

In case of any questions prompt me to ask .