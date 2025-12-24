// ========================================
// TOO COLD - ROOM CLIMATE MONITOR
// ========================================

// Debug mode - set to true to see detailed logs
const DEBUG = true;

function log(...args) {
    if (DEBUG) console.log('[TOO COLD]', ...args);
}

function logError(...args) {
    console.error('[TOO COLD ERROR]', ...args);
}

// Check if CONFIG is loaded from config.js, otherwise use defaults
// Using window.CONFIG to avoid redeclaration errors
if (typeof window.CONFIG === 'undefined') {
    console.warn('[TOO COLD] config.js not found, using DEMO mode');
    window.CONFIG = {
        GOOGLE_SHEETS_API_URL: 'MOCK_DATA',
        COORDS: { lat: 25.5941, lon: 85.1376 },
        REFRESH_INTERVAL: 60000,
    };
} else {
    log('config.js loaded successfully');
    log('API URL:', window.CONFIG.GOOGLE_SHEETS_API_URL.substring(0, 50) + '...');
}

// Use local constant to avoid collision with global CONFIG
const AppConfig = window.CONFIG;

// API URLs (public, no need to hide)
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const AQI_API = 'https://air-quality-api.open-meteo.com/v1/air-quality';

// Color themes
const ACCENTS = ['blue', 'purple', 'green', 'orange', 'pink'];
let currentAccent = 0;
let apiCallCount = 0;

// Accent color definitions for charts (primary = inside, secondary = outside for contrast)
const ACCENT_COLORS = {
    blue: { 
        primary: '#00A3FF', primaryBg: 'rgba(0, 163, 255, 0.15)',
        secondary: '#FF6B9D', secondaryBg: 'rgba(255, 107, 157, 0.15)'
    },
    purple: { 
        primary: '#8B5CF6', primaryBg: 'rgba(139, 92, 246, 0.15)',
        secondary: '#00D4AA', secondaryBg: 'rgba(0, 212, 170, 0.15)'
    },
    green: { 
        primary: '#00FF88', primaryBg: 'rgba(0, 255, 136, 0.15)',
        secondary: '#FF6B35', secondaryBg: 'rgba(255, 107, 53, 0.15)'
    },
    orange: { 
        primary: '#FF6B35', primaryBg: 'rgba(255, 107, 53, 0.15)',
        secondary: '#00A3FF', secondaryBg: 'rgba(0, 163, 255, 0.15)'
    },
    pink: { 
        primary: '#FF6B9D', primaryBg: 'rgba(255, 107, 157, 0.15)',
        secondary: '#00FF88', secondaryBg: 'rgba(0, 255, 136, 0.15)'
    }
};

// Time ranges in ms
const TIME_RANGES = {
    '1h': 3600000,
    '3h': 10800000,
    '6h': 21600000,
    '12h': 43200000,
    '24h': 86400000,
    '1w': 604800000
};

let state = { 
    indoor: [], 
    outdoor: null, 
    charts: {},
    timeRange: '24h' // Default
};

const ui = {
    systemStatus: document.getElementById('systemStatus'),
    currentTime: document.getElementById('currentTime'),
    colorToggle: document.getElementById('colorToggle'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    fabTrigger: document.getElementById('fabTrigger'),
    filterBar: document.getElementById('filterBar'),
    
    indoorTemp: document.getElementById('indoorTemp'),
    indoorHum: document.getElementById('indoorHumidity'),
    outdoorTemp: document.getElementById('outdoorTemp'),
    outdoorHum: document.getElementById('outdoorHumidity'),
    weatherIcon: document.getElementById('weatherIcon'),
    
    tempDiff: document.getElementById('tempDiff'),
    humDiff: document.getElementById('humDiff'),
    
    // Comfort
    comfortScore: document.getElementById('comfortScore'),
    comfortLabel: document.getElementById('comfortLabel'),
    comfortRing: document.getElementById('comfortRing'),
    
    // Comfort tooltip
    comfortContent: document.getElementById('comfortContent'),
    comfortTooltip: document.getElementById('comfortTooltip'),
    tooltipTemp: document.getElementById('tooltipTemp'),
    tooltipHum: document.getElementById('tooltipHum'),
    tooltipAqi: document.getElementById('tooltipAqi'),
    
    // Derived
    feelsLike: document.getElementById('feelsLike'),
    dewPoint: document.getElementById('dewPoint'),
    
    // Stats
    latestTemp: document.getElementById('latestTemp'),
    minTemp: document.getElementById('minTemp'),
    maxTemp: document.getElementById('maxTemp'),
    avgTemp: document.getElementById('avgTemp'),
    latestHum: document.getElementById('latestHum'),
    minHum: document.getElementById('minHum'),
    maxHum: document.getElementById('maxHum'),
    avgHum: document.getElementById('avgHum'),
    
    // Outdoor
    uv: document.getElementById('uvIndex'),
    wind: document.getElementById('windSpeed'),
    aqi: document.getElementById('aqi'),
    condition: document.getElementById('weatherCondition'),
    
    // Sensor
    sensorConnection: document.getElementById('sensorConnection'),
    sensorBattery: document.getElementById('sensorBattery'),
    lastReading: document.getElementById('lastReading'),
    
    // API
    apiWeather: document.getElementById('apiWeather'),
    apiAqi: document.getElementById('apiAqi'),
    apiSheets: document.getElementById('apiSheets'),
    apiCalls: document.getElementById('apiCalls'),
    
    lastUpdated: document.getElementById('lastUpdated'),
    
    tempChart: document.getElementById('tempChart'),
    humChart: document.getElementById('humChart'),
    tempCompareChart: document.getElementById('tempCompareChart'),
    humCompareChart: document.getElementById('humCompareChart')
};

// Dynamic color getter based on current accent
function getChartColors() {
    const accent = ACCENTS[currentAccent];
    const accentColor = ACCENT_COLORS[accent];
    return {
        inside: accentColor.primary,
        insideBg: accentColor.primaryBg,
        outside: accentColor.secondary,
        outsideBg: accentColor.secondaryBg
    };
}

// ========================================
// INIT
// ========================================

async function init() {
    // Set location name from config
    const locationName = AppConfig.LOCATION_NAME || 'My Room';
    document.getElementById('locationName').textContent = locationName;
    document.title = `Too Cold -- My Room (${locationName})`;
    
    loadAccent();
    ui.colorToggle.addEventListener('click', cycleAccent);
    
    // 4. Initial Render
    updateUI();
    
    // 5. FAB Interaction Logic
    if (ui.fabTrigger && ui.filterBar) {
        // Toggle Menu
        ui.fabTrigger.addEventListener('click', (e) => {
            e.stopPropagation();
            ui.filterBar.classList.toggle('open');
            // Optional: Rotate icon or change state
            ui.fabTrigger.style.transform = ui.filterBar.classList.contains('open') ? 'rotate(90deg)' : 'rotate(0deg)';
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!ui.filterBar.contains(e.target) && !ui.fabTrigger.contains(e.target)) {
                ui.filterBar.classList.remove('open');
                ui.fabTrigger.style.transform = 'rotate(0deg)';
            }
        });
    }

    // 6. Filter Buttons Interaction
    ui.filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            ui.filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Set state and re-render
            state.timeRange = btn.dataset.range;
            updateUI();
            
            // Auto-close FAB menu on mobile selection
            if (window.innerWidth <= 700) {
                ui.filterBar.classList.remove('open');
                if (ui.fabTrigger) ui.fabTrigger.style.transform = 'rotate(0deg)';
            }
        });
    });
    
    // Comfort tooltip click handler
    ui.comfortContent.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.comfortTooltip.classList.toggle('show');
    });
    
    // Also show on hover for better discoverability
    ui.comfortContent.addEventListener('mouseenter', () => {
        ui.comfortTooltip.classList.add('show');
    });
    
    ui.comfortContent.addEventListener('mouseleave', () => {
        ui.comfortTooltip.classList.remove('show');
    });
    
    // Close tooltip when clicking outside
    document.addEventListener('click', (e) => {
        if (!ui.comfortContent.contains(e.target)) {
            ui.comfortTooltip.classList.remove('show');
        }
    });
    
    updateClock();
    setInterval(updateClock, 1000);
    
    await refresh();
    setInterval(refresh, AppConfig.REFRESH_INTERVAL);
    
    // Countdown timer for next refresh
    let countdown = AppConfig.REFRESH_INTERVAL / 1000;
    const countdownEl = document.getElementById('nextRefresh');
    setInterval(() => {
        countdown--;
        if (countdown <= 0) countdown = AppConfig.REFRESH_INTERVAL / 1000;
        countdownEl.textContent = countdown;
    }, 1000);
}

function loadAccent() {
    const saved = localStorage.getItem('accent') || 'blue';
    currentAccent = ACCENTS.indexOf(saved);
    document.body.dataset.accent = saved;
}

function cycleAccent() {
    currentAccent = (currentAccent + 1) % ACCENTS.length;
    document.body.dataset.accent = ACCENTS[currentAccent];
    localStorage.setItem('accent', ACCENTS[currentAccent]);
    lucide.createIcons();
    
    // Update charts with new accent color if data exists
    if (state.indoor.length > 0 && state.outdoor) {
        updateUI(); 
    }
    
    // Update comfort ring color
    updateComfortRingColor();
}

function updateComfortRingColor() {
    const score = parseInt(ui.comfortScore.textContent);
    if (isNaN(score)) return;
    
    const accentColor = ACCENT_COLORS[ACCENTS[currentAccent]].primary;
    
    // Always use accent color for the ring, label indicates status
    ui.comfortRing.style.stroke = accentColor;
    ui.comfortRing.style.filter = `drop-shadow(0 0 6px ${accentColor})`;
}

function updateClock() {
    ui.currentTime.textContent = new Date().toLocaleTimeString('en-GB');
}

// ========================================
// DATA LOGIC
// ========================================

function getFilteredData() {
    const rangeMs = TIME_RANGES[state.timeRange];
    const cutoff = Date.now() - rangeMs;
    return state.indoor.filter(d => new Date(d.timestamp).getTime() > cutoff);
}

// ========================================
// REFRESH
// ========================================

async function refresh() {
    apiCallCount = 0;
    
    try {
        const [indoor, outdoor, aqi] = await Promise.all([
            fetchIndoor(),
            fetchOutdoor(),
            fetchAQI()
        ]);
        
        state.indoor = indoor;
        state.outdoor = outdoor;
        
        // Render current status (Hero, Comfort, Derived, Sensor, API) 
        // These always use the absolute latest reading regardless of filter
        renderHero(indoor, outdoor);
        renderComfort(indoor, outdoor, aqi);
        renderDerived(indoor);
        renderSensor(indoor);
        renderApi();
        
        if (outdoor) {
            renderOutdoor(outdoor, aqi);
        }
        
        // Render Stats and Charts using Filtered Data
        updateUI();
        
        ui.systemStatus.textContent = '● LIVE';
        ui.lastUpdated.textContent = new Date().toLocaleTimeString('en-GB');
        
    } catch (e) {
        console.error(e);
        ui.systemStatus.textContent = '○ OFFLINE';
    }
}

function updateUI() {
    const filtered = getFilteredData();
    
    if (filtered.length === 0) {
        // Handle case with no data in range
        // Maybe show placeholder? For now charts will just be empty
    }
    
    // Only update stats and charts based on filter
    renderStats(filtered);
    
    if (state.outdoor) {
        renderCharts(filtered, state.outdoor);
    }
}

// ========================================
// FETCHERS
// ========================================

async function fetchIndoor() {
    apiCallCount++;
    log('Fetching indoor data...');
    
    // Check if using mock data
    if (AppConfig.GOOGLE_SHEETS_API_URL === 'MOCK_DATA' || 
        AppConfig.GOOGLE_SHEETS_API_URL.includes('YOUR_')) {
        log('Using DEMO mode (no API URL configured)');
        ui.apiSheets.textContent = 'DEMO';
        ui.apiSheets.className = 'api-badge';
        return mockIndoor();
    }
    
    try {
        // Add cache-busting parameter to prevent stale data
        const url = AppConfig.GOOGLE_SHEETS_API_URL + '?_=' + Date.now();
        log('Fetching from:', url);
        const res = await fetch(url);
        log('Response status:', res.status);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        log('Indoor data received:', data.length, 'readings');
        
        // API returns newest-first, but we need oldest-first (latest at end)
        const sortedData = data.reverse();
        
        ui.apiSheets.textContent = 'OK';
        ui.apiSheets.className = 'api-badge ok';
        return sortedData;
    } catch (err) {
        logError('Sheets API failed:', err.message);
        ui.apiSheets.textContent = 'ERR';
        ui.apiSheets.className = 'api-badge error';
        return mockIndoor();
    }
}

async function fetchOutdoor() {
    apiCallCount++;
    try {
        const params = new URLSearchParams({
            latitude: AppConfig.COORDS.lat,
            longitude: AppConfig.COORDS.lon,
            current: 'temperature_2m,relative_humidity_2m,weather_code',
            hourly: 'temperature_2m,relative_humidity_2m',
            daily: 'uv_index_max,wind_speed_10m_max',
            timezone: 'Asia/Kolkata',
            past_days: 7, // Fetch 7 days for 1W view
            forecast_days: 1
        });
        const res = await fetch(`${WEATHER_API}?${params}`);
        if (!res.ok) throw new Error('Weather API Error');
        const data = await res.json();
        ui.apiWeather.textContent = 'OK';
        ui.apiWeather.className = 'api-badge ok';
        return data;
    } catch (e) {
        logError('Weather API failed', e);
        ui.apiWeather.textContent = 'ERR';
        ui.apiWeather.className = 'api-badge error';
        return null;
    }
}

async function fetchAQI() {
    apiCallCount++;
    try {
        const params = new URLSearchParams({
            latitude: AppConfig.COORDS.lat,
            longitude: AppConfig.COORDS.lon,
            current: 'us_aqi',
            timezone: 'Asia/Kolkata'
        });
        const res = await fetch(`${AQI_API}?${params}`);
        if (!res.ok) throw new Error('AQI API Error');
        const data = await res.json();
        ui.apiAqi.textContent = 'OK';
        ui.apiAqi.className = 'api-badge ok';
        return data;
    } catch (e) {
        logError('AQI API failed', e);
        ui.apiAqi.textContent = 'ERR';
        ui.apiAqi.className = 'api-badge error';
        return null; // Return null on failure
    }
}

// ========================================
// RENDERERS
// ========================================

function renderHero(indoor, outdoor) {
    const latest = indoor[indoor.length - 1];
    ui.indoorTemp.textContent = latest.temp.toFixed(1);
    ui.indoorHum.textContent = latest.hum.toFixed(1);

    if (outdoor) {
        const outT = outdoor.current.temperature_2m;
        const outH = outdoor.current.relative_humidity_2m;
        
        ui.outdoorTemp.textContent = outT.toFixed(1);
        ui.outdoorHum.textContent = Math.round(outH);
        
        const tempD = latest.temp - outT;
        const humD = latest.hum - outH;
        
        ui.tempDiff.textContent = (tempD >= 0 ? '+' : '') + tempD.toFixed(1) + '°C';
        ui.humDiff.textContent = (humD >= 0 ? '+' : '') + Math.round(humD) + '%';
        
        // Animated weather icon
        updateWeatherIcon(outdoor.current.weather_code);
    } else {
        ui.outdoorTemp.textContent = '--';
        ui.outdoorHum.textContent = '--';
        ui.tempDiff.textContent = '--';
        ui.humDiff.textContent = '--';
    }
}

function updateWeatherIcon(code) {
    const iconMap = {
        0: 'sun', 1: 'cloud-sun', 2: 'cloud', 3: 'cloudy',
        45: 'cloud-fog', 61: 'cloud-rain', 63: 'cloud-rain',
        80: 'cloud-drizzle', 95: 'cloud-lightning'
    };
    const icon = iconMap[code] || 'cloud';
    ui.weatherIcon.innerHTML = `<i data-lucide="${icon}"></i>`;
    lucide.createIcons();
}

function renderComfort(indoor, outdoor, aqi) {
    const latest = indoor[indoor.length - 1];
    
    // Calculate comfort score (0-100)
    const tempScore = Math.max(0, Math.round(100 - Math.abs(latest.temp - 22) * 10));
    const humScore = Math.max(0, Math.round(100 - Math.abs(latest.hum - 50) * 2));
    
    // AQI is optional
    let aqiScore = 100;
    if (aqi && aqi.current) {
        aqiScore = Math.max(0, Math.round(100 - aqi.current.us_aqi * 0.5));
    }
    
    const score = Math.round((tempScore * 0.4 + humScore * 0.3 + aqiScore * 0.3));
    
    ui.comfortScore.textContent = score;
    
    // Update tooltip with breakdown
    ui.tooltipTemp.textContent = `${tempScore}/100`;
    ui.tooltipHum.textContent = `${humScore}/100`;
    ui.tooltipAqi.textContent = `${aqiScore}/100`;
    
    const offset = 264 - (264 * score / 100);
    ui.comfortRing.style.strokeDashoffset = offset;
    
    // Get current accent color for the ring - always use accent with glow
    const accentColor = ACCENT_COLORS[ACCENTS[currentAccent]].primary;
    ui.comfortRing.style.stroke = accentColor;
    ui.comfortRing.style.filter = `drop-shadow(0 0 6px ${accentColor})`;
    
    // Label indicates the comfort level
    if (score >= 70) {
        ui.comfortLabel.textContent = 'EXCELLENT';
    } else if (score >= 50) {
        ui.comfortLabel.textContent = 'GOOD';
    } else if (score >= 30) {
        ui.comfortLabel.textContent = 'MODERATE';
    } else {
        ui.comfortLabel.textContent = 'POOR';
    }
}

function renderDerived(indoor) {
    const latest = indoor[indoor.length - 1];
    const T = latest.temp;
    const H = latest.hum;
    
    // Dew Point (Magnus formula)
    const a = 17.27, b = 237.7;
    const alpha = (a * T) / (b + T) + Math.log(H / 100);
    const dewPoint = (b * alpha) / (a - alpha);
    
    // Heat Index (Rothfusz regression)
    const Tf = T * 9/5 + 32;
    let HI = 0.5 * (Tf + 61 + (Tf - 68) * 1.2 + H * 0.094);
    if (Tf >= 80) {
        HI = -42.379 + 2.04901523*Tf + 10.14333127*H 
            - 0.22475541*Tf*H - 0.00683783*Tf*Tf 
            - 0.05481717*H*H + 0.00122874*Tf*Tf*H 
            + 0.00085282*Tf*H*H - 0.00000199*Tf*Tf*H*H;
    }
    const feelsLike = (HI - 32) * 5/9;
    
    ui.dewPoint.textContent = dewPoint.toFixed(1) + '°C';
    ui.feelsLike.textContent = feelsLike.toFixed(1) + '°C';
}

function renderStats(data) {
    if (!data || data.length === 0) return;
    
    const latest = data[data.length - 1];
    
    // Helper to find min/max objects
    const findMin = (key) => data.reduce((min, p) => p[key] < min[key] ? p : min, data[0]);
    const findMax = (key) => data.reduce((max, p) => p[key] > max[key] ? p : max, data[0]);
    
    const minT = findMin('temp');
    const maxT = findMax('temp');
    const minH = findMin('hum');
    const maxH = findMax('hum');
    
    // Calculage Avg
    const avgT = data.reduce((a, b) => a + b.temp, 0) / data.length;
    const avgH = data.reduce((a, b) => a + b.hum, 0) / data.length;
    
    // Time formatter (Date + Time)
    const fmtTime = (ts) => {
        const d = new Date(ts);
        return d.toLocaleDateString('en-GB', {day:'numeric', month:'short'}) + ' ' + 
               d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    };
    
    // Render Temp
    ui.latestTemp.innerHTML = `${latest.temp.toFixed(1)}°C <span class="stat-time">${fmtTime(latest.timestamp)}</span>`;
    ui.minTemp.innerHTML = `${minT.temp.toFixed(1)}°C <span class="stat-time">${fmtTime(minT.timestamp)}</span>`;
    ui.maxTemp.innerHTML = `${maxT.temp.toFixed(1)}°C <span class="stat-time">${fmtTime(maxT.timestamp)}</span>`;
    ui.avgTemp.innerHTML = `${avgT.toFixed(1)}°C <span class="stat-time">${data.length} readings</span>`;
    
    // Render Hum
    ui.latestHum.innerHTML = `${latest.hum.toFixed(1)}% <span class="stat-time">${fmtTime(latest.timestamp)}</span>`;
    ui.minHum.innerHTML = `${minH.hum.toFixed(1)}% <span class="stat-time">${fmtTime(minH.timestamp)}</span>`;
    ui.maxHum.innerHTML = `${maxH.hum.toFixed(1)}% <span class="stat-time">${fmtTime(maxH.timestamp)}</span>`;
    ui.avgHum.innerHTML = `${avgH.toFixed(1)}% <span class="stat-time">${data.length} readings</span>`;
}

function renderOutdoor(weather, aqi) {
    ui.uv.textContent = weather.daily.uv_index_max[0].toFixed(1);
    ui.wind.textContent = Math.round(weather.daily.wind_speed_10m_max[0]);
    ui.aqi.textContent = aqi.current.us_aqi;
    ui.condition.textContent = getCondition(weather.current.weather_code);
}

function renderSensor(data) {
    const latest = data[data.length - 1];
    const lastTime = new Date(latest.timestamp);
    const now = new Date();
    const diffMin = (now - lastTime) / 60000;
    
    const dateStr = lastTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const timeStr = lastTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    ui.lastReading.textContent = `${dateStr}, ${timeStr}`;
    
    // Check connection status
    const isMockData = AppConfig.GOOGLE_SHEETS_API_URL === 'MOCK_DATA' || 
                       AppConfig.GOOGLE_SHEETS_API_URL.includes('YOUR_');
    
    if (isMockData || diffMin < 5) {
        ui.sensorConnection.textContent = isMockData ? 'DEMO' : 'ONLINE';
        ui.sensorConnection.style.color = '#00FF88';
    } else if (diffMin < 15) {
        ui.sensorConnection.textContent = 'DELAYED';
        ui.sensorConnection.style.color = '#FFB800';
    } else {
        ui.sensorConnection.textContent = 'OFFLINE';
        ui.sensorConnection.style.color = '#FF4444';
    }
    
    ui.sensorBattery.textContent = latest.battery ? latest.battery + '%' : 'USB';
}

function renderApi() {
    ui.apiCalls.textContent = apiCallCount;
}

function renderCharts(indoor, outdoor) {
    // Data is already filtered by getFilteredData
    const data = indoor; 
    
    // Format labels based on time range
    const isWeek = state.timeRange === '1w';
    const labels = data.map(d => {
        const date = new Date(d.timestamp);
        if (isWeek) {
            return date.toLocaleDateString('en-GB', {day:'numeric', month:'short'}) + ' ' + 
                   date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    });
    
    // Get current accent colors
    const COLORS = getChartColors();
    
    Object.values(state.charts).forEach(c => c?.destroy());
    
    state.charts.temp = new Chart(ui.tempChart.getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [{ 
            data: data.map(d => Math.round(d.temp * 10) / 10), 
            borderColor: COLORS.inside, 
            backgroundColor: COLORS.insideBg, 
            fill: true, 
            tension: 0.4, 
            pointRadius: data.length > 50 ? 0 : 3, // Hide points for dense data
            pointHoverRadius: 8,
            pointBackgroundColor: COLORS.inside
        }] },
        options: lineOpts('°C', undefined, undefined) // Auto scale
    });
    
    state.charts.hum = new Chart(ui.humChart.getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [{ 
            data: data.map(d => d.hum), 
            borderColor: COLORS.inside,  // Now uses accent color
            backgroundColor: COLORS.insideBg, 
            fill: true, 
            tension: 0.4, 
            pointRadius: data.length > 50 ? 0 : 3,
            pointHoverRadius: 8,
            pointBackgroundColor: COLORS.inside
        }] },
        options: lineOpts('%', 0, 100) 
    });
    
    // Generate comparison columns based on time range
    const intervals = getComparisonIntervals(state.indoor, outdoor, state.timeRange);
    
    state.charts.tempCompare = new Chart(ui.tempCompareChart.getContext('2d'), {
        type: 'bar',
        data: {
            labels: intervals.labels,
            datasets: [
                { label: 'Inside', data: intervals.inTemp, backgroundColor: COLORS.inside, borderRadius: 6 },
                { label: 'Outside', data: intervals.outTemp, backgroundColor: COLORS.outside, borderRadius: 6 }
            ]
        },
        options: barOpts('°C')
    });
    
    state.charts.humCompare = new Chart(ui.humCompareChart.getContext('2d'), {
        type: 'bar',
        data: {
            labels: intervals.labels,
            datasets: [
                { label: 'Inside', data: intervals.inHum, backgroundColor: COLORS.inside, borderRadius: 6 },
                { label: 'Outside', data: intervals.outHum, backgroundColor: COLORS.outside, borderRadius: 6 }
            ]
        },
        options: barOpts('%')
    });
}

// ========================================
// UTILITIES
// ========================================

function getComparisonIntervals(indoor, outdoor, range) {
    const now = new Date();
    const labels = [], inTemp = [], inHum = [], outTemp = [], outHum = [];
    
    let stepCount = 5;
    let stepMs = 0;
    
    // Define steps based on range
    switch(range) {
        case '1h': stepMs = 12 * 60000; stepCount = 5; break; // Every 12 mins
        case '3h': stepMs = 36 * 60000; stepCount = 5; break; // Every 36 mins
        case '6h': stepMs = 60 * 60000; stepCount = 6; break; // Every hour
        case '12h': stepMs = 2 * 3600000; stepCount = 6; break; // Every 2 hours
        case '24h': stepMs = 4 * 3600000; stepCount = 6; break; // Every 4 hours (was 6h)
        case '1w': stepMs = 24 * 3600000; stepCount = 7; break; // Every day
    }
    
    for (let i = stepCount - 1; i >= 0; i--) {
        const t = new Date(now - i * stepMs);
        
        // Format label
        let label = '';
        if (range === '1w') {
             label = t.toLocaleDateString('en-GB', {weekday: 'short'});
        } else if (range === '24h') {
             // For 24h, show "-Xh" except for NOW
             const hrsAgo = i * (stepMs / 3600000);
             label = i === 0 ? 'NOW' : `-${Math.round(hrsAgo)}h`;
        } else {
             label = t.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        }
        labels.push(label);
        
        // Find data
        const inReading = findClosest(indoor, t);
        inTemp.push(inReading ? Math.round(inReading.temp * 10) / 10 : 0);
        inHum.push(inReading ? Math.round(inReading.hum * 10) / 10 : 0);
        
        // Find outdoor
        if (outdoor && outdoor.hourly) {
             const idx = findHourIdx(outdoor.hourly.time, t);
             if (idx >= 0 && idx < outdoor.hourly.temperature_2m.length) {
                 outTemp.push(outdoor.hourly.temperature_2m[idx]); // API usually returns 1 decimal, but let's be safe
                 outHum.push(outdoor.hourly.relative_humidity_2m[idx]);
             } else {
                 outTemp.push(0); outHum.push(0);
             }
        }
    }
    
    return { labels, inTemp, inHum, outTemp, outHum };
}

function findClosest(data, time) {
    return data.reduce((a, b) => Math.abs(new Date(b.timestamp) - time) < Math.abs(new Date(a.timestamp) - time) ? b : a);
}

function findHourIdx(times, target) {
    let idx = 0, min = Infinity;
    times.forEach((t, i) => { const diff = Math.abs(new Date(t) - target); if (diff < min) { min = diff; idx = i; } });
    return idx;
}

function lineOpts(unit, min, max) {
    return {
        responsive: true, 
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false
        },
        plugins: { 
            legend: { display: false },
            tooltip: {
                enabled: true,
                backgroundColor: 'rgba(0,0,0,0.9)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: 'var(--c-accent)',
                borderWidth: 1,
                padding: 12,
                displayColors: false,
                titleFont: { size: 14, weight: 'bold' },
                bodyFont: { size: 16 },
                callbacks: {
                    label: (ctx) => ctx.parsed.y.toFixed(1) + unit
                }
            }
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#666', font: { size: 9 } } },
            y: { min, max, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#666', font: { size: 9 }, callback: v => v + unit } }
        }
    };
}

function barOpts(unit) {
    return {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#444', font: { size: 10 } } },
            y: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#444', font: { size: 9 }, callback: v => v + unit } }
        }
    };
}

function getCondition(code) {
    return { 0: 'CLEAR', 1: 'FAIR', 2: 'CLOUDY', 3: 'OVERCAST', 45: 'FOG', 61: 'RAIN', 63: 'RAIN', 95: 'STORM' }[code] || '--';
}

function mockIndoor() {
    const arr = [];
    const now = Date.now();
    for (let i = 0; i < 48; i++) {
        const hoursBack = (47 - i) * 0.5;
        arr.push({
            timestamp: new Date(now - hoursBack * 3600000).toISOString(),
            temp: 22 + Math.sin(i / 8) * 3,
            hum: 55 + Math.cos(i / 8) * 10
        });
    }
    return arr;
}

document.addEventListener('DOMContentLoaded', init);
