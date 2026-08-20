import { useStore } from '../store/useStore';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { MapPin, Sprout, Package, ShoppingCart, TrendingUp, AlertTriangle, Leaf, Thermometer } from 'lucide-react';

const monthlyData = [
  { month: 'Jan', revenue: 1200000, seeds: 800, farms: 3 },
  { month: 'Feb', revenue: 1800000, seeds: 1200, farms: 5 },
  { month: 'Mar', revenue: 950000, seeds: 650, farms: 4 },
  { month: 'Apr', revenue: 2100000, seeds: 1800, farms: 7 },
  { month: 'May', revenue: 1750000, seeds: 1400, farms: 6 },
  { month: 'Jun', revenue: 2400000, seeds: 2100, farms: 9 },
];

const seedByVariety = [
  { name: 'CIP-Kinigi', value: 38, color: '#2d9e2d' },
  { name: 'Victoria', value: 29, color: '#4db54d' },
  { name: 'Gihota', value: 21, color: '#7fce7f' },
  { name: 'CIP-Victoria', value: 12, color: '#b3e4b3' },
];

const farmAdoption = [
  { month: 'Jan', active: 8, inactive: 3 },
  { month: 'Feb', active: 12, inactive: 2 },
  { month: 'Mar', active: 14, inactive: 2 },
  { month: 'Apr', active: 18, inactive: 1 },
  { month: 'May', active: 22, inactive: 2 },
  { month: 'Jun', active: 25, inactive: 1 },
];

function KPICard({ icon: Icon, label, value, sub, color, bg }) {
  return (
    <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 card-hover`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className="text-2xl font-bold mt-1 text-gray-800">{value}</p>
          <p className="text-xs text-gray-400 mt-1">{sub}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${bg}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { farms, crops, inventory, sales, alerts, greenhouse } = useStore();
  const activeFarms = farms.filter(f => f.status === 'Active').length;
  const totalRevenue = sales.filter(s => s.status === 'Paid').reduce((a, b) => a + b.total, 0);
  const lowStock = inventory.filter(i => i.qty <= i.minQty).length;
  const unread = alerts.filter(a => !a.read).length;

  const recentSales = [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 4);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Dashboard Overview</h1>
          <p className="text-sm text-gray-500 mt-1">VFA Greenhouse Seeds Hub Ltd — Real-time system overview</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-400">{new Date().toLocaleDateString('en-RW', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}</div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={MapPin} label="Active Farms" value={activeFarms} sub={`${farms.length} total registered`} color="text-green-600" bg="bg-green-100" />
        <KPICard icon={Sprout} label="Active Crops" value={crops.filter(c=>c.status!=='Harvested').length} sub={`${crops.length} total records`} color="text-emerald-600" bg="bg-emerald-100" />
        <KPICard icon={ShoppingCart} label="Revenue (Paid)" value={`${(totalRevenue/1000000).toFixed(1)}M RWF`} sub={`${sales.filter(s=>s.status==='Paid').length} invoices`} color="text-blue-600" bg="bg-blue-100" />
        <KPICard icon={AlertTriangle} label="Active Alerts" value={unread} sub={`${lowStock} low stock items`} color="text-orange-600" bg="bg-orange-100" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Monthly Revenue & Seed Output</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" tickFormatter={v => `${v/1000000}M`} tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v, name) => name === 'revenue' ? [`${(v/1000).toFixed(0)}k RWF`, 'Revenue'] : [v, 'Seeds (kg)']} />
              <Legend />
              <Bar yAxisId="left" dataKey="revenue" fill="#2d9e2d" radius={[4,4,0,0]} name="revenue" />
              <Bar yAxisId="right" dataKey="seeds" fill="#7fce7f" radius={[4,4,0,0]} name="seeds" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Seeds by Variety</h3>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={seedByVariety} dataKey="value" cx="50%" cy="50%" outerRadius={70} innerRadius={40}>
                {seedByVariety.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v}%`, 'Share']} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {seedByVariety.map(({ name, value, color }) => (
              <div key={name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="text-gray-600">{name}</span>
                </div>
                <span className="font-semibold text-gray-700">{value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 mb-4">Farm Adoption Trend</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={farmAdoption}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="active" stackId="1" stroke="#2d9e2d" fill="#b3e4b3" name="Active" />
              <Area type="monotone" dataKey="inactive" stackId="1" stroke="#ca9b35" fill="#f5e8cc" name="Inactive" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Sales */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-700">Recent Transactions</h3>
            <a href="/sales" className="text-xs text-green-600 hover:underline">View all →</a>
          </div>
          <div className="space-y-3">
            {recentSales.map(sale => (
              <div key={sale.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <div className="text-sm font-medium text-gray-700">{sale.invoiceNo}</div>
                  <div className="text-xs text-gray-400">{sale.customer}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-800">{sale.total.toLocaleString()} RWF</div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    sale.status === 'Paid' ? 'bg-green-100 text-green-700' :
                    sale.status === 'Pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                  }`}>{sale.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Greenhouse status */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-700 mb-4">Live Greenhouse Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {greenhouse.map(gh => (
            <div key={gh.id} className={`p-4 rounded-xl border-2 ${gh.status === 'Optimal' ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm text-gray-700">{gh.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${gh.status === 'Optimal' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>{gh.status}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Temp', value: `${gh.temp}°C` },
                  { label: 'Humidity', value: `${gh.humidity}%` },
                  { label: 'CO₂', value: `${gh.co2} ppm` },
                  { label: 'Moisture', value: `${gh.soilMoisture}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="text-center p-2 bg-white rounded-lg">
                    <div className="text-xs text-gray-400">{label}</div>
                    <div className="text-sm font-bold text-gray-700">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
