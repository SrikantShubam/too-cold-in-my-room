# 🌡️ Room Climate Monitor

A beautiful, modern web application to monitor real-time temperature and humidity data from your ESP32 sensor. Features indoor/outdoor weather comparison, historical trends, and statistics.

![Climate Monitor](preview.png)

## ✨ Features

- 🏠 **Indoor Monitoring** - Real-time temperature & humidity from ESP32 sensor
- 🌤️ **Outdoor Weather** - Live weather data for Patna via Open-Meteo API
- 📊 **Statistics** - 24-hour min/max/average tracking
- 📈 **Historical Charts** - Visual trend analysis with Chart.js
- 🎨 **Modern UI** - Dark theme with glass-morphism & gradient effects
- 📱 **Mobile-First** - Fully responsive design
- 🔒 **Secure** - Rate limiting, CORS protection, request validation

## 🚀 Quick Start

### 1. Deploy Google Apps Script API

1. Open your Google Sheet with ESP32 sensor data
2. Go to **Extensions → Apps Script**
3. Delete existing code and paste contents from `google-apps-script-api.gs`
4. Click **Deploy → New deployment**
5. Select type: **Web app**
6. Configure:
   - Execute as: **Me**
   - Who has access: **Anyone**
7. Click **Deploy** and authorize
8. Copy the **deployment URL**

### 2. Configure the Web App

1. Open `app.js`
2. Find line 6: `GOOGLE_SHEETS_API_URL`
3. Replace `'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE'` with your deployment URL
4. Save the file

### 3. Run the App

Simply open `index.html` in your web browser!

The app will:
- ✅ Fetch your ESP32 sensor data from Google Sheets
- ✅ Display outdoor weather for Patna
- ✅ Auto-refresh every 60 seconds
- ✅ Show historical trends and statistics

## 📁 Project Structure

```
my room weather app/
├── index.html                    # Main HTML structure
├── styles.css                    # Design system & styling
├── app.js                        # Application logic
├── google-apps-script-api.gs     # API endpoint (deploy to Google Sheets)
├── README.md                     # This file
└── insp/                         # Design inspiration images
```

## 🔧 Configuration

### Change Location

To monitor weather for a different city:

1. Open `app.js`
2. Find `PATNA_COORDS` (around line 11)
3. Update latitude/longitude:
   ```javascript
   PATNA_COORDS: {
       latitude: YOUR_LATITUDE,
       longitude: YOUR_LONGITUDE
   }
   ```

### Adjust Refresh Rate

Default: 60 seconds. To change:

1. Open `app.js`
2. Find `REFRESH_INTERVAL` (line 15)
3. Update value (in milliseconds):
   ```javascript
   REFRESH_INTERVAL: 30000, // 30 seconds
   ```

### Customize Colors

1. Open `styles.css`
2. Edit CSS custom properties in `:root` section
3. Modify gradient colors, accent colors, etc.

## 🔒 Security Features

| Feature | Description |
|---------|-------------|
| **Rate Limiting** | Max 60 requests/minute per IP (server-side) |
| **Caching** | 30-second cache to reduce API load |
| **CORS** | Configurable allowed origins |
| **Data Validation** | Input sanitization and type checking |
| **Max Rows** | Limited to 1000 records per request |

## 📊 Data Format

The app expects Google Sheets data in this format:

| Timestamp | Temperature (°C) | Humidity (%) | Status | Raw Data |
|-----------|------------------|--------------|--------|----------|
| 12/24/2025 14:31:21 | 21.5 | 72.2 | Live | {...} |
| 12/24/2025 14:31:37 | 21.4 | 72.6 | Live | {...} |

**Required columns:**
- Column A: Timestamp (Date/Time)
- Column B: Temperature (Number)
- Column C: Humidity (Number)
- Column D: Status (Text)
- Column E: Raw Data (Optional)

## 🎨 Design

Inspired by modern weather apps with:
- Dark gradient backgrounds (deep blues/purples)
- Glass-morphism effects for cards
- Smooth animations and micro-interactions
- Clean typography (Inter font family)
- Mobile-first responsive layout

## 🌐 APIs Used

- **Open-Meteo** - Free weather API (no key required)
- **Chart.js** - Data visualization library
- **Google Sheets** - Data storage via Apps Script

## 📱 Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## 🛠️ Development Mode

If you haven't deployed the Google Apps Script yet, the app will use **mock data** for testing. You'll see a console warning:

```
Google Sheets API URL not configured. Using mock data.
```

This is normal! Deploy the API endpoint to get real data.

## 🐛 Troubleshooting

### No data showing?
1. Check browser console for errors (F12)
2. Verify Google Apps Script deployment URL in `app.js`
3. Ensure Google Sheet has data in correct format

### Offline status?
1. Check internet connection
2. Verify Google Apps Script is deployed and accessible
3. Check for CORS errors in browser console

### Chart not rendering?
1. Clear browser cache
2. Check if Chart.js CDN loaded (Network tab in DevTools)
3. Verify data has multiple records

## 📄 License

MIT License - Feel free to use and modify!

## 🙏 Credits

- Weather data: [Open-Meteo](https://open-meteo.com/)
- Charts: [Chart.js](https://www.chartjs.org/)
- Fonts: [Google Fonts (Inter)](https://fonts.google.com/specimen/Inter)

---

Built with ❤️ for ESP32 IoT enthusiasts
