import { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { Thermometer, Droplets, Wind, Sun, Activity, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function Gauge({ label, value, min, max, unit, icon: Icon, colorFn }) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));
  const color = colorFn(value);
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-2 ${color}`} />
      <div className={`text-2xl font-bold ${color}`}>{value}<span className="text-sm font-normal text-gray-400 ml-0.5">{unit}</span></div>
      <div className="text-xs text-gray-400 mb-2">{label}</div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-500 ${color.replace('text-','bg-')}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-gray-300 mt-1">
        <span>{min}</span><span>{max}</span>
      </div>
    </div>
  );
}

const genHistory = (base, variance, points = 12) =>
  Array.from({ length: points }, (_, i) => ({
    time: `${(i * 2).toString().padStart(2,'0')}:00`,
    value: +(base + (Math.random() - 0.5) * variance * 2).toFixed(1),
  }));

export default function Greenhouse() {
  const { greenhouse } = useStore();
  const [selected, setSelected] = useState(0);
  const [history, setHistory] = useState({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const gh = greenhouse[selected];

  const tempHistory = genHistory(gh.temp, 2);
  const humHistory = genHistory(gh.humidity, 5);

  const rec = () => {
    const issues = [];
    if (gh.temp > 26) issues.push('⚠️ Temperature above 26°C — consider ventilation');
    if (gh.temp < 15) issues.push('⚠️ Temperature below 15°C — increase heating');
    if (gh.humidity > 80) issues.push('⚠️ High humidity — risk of fungal disease. Reduce irrigation and increase airflow');
    if (gh.soilMoisture < 50) issues.push('💧 Soil moisture low — irrigate within 24 hours');
    if (gh.co2 > 450) issues.push('🌿 CO₂ elevated — check ventilation system');
    if (issues.length === 0) issues.push('✅ All parameters optimal — no action required');
    return issues;
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-800">Greenhouse Monitoring</h1>
        <p className="text-sm text-gray-500">Real-time sensor data and recommendations</p>
      </div>

      {/* GH selector */}
      <div className="flex gap-3 flex-wrap">
        {greenhouse.map((g, i) => (
          <button key={g.id} onClick={() => setSelected(i)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${selected === i ? 'text-white border-transparent shadow-md' : 'bg-white border-gray-200 text-gray-600 hover:border-green-300'}`}
            style={selected === i ? { background: 'linear-gradient(135deg,#2d9e2d,#1f7a1f)' } : {}}>
            {g.name}
            <span className={`ml-2 text-xs ${g.status === 'Optimal' ? 'text-green-300' : 'text-orange-300'}`}>●</span>
          </button>
        ))}
      </div>

      {/* Status header */}
      <div className={`rounded-2xl p-4 flex items-center gap-4 ${gh.status === 'Optimal' ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${gh.status === 'Optimal' ? 'bg-green-100' : 'bg-orange-100'}`}>
          <Activity className={`w-6 h-6 ${gh.status === 'Optimal' ? 'text-green-600' : 'text-orange-600'}`} />
        </div>
        <div>
          <div className="font-semibold text-gray-800">{gh.name} — Status: <span className={gh.status === 'Optimal' ? 'text-green-600' : 'text-orange-600'}>{gh.status}</span></div>
          <div className="text-xs text-gray-500">Last updated: {new Date().toLocaleTimeString()}</div>
        </div>
        <div className="ml-auto text-xs text-gray-400 hidden sm:block">Auto-refresh every 5s</div>
      </div>

      {/* Gauges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Gauge label="Temperature" value={gh.temp} min={10} max={35} unit="°C" icon={Thermometer}
          colorFn={v => v < 15 || v > 28 ? 'text-red-500' : v > 25 ? 'text-orange-500' : 'text-green-500'} />
        <Gauge label="Humidity" value={gh.humidity} min={40} max={90} unit="%" icon={Droplets}
          colorFn={v => v > 80 ? 'text-red-500' : v > 70 ? 'text-orange-500' : 'text-blue-500'} />
        <Gauge label="CO₂" value={gh.co2} min={350} max={600} unit="ppm" icon={Wind}
          colorFn={v => v > 500 ? 'text-red-500' : v > 450 ? 'text-orange-500' : 'text-green-500'} />
        <Gauge label="Soil Moisture" value={gh.soilMoisture} min={20} max={100} unit="%" icon={Sun}
          colorFn={v => v < 40 ? 'text-red-500' : v < 55 ? 'text-orange-500' : 'text-blue-500'} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Temperature History (24h)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={tempHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto','auto']} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`${v}°C`, 'Temp']} />
              <Line type="monotone" dataKey="value" stroke="#2d9e2d" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Humidity History (24h)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={humHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} />
              <YAxis domain={['auto','auto']} tick={{ fontSize: 11 }} />
              <Tooltip formatter={v => [`${v}%`, 'Humidity']} />
              <Line type="monotone" dataKey="value" stroke="#0a6de0" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-orange-500" /> Smart Recommendations</h3>
        <div className="space-y-2">
          {rec().map((r, i) => (
            <div key={i} className={`px-4 py-3 rounded-xl text-sm ${r.startsWith('✅') ? 'bg-green-50 text-green-700' : r.startsWith('⚠️') ? 'bg-orange-50 text-orange-700' : 'bg-blue-50 text-blue-700'}`}>{r}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
