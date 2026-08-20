import { useStore } from '../store/useStore';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { TrendingUp, Download } from 'lucide-react';

const monthlyRev = [
  { m:'Jan', revenue:1200000, target:1000000, cost:800000 },
  { m:'Feb', revenue:1800000, target:1500000, cost:1100000 },
  { m:'Mar', revenue:950000, target:1200000, cost:700000 },
  { m:'Apr', revenue:2100000, target:1800000, cost:1300000 },
  { m:'May', revenue:1750000, target:1600000, cost:1050000 },
  { m:'Jun', revenue:2400000, target:2000000, cost:1400000 },
];

const farmAdoption = [
  { q:'Q1 2024', farms:8, target:10 },
  { q:'Q2 2024', farms:14, target:15 },
  { q:'Q3 2024', farms:19, target:20 },
  { q:'Q4 2024', farms:24, target:25 },
  { q:'Q1 2025', farms:28, target:30 },
];

const seedClasses = [
  { name:'Pre-Basic', value:15, color:'#175c17' },
  { name:'Basic', value:30, color:'#2d9e2d' },
  { name:'Certified', value:45, color:'#7fce7f' },
  { name:'Commercial', value:10, color:'#b3e4b3' },
];

const production = [
  { month:'Jan', kinigi:800, victoria:600, gihota:400 },
  { month:'Feb', kinigi:1200, victoria:900, gihota:500 },
  { month:'Mar', kinigi:700, victoria:800, gihota:300 },
  { month:'Apr', kinigi:1500, victoria:1100, gihota:700 },
  { month:'May', kinigi:1300, victoria:1000, gihota:600 },
  { month:'Jun', kinigi:1800, victoria:1300, gihota:800 },
];

export default function Reports() {
  const { farms, crops, sales, seedProduction } = useStore();
  const totalRevenue = sales.filter(s=>s.status==='Paid').reduce((a,b)=>a+b.total,0);
  const totalSeeds = seedProduction.length;

  const kpis = [
    { label:'Total Revenue (2025)', value:`${(totalRevenue/1000000).toFixed(2)}M RWF`, change:'+18%' },
    { label:'Active Farms', value:`${farms.filter(f=>f.status==='Active').length}`, change:'+4 farms' },
    { label:'Certified Batches', value:`${seedProduction.filter(b=>b.status==='Certified').length}`, change:'+2 this month' },
    { label:'System Uptime', value:'99.2%', change:'Above 95% target' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-gray-800">Reports & Analytics</h1>
          <p className="text-sm text-gray-500">Business intelligence and performance tracking</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 border border-green-600 text-green-700 rounded-xl text-sm font-medium hover:bg-green-50">
          <Download className="w-4 h-4" /> Export Report
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(({ label, value, change }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
            <div className="text-sm text-gray-500">{label}</div>
            <div className="text-2xl font-bold text-gray-800 mt-1">{value}</div>
            <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />{change}
            </div>
          </div>
        ))}
      </div>

      {/* Revenue vs Target */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">Revenue vs Target vs Cost (RWF)</h3>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={monthlyRev}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="m" tick={{fontSize:12}} />
            <YAxis tickFormatter={v=>`${(v/1000000).toFixed(1)}M`} tick={{fontSize:11}} />
            <Tooltip formatter={v=>[`${(v/1000000).toFixed(2)}M RWF`]} />
            <Legend />
            <Bar dataKey="revenue" name="Revenue" fill="#2d9e2d" radius={[3,3,0,0]} />
            <Bar dataKey="target" name="Target" fill="#7fce7f" radius={[3,3,0,0]} />
            <Bar dataKey="cost" name="Cost" fill="#f5e8cc" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Two charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Seed Production by Variety (kg)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={production}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{fontSize:11}} />
              <YAxis tick={{fontSize:11}} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="kinigi" name="CIP-Kinigi" stackId="1" stroke="#175c17" fill="#2d9e2d" />
              <Area type="monotone" dataKey="victoria" name="Victoria" stackId="1" stroke="#4db54d" fill="#7fce7f" />
              <Area type="monotone" dataKey="gihota" name="Gihota" stackId="1" stroke="#b07d1e" fill="#f5e8cc" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-semibold text-gray-700 mb-4">Seed Class Distribution</h3>
          <div className="flex items-center justify-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={seedClasses} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}%`} labelLine={false}>
                  {seedClasses.map(e => <Cell key={e.name} fill={e.color} />)}
                </Pie>
                <Tooltip formatter={v=>[`${v}%`, 'Share']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Farm adoption trend */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">Farm Adoption vs Target</h3>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={farmAdoption}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="q" tick={{fontSize:12}} />
            <YAxis tick={{fontSize:11}} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="farms" name="Active Farms" stroke="#2d9e2d" strokeWidth={2} dot={{ r:4 }} />
            <Line type="monotone" dataKey="target" name="Target" stroke="#ca9b35" strokeWidth={2} strokeDasharray="5 5" dot={{ r:3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Success indicators */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-700 mb-4">Success Indicators (KPIs)</h3>
        <div className="space-y-3">
          {[
            { label:'System Uptime', value:99.2, target:95, unit:'%' },
            { label:'Farm Adoption Rate', value:78, target:80, unit:'%' },
            { label:'Certified Seed Batches', value:75, target:90, unit:'%' },
            { label:'Revenue Target Achievement', value:88, target:100, unit:'%' },
            { label:'Accurate Recommendations Delivered', value:92, target:85, unit:'%' },
          ].map(({ label, value, target, unit }) => (
            <div key={label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">{label}</span>
                <span className="font-semibold text-gray-700">{value}{unit} <span className="text-gray-400 font-normal">/ {target}{unit} target</span></span>
              </div>
              <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${value >= target ? 'bg-green-500' : 'bg-yellow-400'}`} style={{ width: `${Math.min(100, (value/target)*100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
