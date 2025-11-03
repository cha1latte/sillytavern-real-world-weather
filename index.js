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
    autoInject: false
};

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
    
    if (value) {
        toastr.info("Weather will now be automatically included in chat context", "Real-World Weather");
    } else {
        toastr.info("Auto-inject disabled", "Real-World Weather");
    }
    
    console.log(`[${extensionName}] Auto-inject set to:`, value);
}

// Display weather in UI
function displayWeather(weatherData) {
    const html = `
        <div style="background: var(--SmartThemeBlurTintColor); padding: 10px; border-radius: 5px; margin-top: 10px;">
            <div style="font-weight: bold; margin-bottom: 5px;">📍 ${weatherData.locationName}</div>
            <div>🌡️ Temperature: ${weatherData.temp}°F</div>
            <div>💧 Humidity: ${weatherData.humidity}%</div>
            <div>💨 Wind Speed: ${weatherData.windSpeed} mph</div>
            <div style="font-size: 0.8em; margin-top: 5px; opacity: 0.7;">Last updated: ${weatherData.timestamp}</div>
        </div>
    `;
    $("#weather_display").html(html);
}

// Fetch weather data
async function fetchWeather() {
    const location = extension_settings[extensionName].location.trim();
    
    if (!location) {
        toastr.warning("Please enter a location first", "Real-World Weather");
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
        const timestamp = new Date().toLocaleString();
        
        const displayData = {
            locationName: `${name}, ${country}`,
            temp: temp,
            humidity: humidity,
            windSpeed: windSpeed,
            timestamp: timestamp,
            raw: weatherData.current
        };
        
        // Save to settings
        extension_settings[extensionName].lastWeather = displayData;
        saveSettingsDebounced();
        
        // Display in UI
        displayWeather(displayData);
        
        // Also show toast
        toastr.success(`Weather updated for ${name}, ${country}`, "Real-World Weather");
        console.log(`[${extensionName}] Weather data:`, weatherData.current);
        
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
    const weatherContext = `[Current Weather in ${weatherData.locationName}: ${weatherData.temp}°F, ${weatherData.humidity}% humidity, wind ${weatherData.windSpeed} mph]`;
    
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
