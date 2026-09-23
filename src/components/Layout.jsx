import { useMemo, useState } from 'react';
import { Outlet, useNavigate, Link } from 'react-router-dom';
import { Menu, Bell, LogOut, UserCircle2 } from 'lucide-react';
import Sidebar from './Sidebar';
import { ToastHost } from './ui/feedback';
import { useStore } from '../store/useStore';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const profile = useStore((s) => s.profile);
  const notifications = useStore((s) => s.notifications);
  const unread = notifications.filter((n) => !n.read).length;
  const signOutUser = useStore((s) => s.signOutUser);
  const navigate = useNavigate();

  const initials = useMemo(() => {
    const name = profile?.fullName ?? profile?.email ?? 'U';
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }, [profile]);

  async function handleSignOut() {
    await signOutUser();
    navigate('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />

      <div className="flex flex-1 flex-col overflow-hidden md:ml-64">
        {/* Topbar */}
        <header className="flex flex-shrink-0 items-center gap-3 border-b border-gray-100 bg-white px-4 py-3 shadow-sm md:px-6">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 md:hidden">
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden flex-1 items-center gap-2 sm:flex">
            <span className="text-sm font-semibold text-gray-700">VFA Seed &amp; Warehouse Management</span>
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Link to="/app/notifications" className="relative rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800">
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>

            <div className="relative">
              <button onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-gray-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-green-700 text-xs font-semibold text-white">
                  {initials}
                </div>
                <span className="hidden text-sm font-medium text-gray-700 sm:block">
                  {profile?.fullName ?? 'User'}
                </span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg">
                    <Link to="/app/profile" onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
                      <UserCircle2 className="h-4 w-4" /> My Profile
                    </Link>
                    <button onClick={handleSignOut} className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="scrollbar-thin flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>

      <ToastHost />
    </div>
  );
}
