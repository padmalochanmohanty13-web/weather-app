const cityInput = document.querySelector('.city-input');
const searchBtn = document.querySelector('.search-btn');
const locationBtn = document.querySelector('.location-btn');
const unitToggleBtn = document.querySelector('.unit-toggle-btn');

const weatherInfoSection = document.querySelector('.weather-info');
const searchCitySection = document.querySelector('.search-city');
const notFoundSection = document.querySelector('.not-found');
const loadingStateSection = document.querySelector('.loading-state');

const countryTxt = document.querySelector('.country-txt');
const tempTxt = document.querySelector('.temp-txt');
const conditionTxt = document.querySelector('.condition-txt');
const humidityValueTxt = document.querySelector('.humidity-value-txt');
const windValueTxt = document.querySelector('.wind-value-txt');
const feelsLikeTxt = document.querySelector('.feels-like-txt');
const weatherSummaryImg = document.querySelector('.weather-summary-img');
const currentDateTxt = document.querySelector('.current-date-txt');
const forecastItemsContainer = document.querySelector('.forecast-items-container');

// OpenWeatherMap API Key
const apiKey = 'b6907d289e10d714a6e88b30761fae22';

// State variables
let currentUnit = localStorage.getItem('weather_unit') || 'C'; // 'C' or 'F'
let currentWeatherData = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    updateUnitToggleButton();
    const lastCity = localStorage.getItem('last_weather_city');
    if (lastCity) {
        updateWeatherInfo(lastCity);
    }
});

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
cityInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        handleSearch();
    } else if (event.key === 'Escape') {
        cityInput.value = '';
        cityInput.blur();
    }
});

locationBtn.addEventListener('click', handleGeolocation);
unitToggleBtn.addEventListener('click', toggleTemperatureUnit);

function handleSearch() {
    const city = cityInput.value.trim();
    if (city !== '') {
        updateWeatherInfo(city);
        cityInput.value = '';
        cityInput.blur();
    }
}

function handleGeolocation() {
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser.');
        return;
    }

    showDisplaySection(loadingStateSection);
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude, longitude } = position.coords;
            await updateWeatherByCoordinates(latitude, longitude);
        },
        (error) => {
            console.warn('Geolocation error:', error);
            showDisplaySection(searchCitySection);
            alert('Unable to retrieve your location. Please type your city name.');
        }
    );
}

function toggleTemperatureUnit() {
    currentUnit = currentUnit === 'C' ? 'F' : 'C';
    localStorage.setItem('weather_unit', currentUnit);
    updateUnitToggleButton();
    if (currentWeatherData) {
        renderWeatherUI(currentWeatherData);
    }
}

function updateUnitToggleButton() {
    unitToggleBtn.textContent = `°${currentUnit}`;
}

function convertTemp(celsius) {
    if (currentUnit === 'F') {
        return Math.round((celsius * 9) / 5 + 32);
    }
    return Math.round(celsius);
}

function getWeatherIcon(id) {
    if (id <= 232) return 'thunderstorm.svg';
    if (id <= 321) return 'drizzle.svg';
    if (id <= 531) return 'rain.svg';
    if (id <= 622) return 'snow.svg';
    if (id <= 781) return 'atmosphere.svg';
    if (id === 800) return 'clear.svg';
    return 'clouds.svg';
}

function getCurrentDate() {
    const currentDate = new Date();
    const options = {
        weekday: 'short',
        day: '2-digit',
        month: 'short'
    };
    return currentDate.toLocaleDateString('en-GB', options);
}

function showDisplaySection(section) {
    [weatherInfoSection, searchCitySection, notFoundSection, loadingStateSection].forEach(
        sec => sec.style.display = 'none'
    );
    section.style.display = 'flex';
}

async function getFetchData(endPoint, city) {
    const apiUrl = `https://api.openweathermap.org/data/2.5/${endPoint}?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`;
    const response = await fetch(apiUrl);
    return response.json();
}

async function updateWeatherInfo(city) {
    showDisplaySection(loadingStateSection);
    try {
        let weatherData = await getFetchData('weather', city);

        if (weatherData.cod === '404' || weatherData.cod === 404) {
            showDisplaySection(notFoundSection);
            return;
        }

        // Fallback to open API if key is unauthorized or fails
        if (weatherData.cod === 401 || weatherData.cod === '401' || !weatherData.main) {
            const fallbackData = await fetchFallbackWeatherData(city);
            currentWeatherData = fallbackData;
            localStorage.setItem('last_weather_city', fallbackData.name);
            renderWeatherUI(fallbackData);
            return;
        }

        // Fetch forecast data
        const forecastsData = await getFetchData('forecast', city);
        const forecastList = processOpenWeatherForecast(forecastsData);

        currentWeatherData = {
            name: weatherData.name,
            country: weatherData.sys ? weatherData.sys.country : '',
            temp: weatherData.main.temp,
            feelsLike: weatherData.main.feels_like,
            humidity: weatherData.main.humidity,
            windSpeed: weatherData.wind.speed,
            condition: weatherData.weather[0].main,
            iconId: weatherData.weather[0].id,
            forecast: forecastList
        };

        localStorage.setItem('last_weather_city', weatherData.name);
        renderWeatherUI(currentWeatherData);
    } catch (error) {
        try {
            const fallbackData = await fetchFallbackWeatherData(city);
            currentWeatherData = fallbackData;
            localStorage.setItem('last_weather_city', fallbackData.name);
            renderWeatherUI(fallbackData);
        } catch (err) {
            showDisplaySection(notFoundSection);
        }
    }
}

async function updateWeatherByCoordinates(lat, lon) {
    try {
        const geoRes = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
        const geoData = await geoRes.json();
        const cityName = geoData.city || geoData.locality || geoData.principalSubdivision || 'Current Location';
        const fallbackData = await fetchFallbackByCoords(lat, lon, cityName, geoData.countryCode);
        currentWeatherData = fallbackData;
        localStorage.setItem('last_weather_city', cityName);
        renderWeatherUI(fallbackData);
    } catch (err) {
        console.error(err);
        showDisplaySection(notFoundSection);
    }
}

function processOpenWeatherForecast(forecastsData) {
    if (!forecastsData || !forecastsData.list) return [];
    const timeTaken = '12:00:00';
    const todayDate = new Date().toISOString().split('T')[0];
    const items = [];

    forecastsData.list.forEach(item => {
        if (item.dt_txt.includes(timeTaken) && !item.dt_txt.includes(todayDate)) {
            const d = new Date(item.dt_txt);
            const dateFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            items.push({
                date: dateFormatted,
                id: item.weather[0].id,
                temp: item.main.temp
            });
        }
    });
    return items;
}

const wmoMap = (code) => {
    if (code === 0) return { id: 800, main: 'Clear' };
    if (code <= 3) return { id: 802, main: 'Clouds' };
    if (code <= 48) return { id: 741, main: 'Fog' };
    if (code <= 57) return { id: 300, main: 'Drizzle' };
    if (code <= 67) return { id: 500, main: 'Rain' };
    if (code <= 77) return { id: 600, main: 'Snow' };
    if (code <= 82) return { id: 502, main: 'Heavy Rain' };
    if (code <= 86) return { id: 602, main: 'Heavy Snow' };
    if (code <= 99) return { id: 200, main: 'Thunderstorm' };
    return { id: 800, main: 'Clear' };
};

async function fetchFallbackWeatherData(city) {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`);
    const geoData = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
        throw new Error('City not found');
    }
    const location = geoData.results[0];
    return fetchFallbackByCoords(location.latitude, location.longitude, location.name, location.country_code);
}

async function fetchFallbackByCoords(lat, lon, name, countryCode) {
    const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max&timezone=auto`);
    const weatherData = await weatherRes.json();

    const currentCondition = wmoMap(weatherData.current.weather_code);

    return {
        name: name,
        country: countryCode || '',
        temp: weatherData.current.temperature_2m,
        feelsLike: weatherData.current.apparent_temperature,
        humidity: weatherData.current.relative_humidity_2m,
        windSpeed: weatherData.current.wind_speed_10m,
        condition: currentCondition.main,
        iconId: currentCondition.id,
        forecast: weatherData.daily.time.slice(1, 6).map((dateStr, idx) => {
            const fCondition = wmoMap(weatherData.daily.weather_code[idx + 1]);
            const d = new Date(dateStr);
            const dateFormatted = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
            return {
                date: dateFormatted,
                id: fCondition.id,
                temp: weatherData.daily.temperature_2m_max[idx + 1]
            };
        })
    };
}

function renderWeatherUI(data) {
    countryTxt.textContent = `${data.name}${data.country ? ', ' + data.country : ''}`;
    tempTxt.textContent = `${convertTemp(data.temp)} °${currentUnit}`;
    conditionTxt.textContent = data.condition;
    humidityValueTxt.textContent = `${data.humidity}%`;
    windValueTxt.textContent = `${Math.round(data.windSpeed)} M/s`;
    feelsLikeTxt.textContent = `${convertTemp(data.feelsLike !== undefined ? data.feelsLike : data.temp)} °${currentUnit}`;
    currentDateTxt.textContent = getCurrentDate();
    weatherSummaryImg.src = `assets/weather/${getWeatherIcon(data.iconId)}`;

    forecastItemsContainer.innerHTML = '';
    if (data.forecast && data.forecast.length > 0) {
        data.forecast.forEach(item => {
            const forecastItem = `
                <div class="forecast-item">
                    <h5 class="forecast-item-date">${item.date}</h5>
                    <img src="assets/weather/${getWeatherIcon(item.id)}" class="forecast-item-img" alt="Forecast icon">
                    <h5 class="forecast-item-temp">${convertTemp(item.temp)} °${currentUnit}</h5>
                </div>
            `;
            forecastItemsContainer.insertAdjacentHTML('beforeend', forecastItem);
        });
    }

    showDisplaySection(weatherInfoSection);
}
