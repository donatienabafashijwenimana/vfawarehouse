import { useState } from 'react';
import { ShieldCheck, Save } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Button, Badge } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/KPICard';
import { useAction } from '../../hooks/useAction';
import { ALL_PERMISSION_CODES } from '../../lib/permissions';

const GROUPS = [
  { label: 'General', match: (p) => ['dashboard'].some((m) => p.startsWith(m)) },
  { label: 'Users & Roles', match: (p) => p.startsWith('users.') || p.startsWith('roles.') },
  { label: 'Catalog', match: (p) => ['products', 'categories', 'varieties'].some((m) => p.startsWith(m)) },
  { label: 'Production & Quality', match: (p) => p.startsWith('production.') || p.startsWith('quality.') },
  { label: 'Warehouse', match: (p) => ['warehouses', 'inventory'].some((m) => p.startsWith(m)) },
  { label: 'Sales & Payments', match: (p) => ['customers', 'orders', 'sales', 'payments'].some((m) => p.startsWith(m)) },
  { label: 'Finance', match: (p) => p.startsWith('expenses.') },
  { label: 'System', match: (p) => ['reports', 'audit_logs', 'settings'].some((m) => p.startsWith(m)) },
];

export default function Roles() {
  const users = useStore((s) => s.users);
  const logAction = useStore((s) => s.logAction);
  const run = useAction();

  // Staff permissions are stored on the database-backed profiles.
  const staffUser = users.find((u) => u.role === 'staff');
  const [perms, setPerms] = useState(staffUser?.permissions ?? []);

  const customerCount = users.filter((u) => u.role === 'customer').length;

  function toggle(code) {
    setPerms((p) => (p.includes(code) ? p.filter((c) => c !== code) : [...p, code]));
  }

  function save() {
    run(() => {
      // Apply the selected permission set to all staff profiles.
      users.filter((u) => u.role === 'staff').forEach((u) => {
        useStore.setState((s) => ({
          users: s.users.map((x) => (x.id === u.id ? { ...x, permissions: perms } : x)),
        }));
      });
      logAction(`Updated staff permissions (${perms.length} granted)`, 'Roles & Permissions');
    }, 'Staff permissions saved');
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        subtitle="Configure what each role can access"
        actions={<Button onClick={save}><Save className="h-4 w-4" /> Save Changes</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-green-100 bg-green-50 p-5">
          <div className="flex items-center gap-2 text-green-800">
            <ShieldCheck className="h-5 w-5" />
            <h3 className="font-bold">Manager</h3>
          </div>
          <p className="mt-2 text-sm text-green-700">Full access to all modules and settings. Cannot be restricted.</p>
          <Badge color="green" className="mt-3">All permissions</Badge>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-gray-700">Staff</h3>
          <p className="mt-2 text-sm text-gray-500">Access depends on assigned permissions. {perms.length} of {ALL_PERMISSION_CODES.length} granted.</p>
          <Badge color="blue" className="mt-3">Customizable below</Badge>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-gray-700">Customer</h3>
          <p className="mt-2 text-sm text-gray-500">Sees only their own orders, invoices and payments. {customerCount} registered.</p>
          <Badge color="gray" className="mt-3">Own data only</Badge>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 font-semibold text-gray-700">Staff permissions</h3>
        <div className="space-y-5">
          {GROUPS.map((group) => {
            const codes = ALL_PERMISSION_CODES.filter(group.match);
            if (!codes.length) return null;
            return (
              <div key={group.label}>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">{group.label}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {codes.map((code) => (
                    <label key={code} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-gray-100 px-3 py-2 hover:bg-gray-50">
                      <input type="checkbox" checked={perms.includes(code)} onChange={() => toggle(code)} className="h-4 w-4 rounded accent-green-600" />
                      <span className="font-mono text-xs text-gray-600">{code}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
