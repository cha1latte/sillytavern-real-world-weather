// Import from SillyTavern core
import { extension_settings, getContext, loadExtensionSettings } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";

// Extension name MUST match folder name
const extensionName = "sillytavern-real-world-weather";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

console.log(`[${extensionName}] Script loaded, starting initialization...`);

// Default settings
const defaultSettings = {
    location: ""
};

// Load saved settings
async function loadSettings() {
    console.log(`[${extensionName}] Loading settings...`);
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    $("#weather_location").val(extension_settings[extensionName].location);
    console.log(`[${extensionName}] Settings loaded:`, extension_settings[extensionName]);
}

// Handle location input change
function onLocationChange(event) {
    const value = String($(event.target).val());
    extension_settings[extensionName].location = value;
    saveSettingsDebounced();
    console.log(`[${extensionName}] Location saved:`, value);
}

// Fetch weather data
async function fetchWeather() {
    const location = extension_settings[extensionName].location;
    
    if (!location) {
        toastr.warning("Please enter a location first", "Real-World Weather");
        return;
    }
    
    console.log(`[${extensionName}] Fetching weather for:`, location);
    toastr.info("Fetching weather data...", "Real-World Weather");
    
    try {
        // Step 1: Geocode the location to get coordinates
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
        const geoResponse = await fetch(geoUrl);
        const geoData = await geoResponse.json();
        
        if (!geoData.results || geoData.results.length === 0) {
            toastr.error("Location not found. Try a different city name.", "Real-World Weather");
            return;
        }
        
        const { latitude, longitude, name, country } = geoData.results[0];
        console.log(`[${extensionName}] Found coordinates:`, latitude, longitude);
        
        // Step 2: Fetch weather data
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph`;
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();
        
        // Display results
        const temp = weatherData.current.temperature_2m;
        const humidity = weatherData.current.relative_humidity_2m;
        const windSpeed = weatherData.current.wind_speed_10m;
        
        const message = `📍 ${name}, ${country}\n🌡️ ${temp}°F\n💧 ${humidity}% humidity\n💨 ${windSpeed} mph wind`;
        
        toastr.success(message, "Current Weather", { timeOut: 10000 });
        console.log(`[${extensionName}] Weather data:`, weatherData.current);
        
    } catch (error) {
        console.error(`[${extensionName}] Error fetching weather:`, error);
        toastr.error("Failed to fetch weather data", "Real-World Weather");
    }
}

// Extension initialization
jQuery(async () => {
    console.log(`[${extensionName}] jQuery ready, starting async init...`);
   
    try {
        console.log(`[${extensionName}] Attempting to load HTML from:`, `${extensionFolderPath}/example.html`);
        
        // Load HTML from file
        const settingsHtml = await $.get(`${extensionFolderPath}/example.html`);
        console.log(`[${extensionName}] HTML loaded, length:`, settingsHtml.length);
       
        // Append to settings panel (right column for UI extensions)
        $("#extensions_settings2").append(settingsHtml);
        console.log(`[${extensionName}] HTML appended to #extensions_settings2`);
       
        // Bind events
        $("#weather_location").on("input", onLocationChange);
        console.log(`[${extensionName}] Location input event bound`);
        
        $("#weather_fetch_button").on("click", fetchWeather);
        console.log(`[${extensionName}] Fetch button event bound`);
       
        // Load saved settings
        await loadSettings();
       
        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
        console.error(`[${extensionName}] Error stack:`, error.stack);
    }
});
