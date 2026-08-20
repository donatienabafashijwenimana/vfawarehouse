import { useState } from 'react';
import { useStore } from '../store/useStore';
import { User, Bell, Shield, Database, Globe, Save } from 'lucide-react';

const inp = 'w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-300';

export default function Settings() {
  const { user } = useStore();
  const [tab, setTab] = useState('profile');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const tabs = [
    { id:'profile', label:'Profile', icon: User },
    { id:'notifications', label:'Notifications', icon: Bell },
    { id:'security', label:'Security', icon: Shield },
    { id:'system', label:'System', icon: Database },
    { id:'api', label:'API Keys', icon: Globe },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-sm text-gray-500">Manage system configuration</p>
      </div>

      <div className="flex gap-6 flex-col md:flex-row">
        {/* Sidebar tabs */}
        <div className="w-full md:w-48 flex md:flex-col gap-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition text-left
                ${tab === id ? 'bg-green-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {tab === 'profile' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-gray-700">Profile Settings</h3>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white text-xl font-bold">
                  {user?.name?.[0] || 'U'}
                </div>
                <div>
                  <div className="font-semibold text-gray-800">{user?.name}</div>
                  <div className="text-sm text-gray-500">{user?.role}</div>
                  <button className="text-xs text-green-600 hover:underline mt-1">Change photo</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[['Full Name','text',user?.name],['Email','email',user?.email],['Phone','+250 788 000 000','tel'],['Organization','VFA Greenhouse Seeds Hub Ltd','text']].map(([label,placeholder,type]) => (
                  <div key={label}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input type={type} defaultValue={placeholder} className={inp} />
                  </div>
                ))}
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
                  <select className={inp} defaultValue={user?.role}>
                    <option>Software Manager</option>
                    <option>CEO</option>
                    <option>Field Officer</option>
                    <option>Finance Manager</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {tab === 'notifications' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-gray-700">Notification Preferences</h3>
              <div className="space-y-3">
                {[
                  ['Email Alerts for Low Stock', true],
                  ['SMS for Disease Risk Warnings', true],
                  ['Daily Weather Digest', false],
                  ['Weekly Sales Report', true],
                  ['Greenhouse Alerts (Critical)', true],
                  ['Certification Reminders', true],
                  ['Monthly KPI Summary', true],
                ].map(([label, defaultOn]) => (
                  <div key={label} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm text-gray-700">{label}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={defaultOn} className="sr-only peer" />
                      <div className="w-10 h-5 bg-gray-200 rounded-full peer peer-checked:bg-green-500 transition-colors" />
                      <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5 shadow" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'security' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-gray-700">Security Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Current Password</label>
                  <input type="password" placeholder="••••••••" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">New Password</label>
                  <input type="password" placeholder="••••••••" className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password</label>
                  <input type="password" placeholder="••••••••" className={inp} />
                </div>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <div className="text-sm font-medium text-blue-700 mb-2">Two-Factor Authentication</div>
                  <p className="text-xs text-blue-600 mb-3">Add an extra layer of security to your account.</p>
                  <button className="text-sm px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700">Enable 2FA</button>
                </div>
              </div>
            </div>
          )}

          {tab === 'system' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-gray-700">System Configuration</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">System Language</label>
                  <select className={inp}><option>English</option><option>Kinyarwanda</option><option>French</option></select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Currency</label>
                  <select className={inp}><option>RWF (Rwandan Franc)</option><option>USD</option><option>EUR</option></select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date Format</label>
                  <select className={inp}><option>DD/MM/YYYY</option><option>MM/DD/YYYY</option><option>YYYY-MM-DD</option></select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Time Zone</label>
                  <select className={inp}><option>Africa/Kigali (CAT, UTC+2)</option></select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Company Name</label>
                  <input defaultValue="VFA Greenhouse Seeds Hub Ltd" className={inp} />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">System Description</label>
                  <textarea rows={3} defaultValue="Integrated digital platform for potato seed production, greenhouse monitoring, farmer advisory, sales, and business management." className={inp} />
                </div>
              </div>
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl">
                <div className="text-sm font-semibold text-orange-700 mb-1">Database Backup</div>
                <p className="text-xs text-orange-600 mb-2">Last backup: Today 03:00 AM — Auto-backup enabled</p>
                <button className="text-xs px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700">Backup Now</button>
              </div>
            </div>
          )}

          {tab === 'api' && (
            <div className="space-y-5">
              <h3 className="font-semibold text-gray-700">API Integrations</h3>
              <div className="space-y-4">
                {[
                  { name:'OpenWeatherMap API', key:'owm_••••••••••••••••••ab12', status:'Connected', color:'bg-green-100 text-green-700' },
                  { name:'NASA POWER API', key:'Public (no key required)', status:'Connected', color:'bg-green-100 text-green-700' },
                  { name:'MTN MoMo API', key:'mtn_••••••••••••••••••xy89', status:'Connected', color:'bg-green-100 text-green-700' },
                  { name:'RAB Certification API', key:'Not configured', status:'Disconnected', color:'bg-gray-100 text-gray-500' },
                ].map(({ name, key, status, color }) => (
                  <div key={name} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-700 text-sm">{name}</span>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${color}`}>{status}</span>
                    </div>
                    <div className="flex gap-2">
                      <input defaultValue={key} type="text" className={`flex-1 ${inp} bg-white font-mono text-xs`} />
                      <button className="px-3 py-2 text-xs bg-green-600 text-white rounded-xl hover:bg-green-700">Update</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
            <button onClick={handleSave}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition ${saved ? 'bg-green-500' : 'bg-green-600 hover:bg-green-700'}`}>
              <Save className="w-4 h-4" />
              {saved ? 'Saved!' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
