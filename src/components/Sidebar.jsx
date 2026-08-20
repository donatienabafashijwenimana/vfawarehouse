import { NavLink, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import {
  LayoutDashboard, MapPin, Sprout, Leaf,
  Cloud, ShoppingCart, BarChart3, Bell, Settings,
  LogOut, Thermometer, Package
} from 'lucide-react';

import logo from '../assets/logo.JPG';


const ALL_NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/farms', icon: MapPin, label: 'Farm Registry' },
  { to: '/crops', icon: Sprout, label: 'Crop Records' },
  { to: '/seeds', icon: Leaf, label: 'Seed Production' },
  { to: '/greenhouse', icon: Thermometer, label: 'Greenhouse' },
  { to: '/inventory', icon: Package, label: 'Inventory' },
  { to: '/sales', icon: ShoppingCart, label: 'Sales & Invoicing' },
  { to: '/weather', icon: Cloud, label: 'Weather Dashboard' },
  { to: '/reports', icon: BarChart3, label: 'Reports & Analytics' },
  { to: '/alerts', icon: Bell, label: 'Alerts' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const ROLE_NAV_ITEMS = {
  // Software Manager: all items
  'Software Manager': ALL_NAV_ITEMS,
  // CEO: high-level oversight
  'CEO': ALL_NAV_ITEMS.filter(i => ['/', '/reports', '/alerts', '/settings'].includes(i.to)),
  // Field Officer: field operations
  'Field Officer': ALL_NAV_ITEMS.filter(i => ['/farms', '/crops', '/greenhouse', '/weather', '/alerts'].includes(i.to)),
};

export default function Sidebar({ open, setOpen }) {
  const { user, logout } = useStore();
  const { alerts } = useStore();
  const unread = alerts.filter(a => !a.read).length;
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-30 md:hidden" onClick={() => setOpen(false)} />}

      <aside className={`fixed top-0 left-0 h-full z-40 w-64 flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ background: 'linear-gradient(180deg, #0b2c0b 0%, #175c17 40%, #1f7a1f 100%)' }}>

        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-lg overflow-hidden">
              <img src={logo} alt="VFA logo" className="w-8 h-8 object-contain" />
            </div>

            <div>
              <div className="font-display font-bold text-white text-sm leading-tight">VFA Greenhouse</div>
              <div className="text-green-300 text-xs">Seeds Hub Ltd</div>
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-green-400/30 flex items-center justify-center text-green-200 font-semibold text-sm overflow-hidden">
              <img src={logo} alt="VFA logo" className="w-5 h-5 object-contain" />
            </div>

            <div>
              <div className="text-white text-sm font-medium truncate max-w-[130px]">{user?.name || 'Software Manager'}</div>
              <div className="text-green-300 text-xs">{user?.role || 'Admin'}</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          {((ROLE_NAV_ITEMS[user?.role] || ALL_NAV_ITEMS)).map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 mx-3 my-0.5 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 relative
                ${isActive ? 'bg-white/15 text-white font-medium shadow-sm' : 'text-green-200 hover:bg-white/10 hover:text-white'}`
              }
              onClick={() => setOpen(false)}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {label === 'Alerts' && unread > 0 && (
                <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-green-200 hover:bg-red-500/20 hover:text-red-300 transition-all text-sm">
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
