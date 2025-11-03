// Import from SillyTavern core
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// Extension name MUST match folder name
const extensionName = "sillytavern-real-world-weather";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// Default settings
const defaultSettings = {
    location: "",
    lastWeather: null,
    autoInject: false,
    lastFetchTime: 0  // Timestamp of last successful fetch
};

// Cache duration in milliseconds (1 minute)
const CACHE_DURATION = 60 * 1000; // 60 seconds

// Weather code descriptions (WMO Weather interpretation codes)
const WEATHER_DESCRIPTIONS = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Foggy",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    56: "Light freezing drizzle",
    57: "Dense freezing drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    66: "Light freezing rain",
    67: "Heavy freezing rain",
    71: "Slight snow fall",
    73: "Moderate snow fall",
    75: "Heavy snow fall",
    77: "Snow grains",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    85: "Slight snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail"
};

// Get weather description from code
function getWeatherDescription(code) {
    return WEATHER_DESCRIPTIONS[code] || "Unknown conditions";
}

// Load saved settings
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    $("#weather_location").val(extension_settings[extensionName].location);
    $("#weather_auto_inject").prop("checked", extension_settings[extensionName].autoInject);
    
    // Display last weather if available
    if (extension_settings[extensionName].lastWeather) {
        displayWeather(extension_settings[extensionName].lastWeather);
    }
}

// Handle location input change
function onLocationChange(event) {
    const value = String($(event.target).val());
    extension_settings[extensionName].location = value;
    saveSettingsDebounced();
}

// Handle auto-inject checkbox change
function onAutoInjectChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].autoInject = value;
    saveSettingsDebounced();
    
    if (value && extension_settings[extensionName].lastWeather) {
        updateDefaultAuthorNote();
        toastr.info("Weather added to Default Author's Note", "Real-World Weather");
    } else if (!value) {
        clearDefaultAuthorNote();
        toastr.info("Weather removed from Default Author's Note", "Real-World Weather");
    }
    
    console.log(`[${extensionName}] Auto-inject set to:`, value);
}

// Update Default Author's Note with weather
function updateDefaultAuthorNote() {
    const weatherData = extension_settings[extensionName].lastWeather;
    const autoInject = extension_settings[extensionName].autoInject;
    
    if (!autoInject || !weatherData) {
        return;
    }
    
    const context = getContext();
    
    // Access the note_default setting (Default Author's Note content)
    const settings = context.settings || {};
    const currentNote = settings.note_default || "";
    
    const weatherText = `Current Weather in ${weatherData.locationName}: ${weatherData.condition}, ${weatherData.temp}°F, ${weatherData.humidity}% humidity, wind ${weatherData.windSpeed} mph`;
    
    console.log(`[${extensionName}] Current Default Author's Note:`, currentNote);
    
    // Check if weather is already in the note
    if (currentNote.includes("Current Weather in")) {
        // Replace existing weather
        const newNote = currentNote.replace(/Current Weather in[^\n]+/g, weatherText);
        settings.note_default = newNote;
    } else {
        // Add weather to the note
        const newNote = currentNote ? `${currentNote}\n\n${weatherText}` : weatherText;
        settings.note_default = newNote;
    }
    
    // Update the textarea if it's visible
    const textarea = $("#extension_floating_default");
    if (textarea.length > 0) {
        textarea.val(settings.note_default);
        textarea.trigger("input");
    }
    
    // Save settings
    saveSettingsDebounced();
    
    console.log(`[${extensionName}] Weather added to Default Author's Note:`, weatherText);
}

// Clear weather from Default Author's Note
function clearDefaultAuthorNote() {
    const context = getContext();
    const settings = context.settings || {};
    const currentNote = settings.note_default || "";
    
    if (currentNote.includes("Current Weather in")) {
        // Remove weather line(s)
        const newNote = currentNote.replace(/Current Weather in[^\n]+\n*/g, "").trim();
        settings.note_default = newNote;
        
        // Update the textarea if it's visible
        const textarea = $("#extension_floating_default");
        if (textarea.length > 0) {
            textarea.val(newNote);
            textarea.trigger("input");
        }
        
        // Save settings
        saveSettingsDebounced();
        
        console.log(`[${extensionName}] Weather removed from Default Author's Note`);
    }
}

// Display weather in UI
function displayWeather(weatherData) {
    const html = `
        <div style="background: var(--SmartThemeBlurTintColor); padding: 10px; border-radius: 5px; margin-top: 10px;">
            <div style="font-weight: bold; margin-bottom: 5px;">📍 ${weatherData.locationName}</div>
            <div>☁️ Conditions: ${weatherData.condition}</div>
            <div>🌡️ Temperature: ${weatherData.temp}°F</div>
            <div>💧 Humidity: ${weatherData.humidity}%</div>
            <div>💨 Wind Speed: ${weatherData.windSpeed} mph</div>
            <div style="font-size: 0.8em; margin-top: 5px; opacity: 0.7;">Last updated: ${weatherData.timestamp}</div>
        </div>
    `;
    $("#weather_display").html(html);
}

// Check if cache is still valid
function isCacheValid() {
    const lastFetchTime = extension_settings[extensionName].lastFetchTime || 0;
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    
    return timeSinceLastFetch < CACHE_DURATION;
}

// Get time remaining until next fetch is allowed
function getTimeUntilNextFetch() {
    const lastFetchTime = extension_settings[extensionName].lastFetchTime || 0;
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTime;
    const timeRemaining = CACHE_DURATION - timeSinceLastFetch;
    
    return Math.ceil(timeRemaining / 1000); // Return seconds
}

// Fetch weather data
async function fetchWeather() {
    const location = extension_settings[extensionName].location.trim();
    
    if (!location) {
        toastr.warning("Please enter a location first", "Real-World Weather");
        return;
    }
    
    // Check cache validity
    if (isCacheValid() && extension_settings[extensionName].lastWeather) {
        const secondsRemaining = getTimeUntilNextFetch();
        toastr.info(
            `Using cached weather data. Next fetch available in ${secondsRemaining} seconds.`,
            "Real-World Weather",
            { timeOut: 3000 }
        );
        console.log(`[${extensionName}] Cache still valid. ${secondsRemaining}s until next fetch allowed.`);
        return;
    }
    
    console.log(`[${extensionName}] Fetching weather for:`, location);
    toastr.info("Fetching weather data...", "Real-World Weather");
    
    try {
        // Clean up location string (remove state/country codes if present)
        const cleanLocation = location.split(',')[0].trim();
        
        // Step 1: Geocode the location to get coordinates
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanLocation)}&count=1&language=en&format=json`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            toastr.error(`Location "${cleanLocation}" not found. Try just the city name (e.g., "New York" instead of "New York, NY")`, "Real-World Weather");
            return;
        }
        
        const { latitude, longitude, name, country } = geoData.results[0];
        console.log(`[${extensionName}] Found coordinates:`, latitude, longitude);
        
        // Step 2: Fetch weather data
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`;
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();
        
        // Prepare display data
        const temp = weatherData.current.temperature_2m;
        const humidity = weatherData.current.relative_humidity_2m;
        const windSpeed = weatherData.current.wind_speed_10m;
        const weatherCode = weatherData.current.weather_code;
        const condition = getWeatherDescription(weatherCode);
        const timestamp = new Date().toLocaleString();
        
        const displayData = {
            locationName: `${name}, ${country}`,
            condition: condition,
            temp: temp,
            humidity: humidity,
            windSpeed: windSpeed,
            timestamp: timestamp,
            raw: weatherData.current
        };
        
        // Save to settings
        extension_settings[extensionName].lastWeather = displayData;
        extension_settings[extensionName].lastFetchTime = Date.now(); // Update cache timestamp
        saveSettingsDebounced();
        
        // Display in UI
        displayWeather(displayData);
        
        // Update Default Author's Note if auto-inject is enabled
        if (extension_settings[extensionName].autoInject) {
            updateDefaultAuthorNote();
        }
        
        // Also show toast
        toastr.success(`Weather updated for ${name}, ${country}`, "Real-World Weather");
        console.log(`[${extensionName}] Weather data:`, weatherData.current);
        console.log(`[${extensionName}] Condition: ${condition} (code: ${weatherCode})`);
        console.log(`[${extensionName}] Cache updated. Next fetch allowed in 60 seconds.`);
        
    } catch (error) {
        console.error(`[${extensionName}] Error fetching weather:`, error);
        toastr.error("Failed to fetch weather data. Check console for details.", "Real-World Weather");
    }
}

// Insert weather into chat
function insertWeatherIntoChat() {
    const weatherData = extension_settings[extensionName].lastWeather;
    
    if (!weatherData) {
        toastr.warning("Please fetch weather data first", "Real-World Weather");
        return;
    }
    
    // Create weather context message
    const weatherContext = `Current Weather in ${weatherData.locationName}: ${weatherData.condition}, ${weatherData.temp}°F, ${weatherData.humidity}% humidity, wind ${weatherData.windSpeed} mph`;
    
    // Get the chat textarea
    const textarea = $("#send_textarea");
    const currentText = textarea.val();
    
    // Insert weather at cursor or append
    if (currentText) {
        textarea.val(currentText + "\n" + weatherContext);
    } else {
        textarea.val(weatherContext);
    }
    
    toastr.success("Weather context added to message", "Real-World Weather");
    console.log(`[${extensionName}] Weather inserted:`, weatherContext);
}

// Extension initialization
jQuery(async () => {
    console.log(`[${extensionName}] Loading...`);
   
    try {
        // Load HTML from file
        const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
       
        // Append to settings panel (right column for UI extensions)
        $("#extensions_settings2").append(settingsHtml);
       
        // Bind events
        $("#weather_location").on("input", onLocationChange);
        $("#weather_fetch_button").on("click", fetchWeather);
        $("#weather_insert_button").on("click", insertWeatherIntoChat);
        $("#weather_auto_inject").on("input", onAutoInjectChange);
       
        // Load saved settings
        await loadSettings();
       
        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
    }
});
