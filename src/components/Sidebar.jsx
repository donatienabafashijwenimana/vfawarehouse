import { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, ShieldCheck, Building2, Package, Leaf, Tags,
  Factory, ClipboardCheck, Warehouse, Boxes, ArrowLeftRight, ShoppingCart, Receipt,
  CreditCard, Wallet, TrendingDown, BarChart3, Bell, ScrollText, Settings, LogOut, ChevronDown, ClipboardList, Archive,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { usePermissions } from '../hooks/usePermissions';
import logo from '../assets/logo.JPG';

/** Nav groups (spec §34) — each item requires at least one permission. */
const NAV_GROUPS = [
  {
    label: null,
    items: [{ to: '/app', end: true, icon: LayoutDashboard, label: 'Dashboard', perm: 'dashboard.view' }],
  },
  {
    label: 'Management',
    items: [
      { to: '/app/users', icon: Users, label: 'Users', perm: 'users.view' },
      { to: '/app/roles', icon: ShieldCheck, label: 'Roles & Permissions', perm: 'roles.view' },
      { to: '/app/customers', icon: Building2, label: 'Customers', perm: 'customers.view' },
    ],
  },
  {
    label: 'Products',
    items: [
      { to: '/app/products', icon: Package, label: 'Products', perm: 'products.view' },
      { to: '/app/varieties', icon: Leaf, label: 'Varieties', perm: 'varieties.view' },
      { to: '/app/seed-classes', icon: Tags, label: 'Seed Classes', perm: 'categories.view' },
    ],
  },
  {
    label: 'Production',
    items: [
      { to: '/app/production', icon: Factory, label: 'Production Batches', perm: 'production.view' },
      { to: '/app/quality', icon: ClipboardCheck, label: 'Quality Control', perm: 'quality.view' },
    ],
  },
  {
    label: 'Inventory',
    collapsible: true,
    icon: Boxes,
    items: [
      { to: '/app/warehouses', icon: Warehouse, label: 'Warehouses', perm: 'warehouses.view' },
      {
        to: '/app/inventory', icon: Boxes, label: 'Stock', perm: 'inventory.view',
        children: [
          { to: '/app/inventory/stock-in', label: 'Stock In' },
          { to: '/app/inventory/stock-out', label: 'Stock Out' },
          { to: '/app/inventory/transferred', label: 'Transferred' },
          { to: '/app/inventory/current-stock', label: 'Current Available Stock' },
        ],
      },
      {
        to: '/app/inventory/sold', icon: Package, label: 'Inventory Activity', perm: 'inventory.view',
        children: [
          { to: '/app/inventory/sold', label: 'Sold Inventory' },
          { to: '/app/inventory/returned', label: 'Returned' },
          { to: '/app/inventory/delivered', label: 'Delivered Quantities' },
          { to: '/app/inventory/pending', label: 'Pending Order Quantities' },
        ],
      },
      {
        to: '/app/inventory/quarantined', icon: ShieldCheck, label: 'Stock Conditions', perm: 'inventory.view',
        children: [
          { to: '/app/inventory/quarantined', label: 'Quarantined Stock' },
          { to: '/app/inventory/reserved', label: 'Reserved Stock' },
          { to: '/app/inventory/damaged', label: 'Damaged Stock' },
        ],
      },
      { to: '/app/stock-movements', icon: ArrowLeftRight, label: 'Stock Movements', perm: 'inventory.view' },
      { to: '/app/inventory-report', icon: ClipboardList, label: 'Inventory Report', perm: 'inventory.view' },
    ],
  },
  {
    label: 'Sales',
    items: [
      { to: '/app/orders', icon: ShoppingCart, label: 'Orders', perm: 'orders.view' },
      { to: '/app/sales', icon: Receipt, label: 'Sales', perm: 'sales.view' },
      { to: '/app/payments', icon: CreditCard, label: 'Payments', perm: 'payments.view' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/app/income', icon: Wallet, label: 'Income', perm: 'reports.view' },
      { to: '/app/expenses', icon: TrendingDown, label: 'Expenses', perm: 'expenses.view' },
    ],
  },
  {
    label: 'Reports',
    items: [{ to: '/app/reports', icon: BarChart3, label: 'Reports & Analytics', perm: 'reports.view' }],
  },
  {
    label: 'System',
    items: [
      { to: '/app/notifications', icon: Bell, label: 'Notifications', perm: null },
      { to: '/app/audit-logs', icon: ScrollText, label: 'Audit Logs', perm: 'audit_logs.view' },
      { to: '/app/archive', icon: Archive, label: 'Archive', perm: 'archive.view' },
      { to: '/app/settings', icon: Settings, label: 'Settings', perm: 'settings.manage' },
    ],
  },
];

/** Customer portal navigation. */
const CUSTOMER_NAV = [
  { to: '/app', end: true, icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/app/portal/products', icon: Package, label: 'Browse Seeds' },
  { to: '/app/orders', icon: ShoppingCart, label: 'My Orders' },
  { to: '/app/sales', icon: Receipt, label: 'My Invoices' },
  { to: '/app/payments', icon: CreditCard, label: 'My Payments' },
];

export default function Sidebar({ open, setOpen }) {
  const profile = useStore((s) => s.profile);
  const notifications = useStore((s) => s.notifications);
  const signOutUser = useStore((s) => s.signOutUser);
  const { can } = usePermissions();
  const navigate = useNavigate();
  const location = useLocation();
  const unread = notifications.filter((n) => !n.read).length;
  const stockRoutes = ['/app/warehouses', '/app/inventory', '/app/stock-movements', '/app/inventory-report'];
  const stockActive = stockRoutes.some((path) => location.pathname.startsWith(path));
  const [stockOpen, setStockOpen] = useState(stockActive);
  const [submenuOpen, setSubmenuOpen] = useState({ Stock: true, 'Inventory Activity': true, 'Stock Conditions': true });

  const isCustomer = profile?.role === 'customer';
  const groups = isCustomer
    ? [{ label: null, items: CUSTOMER_NAV }]
    : NAV_GROUPS.map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.perm || can(i.perm)),
      })).filter((g) => g.items.length > 0);

  async function handleLogout() {
    await signOutUser();
    navigate('/login');
  }

  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setOpen(false)} />}

      <aside
        className={`fixed top-0 left-0 z-40 flex h-full w-64 flex-col transition-transform duration-300 ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        style={{ background: 'linear-gradient(180deg, #0b2c0b 0%, #175c17 40%, #1f7a1f 100%)' }}
      >
        <div className="border-b border-white/10 px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-green-400 to-green-600 shadow-lg">
              <img src={logo} alt="VFA logo" className="h-8 w-8 object-contain" />
            </div>
            <div>
              <div className="font-display text-sm font-bold leading-tight text-white">VFA Seeds Hub</div>
              <div className="text-xs text-green-300">Production &amp; Warehouse</div>
            </div>
          </div>
        </div>

        <div className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-400/30 text-sm font-semibold text-green-100">
              {(profile?.fullName ?? 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="max-w-[130px] truncate text-sm font-medium text-white">{profile?.fullName ?? 'User'}</div>
              <div className="text-xs capitalize text-green-300">{profile?.roleLabel ?? profile?.role ?? ''}</div>
            </div>
          </div>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto py-3">
          {groups.map((group, gi) => (
            <div key={group.label ?? `g${gi}`} className="mb-1">
              {group.label && (
                group.collapsible ? (
                  <button
                    type="button"
                    onClick={() => setStockOpen((open) => !open)}
                    className={`flex w-full items-center gap-2 px-6 pb-1 pt-3 text-left text-[10px] font-bold uppercase tracking-widest transition-colors ${stockActive ? 'text-green-200' : 'text-green-500/80'}`}
                    aria-expanded={stockOpen}
                  >
                    <group.icon className="h-3.5 w-3.5" />
                    <span>{group.label}</span>
                    <ChevronDown className={`ml-auto h-3.5 w-3.5 transition-transform ${stockOpen ? 'rotate-180' : ''}`} />
                  </button>
                ) : (
                  <div className="px-6 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-green-500/80">
                    {group.label}
                  </div>
                )
              )}
              {(!group.collapsible || stockOpen) && group.items.map((item) => {
                const { to, end, icon: Icon, label, children } = item;
                return (
                  <div key={to}>
                    <div className="flex items-center">
                      <NavLink
                        to={to}
                        end={end}
                        className={({ isActive }) =>
                          `sidebar-link ${group.collapsible ? 'ml-7' : 'mx-3'} my-0.5 flex flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-all duration-200 ${
                            isActive ? 'active bg-white/15 font-medium text-white shadow-sm' : 'text-green-200 hover:bg-white/10 hover:text-white'
                          }`
                        }
                        onClick={() => setOpen(false)}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span>{label}</span>
                        {label === 'Notifications' && unread > 0 && (
                          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-xs text-white">{unread}</span>
                        )}
                      </NavLink>
                      {children && (
                        <button type="button" onClick={() => setSubmenuOpen((open) => ({ ...open, [label]: !open[label] }))} className="mr-3 rounded-lg p-2 text-green-200 hover:bg-white/10" aria-label={`Toggle ${label} submenu`} aria-expanded={submenuOpen[label] !== false}>
                          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${submenuOpen[label] !== false ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                    </div>
                    {children && submenuOpen[label] !== false && (
                      <div className="ml-12 mr-3 border-l border-white/15 pl-2">
                        {children.map((child) => (
                          <NavLink key={child.to} to={child.to} className="block rounded-lg px-3 py-2 text-xs text-green-200 hover:bg-white/10 hover:text-white" onClick={() => setOpen(false)}>
                            {child.label}
                          </NavLink>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-green-200 transition-all hover:bg-red-500/20 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
