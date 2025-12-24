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

let state = { indoor: [], outdoor: null, charts: {} };

const ui = {
    systemStatus: document.getElementById('systemStatus'),
    currentTime: document.getElementById('currentTime'),
    colorToggle: document.getElementById('colorToggle'),
    
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

const COLORS = {
    inside: '#00A3FF',
    outside: '#00D4AA',
    insideBg: 'rgba(0, 163, 255, 0.15)',
    outsideBg: 'rgba(0, 212, 170, 0.15)'
};

// ========================================
// INIT
// ========================================

async function init() {
    loadAccent();
    ui.colorToggle.addEventListener('click', cycleAccent);
    
    updateClock();
    setInterval(updateClock, 1000);
    
    await refresh();
    setInterval(refresh, AppConfig.REFRESH_INTERVAL);
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
}

function updateClock() {
    ui.currentTime.textContent = new Date().toLocaleTimeString('en-GB');
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
        
        // Render functions now handle null data gracefully
        renderHero(indoor, outdoor);
        renderComfort(indoor, outdoor, aqi);
        renderDerived(indoor);
        renderStats(indoor);
        renderSensor(indoor);
        renderApi();
        
        if (outdoor) {
            renderOutdoor(outdoor, aqi);
            renderCharts(indoor, outdoor);
        } else {
            // Clear outdoor-dependent charts/UI if needed
        }
        
        ui.systemStatus.textContent = '● LIVE';
        ui.lastUpdated.textContent = new Date().toLocaleTimeString('en-GB');
        
    } catch (e) {
        console.error(e);
        ui.systemStatus.textContent = '○ OFFLINE';
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
        log('Fetching from:', AppConfig.GOOGLE_SHEETS_API_URL);
        const res = await fetch(AppConfig.GOOGLE_SHEETS_API_URL);
        log('Response status:', res.status);
        
        if (!res.ok) {
            throw new Error(`HTTP ${res.status}`);
        }
        
        const data = await res.json();
        log('Indoor data received:', data.length, 'readings');
        
        ui.apiSheets.textContent = 'OK';
        ui.apiSheets.className = 'api-badge ok';
        return data;
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
            past_days: 1,
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
    const aqiVal = aqi.current.us_aqi;
    
    // Calculate comfort score (0-100)
    const tempScore = Math.max(0, 100 - Math.abs(latest.temp - 22) * 10);
    const humScore = Math.max(0, 100 - Math.abs(latest.hum - 50) * 2);
    
    // AQI is optional
    let aqiScore = 100;
    if (aqi && aqi.current) {
        aqiScore = Math.max(0, 100 - aqi.current.us_aqi * 0.5);
    }
    
    const score = Math.round((tempScore * 0.4 + humScore * 0.3 + aqiScore * 0.3));
    
    ui.comfortScore.textContent = score;
    
    const offset = 264 - (264 * score / 100);
    ui.comfortRing.style.strokeDashoffset = offset;
    
    if (score >= 70) {
        ui.comfortRing.style.stroke = '#00FF88';
        ui.comfortLabel.textContent = 'EXCELLENT';
    } else if (score >= 50) {
        ui.comfortRing.style.stroke = '#00A3FF';
        ui.comfortLabel.textContent = 'GOOD';
    } else if (score >= 30) {
        ui.comfortRing.style.stroke = '#FFB800';
        ui.comfortLabel.textContent = 'MODERATE';
    } else {
        ui.comfortRing.style.stroke = '#FF4444';
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
    ui.latestTemp.textContent = latest.temp.toFixed(1) + '°C';
    ui.minTemp.innerHTML = `${minT.temp.toFixed(1)}°C <span class="stat-time">${fmtTime(minT.timestamp)}</span>`;
    ui.maxTemp.innerHTML = `${maxT.temp.toFixed(1)}°C <span class="stat-time">${fmtTime(maxT.timestamp)}</span>`;
    ui.avgTemp.innerHTML = `${avgT.toFixed(1)}°C <span class="stat-time">24HR</span>`;
    
    // Render Hum
    ui.latestHum.textContent = latest.hum.toFixed(1) + '%';
    ui.minHum.innerHTML = `${minH.hum.toFixed(1)}% <span class="stat-time">${fmtTime(minH.timestamp)}</span>`;
    ui.maxHum.innerHTML = `${maxH.hum.toFixed(1)}% <span class="stat-time">${fmtTime(maxH.timestamp)}</span>`;
    ui.avgHum.innerHTML = `${avgH.toFixed(1)}% <span class="stat-time">24HR</span>`;
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
    const slice = indoor.slice(-24);
    const labels = slice.map(d => new Date(d.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}));
    
    Object.values(state.charts).forEach(c => c?.destroy());
    
    state.charts.temp = new Chart(ui.tempChart.getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [{ data: slice.map(d => d.temp), borderColor: COLORS.inside, backgroundColor: COLORS.insideBg, fill: true, tension: 0.4, pointRadius: 0 }] },
        options: lineOpts('°C', 15, 35)
    });
    
    state.charts.hum = new Chart(ui.humChart.getContext('2d'), {
        type: 'line',
        data: { labels, datasets: [{ data: slice.map(d => d.hum), borderColor: COLORS.outside, backgroundColor: COLORS.outsideBg, fill: true, tension: 0.4, pointRadius: 0 }] },
        options: lineOpts('%', 20, 100)
    });
    
    const intervals = get6HrIntervals(indoor, outdoor);
    
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

function get6HrIntervals(indoor, outdoor) {
    const now = new Date();
    const labels = [], inTemp = [], inHum = [], outTemp = [], outHum = [];
    
    for (let i = 0; i <= 4; i++) {
        const hrs = i * 6;
        const t = new Date(now - hrs * 3600000);
        labels.push(i === 0 ? 'NOW' : `-${hrs}hr`);
        
        const inReading = findClosest(indoor, t);
        inTemp.push(inReading.temp);
        inHum.push(inReading.hum);
        
        const idx = findHourIdx(outdoor.hourly.time, t);
        outTemp.push(outdoor.hourly.temperature_2m[idx]);
        outHum.push(outdoor.hourly.relative_humidity_2m[idx]);
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
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#444', font: { size: 9 } } },
            y: { min, max, grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#444', font: { size: 9 }, callback: v => v + unit } }
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
