# Real-World Weather Extension for SillyTavern

Fetch real-world weather data and automatically inject it into your chats for immersive roleplays.

## Features

- 🌍 Real-time weather from Open-Meteo API (free, no API key needed)
- 📍 Support for city names, coordinates, and "City, State/Country" format
- ☁️ Weather conditions: Clear, Cloudy, Rain, Snow, Thunderstorms, and more
- 🌡️ Toggle between Celsius and Fahrenheit
- 📝 Auto-inject weather into Author's Note or manually insert into messages
- ⚡ Smart 1-minute cache to prevent API spam
- 💾 Saves your location and preferences

## Installation

1. Open SillyTavern
2. Go to **Extensions → Install Extension**
3. Paste GitHub URL: `https://github.com/cha1latte/sillytavern-real-world-weather`
4. Refresh the page

## Usage

1. Open **Extensions** settings (right panel)
2. Find **Real-World Weather**
3. Enter a location:
   - `Tokyo`
   - `Paris, France`
   - `Springfield, Illinois`
   - `40.7128,-74.0060` (coordinates)
4. Click **Fetch Weather**
5. Enable **Auto-inject** to add weather to all chats automatically

## Location Examples

- ✅ `London` - Simple city name
- ✅ `Portland, Oregon` - Specify state to avoid ambiguity
- ✅ `Portland, OR` - State abbreviations work
- ✅ `Sydney, Australia` - International cities
- ✅ `35.6895,139.6917` - Precise coordinates

## Weather Output Example
```
Current Weather in Tokyo, Japan: Partly cloudy, 61°F, 55% humidity, wind 6 mph
```

## Tips

- Add state/country for cities with common names (e.g., "Springfield, Massachusetts")
- US state abbreviations are supported (IL, NY, CA, etc.)
- Weather fetches are limited to once per minute - change location to fetch immediately
- Toggle Celsius/Fahrenheit anytime without re-fetching

## Troubleshooting

**Location not found?** Try just the city name or add the country.

**Wrong location?** Include the state or country (e.g., "Paris, Texas" vs "Paris, France")

**Cache cooldown?** Wait 60 seconds or change the location to fetch fresh data.

## Credits

- Weather data: [Open-Meteo](https://open-meteo.com/)
- Built for [SillyTavern](https://github.com/SillyTavern/SillyTavern)

## License

MIT
