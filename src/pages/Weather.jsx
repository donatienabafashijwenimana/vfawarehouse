import { useState, useEffect } from 'react';
import { Cloud, Sun, CloudRain, Wind, Droplets, Thermometer, Eye, AlertTriangle, RefreshCw } from 'lucide-react';
import { AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Simulated weather for Rwanda (Musanze/Karongi region)
const generateWeather = () => ({
  current: {
    location: 'Musanze, Rwanda',
    temp: 18 + Math.random() * 4,
    feelsLike: 16 + Math.random() * 3,
    humidity: 72 + Math.floor(Math.random() * 12),
    windSpeed: 8 + Math.random() * 6,
    visibility: 9 + Math.random() * 3,
    description: 'Partly cloudy with light showers possible',
    icon: 'cloudy',
    pressure: 870 + Math.floor(Math.random() * 15),
    uvIndex: Math.floor(Math.random() * 6) + 2,
  },
  forecast: ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day, i) => ({
    day,
    high: 19 + Math.floor(Math.random() * 5),
    low: 12 + Math.floor(Math.random() * 3),
    rain: Math.floor(Math.random() * 80),
    icon: ['sunny','cloudy','rainy','partly','rainy','sunny','cloudy'][i],
  })),
  hourly: Array.from({length:24},(_,i)=>({
    hour:`${String(i).padStart(2,'0')}:00`,
    temp: 15 + 5 * Math.sin((i - 6) * Math.PI / 12) + Math.random() * 1.5,
    rain: Math.max(0, Math.random() * 30 - 15),
  })),
  irrigation: {
    recommendation: 'Moderate',
    reason: 'Soil moisture at 68% — light rainfall expected tomorrow. Irrigate lightly today.',
    deficit: 12,
    nextRain: 'Tomorrow 14:00',
  },
  disease: {
    lateBlightRisk: 'Medium',
    earlyBlightRisk: 'Low',
    reason: 'Humidity above 70% for 3+ days increases late blight risk. Apply preventive fungicide.',
    action: 'Apply Dithane M-45 @ 2.5 g/L within 48 hours',
  },
});

const WeatherIcon = ({ icon, size = 6 }) => {
  const cls = `w-${size} h-${size}`;
  if (icon === 'sunny') return <Sun className={`${cls} text-yellow-400`} />;
  if (icon === 'rainy') return <CloudRain className={`${cls} text-blue-400`} />;
  return <Cloud className={`${cls} text-gray-400`} />;
};

export default function Weather() {
  const [weather, setWeather] = useState(generateWeather);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const refresh = async () => {
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setWeather(generateWeather());
    setLastUpdate(new Date());
    setLoading(false);
  };

  const { current, forecast, hourly, irrigation, disease } = weather;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Smart Weather Dashboard</h1>
          <p className="text-sm text-gray-500">Integrated with OpenWeatherMap & NASA POWER API simulation</p>
        </div>
        <button onClick={refresh} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-70">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Updating...' : 'Refresh'}
        </button>
      </div>

      {/* Current conditions */}
      <div className="bg-gradient-to-br from-sky-600 to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="text-blue-200 text-sm mb-1">📍 {current.location}</div>
            <div className="flex items-center gap-4">
              <div className="text-6xl font-bold font-display">{current.temp.toFixed(1)}°</div>
              <div>
                <div className="text-xl">{current.description}</div>
                <div className="text-blue-200 text-sm mt-1">Feels like {current.feelsLike.toFixed(1)}°C</div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Droplets, label:'Humidity', val:`${current.humidity}%` },
              { icon: Wind, label:'Wind', val:`${current.windSpeed.toFixed(1)} km/h` },
              { icon: Eye, label:'Visibility', val:`${current.visibility.toFixed(1)} km` },
              { icon: Thermometer, label:'Pressure', val:`${current.pressure} hPa` },
            ].map(({ icon: Icon, label, val }) => (
              <div key={label} className="bg-white/15 rounded-xl px-4 py-3 text-center">
                <Icon className="w-4 h-4 mx-auto mb-1 text-blue-200" />
                <div className="text-sm font-semibold">{val}</div>
                <div className="text-xs text-blue-200">{label}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-blue-200 mt-3">Last updated: {lastUpdate.toLocaleTimeString()}</div>
      </div>

      {/* 7-day forecast */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">7-Day Forecast</h3>
        <div className="grid grid-cols-7 gap-2">
          {forecast.map(day => (
            <div key={day.day} className="text-center p-3 rounded-xl hover:bg-gray-50 transition">
              <div className="text-xs font-medium text-gray-500 mb-2">{day.day}</div>
              <WeatherIcon icon={day.icon} size={6} />
              <div className="mt-2">
                <div className="text-sm font-bold text-gray-800">{day.high}°</div>
                <div className="text-xs text-gray-400">{day.low}°</div>
              </div>
              <div className="text-xs text-blue-500 mt-1">{day.rain}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">24-Hour Temperature</h3>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={hourly.filter((_,i)=>i%2===0)}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="hour" tick={{fontSize:10}} interval={2} />
              <YAxis domain={[10,25]} tick={{fontSize:11}} />
              <Tooltip formatter={v=>[`${v.toFixed(1)}°C`,'Temp']} />
              <Area type="monotone" dataKey="temp" stroke="#0a6de0" fill="#cce4ff" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Rainfall Probability (%)</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={forecast}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{fontSize:11}} />
              <YAxis domain={[0,100]} tick={{fontSize:11}} />
              <Tooltip formatter={v=>[`${v}%`,'Rain probability']} />
              <Bar dataKey="rain" fill="#5fa8ff" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Smart Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Droplets className="w-4 h-4 text-blue-500" /> Irrigation Recommendation
          </h3>
          <div className={`px-4 py-3 rounded-xl mb-3 ${irrigation.recommendation==='High'?'bg-red-50 text-red-700':irrigation.recommendation==='Moderate'?'bg-yellow-50 text-yellow-700':'bg-green-50 text-green-700'}`}>
            <span className="font-bold">Need: {irrigation.recommendation}</span>
          </div>
          <p className="text-sm text-gray-600 mb-2">{irrigation.reason}</p>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400">Water Deficit</div>
              <div className="font-bold text-gray-700 mt-1">{irrigation.deficit} mm</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <div className="text-xs text-gray-400">Next Rain</div>
              <div className="font-bold text-gray-700 mt-1">{irrigation.nextRain}</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-orange-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" /> Disease Risk Assessment
          </h3>
          <div className="space-y-2 mb-3">
            {[['Late Blight', disease.lateBlightRisk], ['Early Blight', disease.earlyBlightRisk]].map(([name, risk]) => (
              <div key={name} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">{name}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${risk==='High'?'bg-red-100 text-red-700':risk==='Medium'?'bg-orange-100 text-orange-700':'bg-green-100 text-green-700'}`}>{risk}</span>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mb-2">{disease.reason}</p>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-xs text-orange-800">
            <strong>Action:</strong> {disease.action}
          </div>
        </div>
      </div>
    </div>
  );
}
