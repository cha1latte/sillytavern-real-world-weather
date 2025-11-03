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
    lastFetchTime: 0,  // Timestamp of last successful fetch
    useCelsius: false  // Temperature unit preference
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

// US State abbreviations mapping
const US_STATE_ABBREV = {
    'al': 'alabama',
    'ak': 'alaska',
    'az': 'arizona',
    'ar': 'arkansas',
    'ca': 'california',
    'co': 'colorado',
    'ct': 'connecticut',
    'de': 'delaware',
    'fl': 'florida',
    'ga': 'georgia',
    'hi': 'hawaii',
    'id': 'idaho',
    'il': 'illinois',
    'in': 'indiana',
    'ia': 'iowa',
    'ks': 'kansas',
    'ky': 'kentucky',
    'la': 'louisiana',
    'me': 'maine',
    'md': 'maryland',
    'ma': 'massachusetts',
    'mi': 'michigan',
    'mn': 'minnesota',
    'ms': 'mississippi',
    'mo': 'missouri',
    'mt': 'montana',
    'ne': 'nebraska',
    'nv': 'nevada',
    'nh': 'new hampshire',
    'nj': 'new jersey',
    'nm': 'new mexico',
    'ny': 'new york',
    'nc': 'north carolina',
    'nd': 'north dakota',
    'oh': 'ohio',
    'ok': 'oklahoma',
    'or': 'oregon',
    'pa': 'pennsylvania',
    'ri': 'rhode island',
    'sc': 'south carolina',
    'sd': 'south dakota',
    'tn': 'tennessee',
    'tx': 'texas',
    'ut': 'utah',
    'vt': 'vermont',
    'va': 'virginia',
    'wa': 'washington',
    'wv': 'west virginia',
    'wi': 'wisconsin',
    'wy': 'wyoming',
};

// Get weather description from code
function getWeatherDescription(code) {
    return WEATHER_DESCRIPTIONS[code] || "Unknown conditions";
}

// Normalize state/region name (convert abbreviations to full names)
function normalizeRegionName(region) {
    const lower = region.toLowerCase().trim();
    return US_STATE_ABBREV[lower] || lower;
}

// Load saved settings
async function loadSettings() {
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
    }
    $("#weather_location").val(extension_settings[extensionName].location);
    $("#weather_auto_inject").prop("checked", extension_settings[extensionName].autoInject);
    $("#weather_use_celsius").prop("checked", extension_settings[extensionName].useCelsius);
    
    // Display last weather if available
    if (extension_settings[extensionName].lastWeather) {
        displayWeather(extension_settings[extensionName].lastWeather);
    }
}

// Handle location input change
function onLocationChange(event) {
    const value = String($(event.target).val());
    const oldLocation = extension_settings[extensionName].location;
    
    extension_settings[extensionName].location = value;
    
    // If location changed significantly, clear the cache so user can fetch immediately
    if (oldLocation && value && oldLocation.toLowerCase() !== value.toLowerCase()) {
        extension_settings[extensionName].lastFetchTime = 0;
        console.log(`[${extensionName}] Location changed, cache cleared`);
    }
    
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

// Handle temperature unit checkbox change
function onUseCelsiusChange(event) {
    const value = Boolean($(event.target).prop("checked"));
    extension_settings[extensionName].useCelsius = value;
    saveSettingsDebounced();
    
    // Refresh display if weather data exists
    if (extension_settings[extensionName].lastWeather) {
        displayWeather(extension_settings[extensionName].lastWeather);
        if (extension_settings[extensionName].autoInject) {
            updateDefaultAuthorNote();
        }
    }
    
    console.log(`[${extensionName}] Temperature unit changed to:`, value ? "Celsius" : "Fahrenheit");
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
    
    const useCelsius = extension_settings[extensionName].useCelsius;
    const tempDisplay = useCelsius ? `${weatherData.tempC}°C` : `${weatherData.tempF}°F`;
    const windDisplay = useCelsius ? `${weatherData.windSpeedKmh} km/h` : `${weatherData.windSpeedMph} mph`;
    
    const weatherText = `Current Weather in ${weatherData.locationName}: ${weatherData.condition}, ${tempDisplay}, ${weatherData.humidity}% humidity, wind ${windDisplay}`;
    
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
    const useCelsius = extension_settings[extensionName].useCelsius;
    const tempDisplay = useCelsius ? `${weatherData.tempC}°C` : `${weatherData.tempF}°F`;
    const windDisplay = useCelsius ? `${weatherData.windSpeedKmh} km/h` : `${weatherData.windSpeedMph} mph`;
    
    const html = `
        <div style="background: var(--SmartThemeBlurTintColor); padding: 10px; border-radius: 5px; margin-top: 10px;">
            <div style="font-weight: bold; margin-bottom: 5px;">📍 ${weatherData.locationName}</div>
            <div>☁️ Conditions: ${weatherData.condition}</div>
            <div>🌡️ Temperature: ${tempDisplay}</div>
            <div>💧 Humidity: ${weatherData.humidity}%</div>
            <div>💨 Wind Speed: ${windDisplay}</div>
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
        let latitude, longitude, locationName;
        
        // Check if input is coordinates (format: lat,lon or lat, lon)
        const coordMatch = location.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/);
        if (coordMatch) {
            latitude = parseFloat(coordMatch[1]);
            longitude = parseFloat(coordMatch[2]);
            locationName = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
            console.log(`[${extensionName}] Using coordinates:`, latitude, longitude);
        } else {
            // It's a location name - geocode it
            // Parse the input to separate city from region/country
            const parts = location.split(',').map(s => s.trim());
            const cityName = parts[0]; // Always use the first part as city name
            const regionName = parts.length >= 2 ? parts[1].toLowerCase() : null;
            
            // Search for just the city name (API doesn't like "City, State" format)
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName)}&count=10&language=en&format=json`;
            console.log(`[${extensionName}] Geocoding URL:`, geoUrl);
            console.log(`[${extensionName}] Searching for city: "${cityName}"`, regionName ? `with region: "${regionName}"` : '');
            
            const geoResponse = await fetch(geoUrl);
            const geoData = await geoResponse.json();
            
            console.log(`[${extensionName}] Geocoding results:`, geoData);
            
            if (!geoData.results || geoData.results.length === 0) {
                toastr.error(`Location "${cityName}" not found. Try:\n- "City, State" (e.g., "Decatur, Georgia")\n- "City, Country" (e.g., "Paris, France")\n- Coordinates (e.g., "33.7748,-84.2963")`, "Real-World Weather", { timeOut: 8000 });
                return;
            }
            
            // Log all results for debugging
            console.log(`[${extensionName}] Found ${geoData.results.length} results:`);
            geoData.results.forEach((result, index) => {
                console.log(`[${extensionName}] Result ${index}:`, {
                    name: result.name,
                    admin1: result.admin1,
                    country: result.country,
                    latitude: result.latitude,
                    longitude: result.longitude
                });
            });
            
            // Select the best match
            let selectedResult = geoData.results[0]; // Default to first result
            
            // If user specified a region, try to find a match
            if (regionName) {
                console.log(`[${extensionName}] Filtering by region: "${regionName}"`);
                
                // Normalize the search term (convert abbreviations like "GA" to "georgia")
                const normalizedSearch = normalizeRegionName(regionName);
                console.log(`[${extensionName}] Normalized search: "${normalizedSearch}"`);
                
                const exactMatch = geoData.results.find(result => {
                    // Check if admin1 (state/province) or country matches
                    const admin1Lower = result.admin1 ? result.admin1.toLowerCase() : '';
                    const countryLower = result.country ? result.country.toLowerCase() : '';
                    
                    // Normalize the result's state name too
                    const normalizedAdmin1 = normalizeRegionName(admin1Lower);
                    const normalizedCountry = normalizeRegionName(countryLower);
                    
                    // Match using normalized names
                    const matchAdmin1 = normalizedAdmin1 === normalizedSearch || 
                                       admin1Lower.includes(normalizedSearch) || 
                                       normalizedSearch.includes(normalizedAdmin1);
                    const matchCountry = normalizedCountry === normalizedSearch || 
                                        countryLower.includes(normalizedSearch) || 
                                        normalizedSearch.includes(normalizedCountry);
                    
                    console.log(`[${extensionName}] Checking ${result.name}:`, {
                        admin1: result.admin1,
                        normalizedAdmin1,
                        country: result.country,
                        matchAdmin1,
                        matchCountry
                    });
                    
                    return matchAdmin1 || matchCountry;
                });
                
                if (exactMatch) {
                    selectedResult = exactMatch;
                    console.log(`[${extensionName}] ✅ Found match for region:`, selectedResult.name, selectedResult.admin1, selectedResult.country);
                } else {
                    console.log(`[${extensionName}] ⚠️ No match for region "${regionName}", using first result`);
                    toastr.warning(`Couldn't find ${cityName} in ${regionName}. Using ${geoData.results[0].name}, ${geoData.results[0].admin1 || geoData.results[0].country}`, "Real-World Weather", { timeOut: 5000 });
                }
            }
            
            latitude = selectedResult.latitude;
            longitude = selectedResult.longitude;
            const name = selectedResult.name;
            const region = selectedResult.admin1 ? `${selectedResult.admin1}, ` : '';
            const country = selectedResult.country;
            locationName = `${name}, ${region}${country}`;
            
            console.log(`[${extensionName}] Selected location:`, locationName);
            console.log(`[${extensionName}] Coordinates:`, latitude, longitude);
        }
        
        // Step 2: Fetch weather data (get both units from API)
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh`;
        const weatherResponse = await fetch(weatherUrl);
        const weatherData = await weatherResponse.json();
        
        // Prepare display data (store both units)
        const tempC = Math.round(weatherData.current.temperature_2m);
        const tempF = Math.round((tempC * 9/5) + 32);
        const humidity = weatherData.current.relative_humidity_2m;
        const windSpeedKmh = Math.round(weatherData.current.wind_speed_10m);
        const windSpeedMph = Math.round(windSpeedKmh * 0.621371);
        const weatherCode = weatherData.current.weather_code;
        const condition = getWeatherDescription(weatherCode);
        const timestamp = new Date().toLocaleString();
        
        const displayData = {
            locationName: locationName,
            condition: condition,
            tempC: tempC,
            tempF: tempF,
            humidity: humidity,
            windSpeedKmh: windSpeedKmh,
            windSpeedMph: windSpeedMph,
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
        toastr.success(`Weather updated for ${locationName}`, "Real-World Weather");
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
    
    const useCelsius = extension_settings[extensionName].useCelsius;
    const tempDisplay = useCelsius ? `${weatherData.tempC}°C` : `${weatherData.tempF}°F`;
    const windDisplay = useCelsius ? `${weatherData.windSpeedKmh} km/h` : `${weatherData.windSpeedMph} mph`;
    
    // Create weather context message
    const weatherContext = `Current Weather in ${weatherData.locationName}: ${weatherData.condition}, ${tempDisplay}, ${weatherData.humidity}% humidity, wind ${windDisplay}`;
    
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
        $("#weather_use_celsius").on("input", onUseCelsiusChange);
       
        // Load saved settings
        await loadSettings();
       
        console.log(`[${extensionName}] ✅ Loaded successfully`);
    } catch (error) {
        console.error(`[${extensionName}] ❌ Failed to load:`, error);
    }
});
