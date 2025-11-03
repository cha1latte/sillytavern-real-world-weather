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
            // Try with full string first (supports "City, State" or "City, Country")
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=10&language=en&format=json`;
            const geoResponse = await fetch(geoUrl);
            const geoData = await geoResponse.json();
            
            if (!geoData.results || geoData.results.length === 0) {
                toastr.error(`Location "${location}" not found. Try:\n- "City, State" (e.g., "Decatur, Georgia")\n- "City, Country" (e.g., "Paris, France")\n- Coordinates (e.g., "33.7748,-84.2963")`, "Real-World Weather", { timeOut: 8000 });
                return;
            }
            
            // If multiple results, try to find best match
            let selectedResult = geoData.results[0]; // Default to first result
            
            // If user entered "City, Region" format, try to match
            const parts = location.split(',').map(s => s.trim());
            if (parts.length >= 2) {
                const cityName = parts[0].toLowerCase();
                const regionName = parts[1].toLowerCase();
                
                // Try to find exact match for city + region/country
                const exactMatch = geoData.results.find(result => {
                    const matchCity = result.name.toLowerCase() === cityName;
                    const matchRegion = (result.admin1 && result.admin1.toLowerCase().includes(regionName)) ||
                                       (result.country && result.country.toLowerCase().includes(regionName));
                    return matchCity && matchRegion;
                });
                
                if (exactMatch) {
                    selectedResult = exactMatch;
                    console.log(`[${extensionName}] Found exact match:`, selectedResult.name, selectedResult.admin1 || selectedResult.country);
                }
            }
            
            latitude = selectedResult.latitude;
            longitude = selectedResult.longitude;
            const name = selectedResult.name;
            const region = selectedResult.admin1 ? `${selectedResult.admin1}, ` : '';
            const country = selectedResult.country;
            locationName = `${name}, ${region}${country}`;
            
            console.log(`[${extensionName}] Found coordinates:`, latitude, longitude);
            console.log(`[${extensionName}] Full location:`, locationName);
        }
        
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
            locationName: locationName,
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
        toastr.success(`Weather updated for ${locationName}`, "Real-World Weather");
        console.log(`[${extensionName}] Weather data:`, weatherData.current);
        console.log(`[${extensionName}] Condition: ${condition} (code: ${weatherCode})`);
        console.log(`[${extensionName}] Cache updated. Next fetch allowed in 60 seconds.`);
        
    } catch (error) {
        console.error(`[${extensionName}] Error fetching weather:`, error);
        toastr.error("Failed to fetch weather data. Check console for details.", "Real-World Weather");
    }
}
