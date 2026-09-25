import { useEffect, useMemo, useState } from 'react';
import { KeyRound, CheckCircle2, UserPlus, XCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, StatusBadge } from '../../components/ui/primitives';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { formatDate } from '../../lib/format';
import { ALL_PERMISSION_CODES } from '../../lib/permissions';
import { createManagedUser, requestPasswordReset } from '../../services/authService';

const EMPTY = { fullName: '', email: '', role: 'staff', password: '', status: 'ACTIVE', permissions: [] };
const MODULE_LABELS = {
  dashboard: 'Dashboard', users: 'Users', roles: 'Roles', products: 'Products', categories: 'Categories',
  varieties: 'Varieties', production: 'Production', quality: 'Quality', warehouses: 'Warehouses',
  inventory: 'Inventory', customers: 'Customers', orders: 'Orders', sales: 'Sales', payments: 'Payments',
  expenses: 'Expenses', reports: 'Reports', archive: 'Archive', audit_logs: 'Audit logs', settings: 'Settings',
};
const PERMISSION_GROUPS = ALL_PERMISSION_CODES.reduce((groups, code) => {
  const [module] = code.split('.');
  (groups[module] ??= []).push(code);
  return groups;
}, {});

function permissionLabel(code) {
  const [module, action] = code.split('.');
  const verb = action.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
  return `${verb} ${MODULE_LABELS[module] ?? module}`;
}

export default function Users() {
  const users = useStore((s) => s.users);
  const updateUser = useStore((s) => s.updateUser);
  const loadWorkspace = useStore((s) => s.loadWorkspace);
  const pushToast = useStore((s) => s.pushToast);
  const run = useAction();

  const [modal, setModal] = useState(null); // null | { mode, user }
  const [confirm, setConfirm] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const rows = useMemo(
    () => (roleFilter ? users.filter((u) => u.role === roleFilter) : users),
    [users, roleFilter]
  );

  async function handleSave(form) {
    if (!form.fullName.trim()) return pushToast('Name is required', 'error');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return pushToast('Valid email is required', 'error');
    if (form.mode === 'create') {
      if (form.password.length < 6) return pushToast('Password must be at least 6 characters', 'error');
      setSaving(true);
      try {
        await createManagedUser({
          fullName: form.fullName,
          email: form.email,
          password: form.password,
          role: form.role,
          status: form.status,
          permissions: form.role === 'staff' ? form.permissions : [],
        });
        await loadWorkspace();
        pushToast('User created successfully', 'success');
        setModal(null);
      } catch (error) {
        pushToast(error?.message ?? 'Could not create user', 'error');
      } finally {
        setSaving(false);
      }
      return;
    }
    run(() => updateUser(form.id, {
      fullName: form.fullName,
      email: form.email,
      role: form.role,
      status: form.role === 'customer' && form.status === 'PENDING' ? 'PENDING' : form.status,
    }), 'User updated');
    setModal(null);
  }

  async function resetPassword() {
    if (!confirm) return;
    try {
      await requestPasswordReset(confirm.email);
      pushToast(`Password reset email sent to ${confirm.email}`, 'success');
    } catch (error) { pushToast(error.message, 'error'); }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Create accounts and manage user access"
        actions={<Button onClick={() => setModal({ mode: 'create' })}><UserPlus className="h-4 w-4" /> Add user</Button>}
      />

      <DataTable
        columns={[
          { key: 'fullName', label: 'Name', render: (u) => (
            <div>
              <div className="font-semibold text-gray-700">{u.fullName}</div>
              <div className="text-xs text-gray-400">{u.email}</div>
            </div>
          )},
          { key: 'role', label: 'Role', render: (u) => <span className="capitalize text-gray-600">{u.role}</span> },
          { key: 'status', label: 'Status', render: (u) => <StatusBadge status={u.status} /> },
          { key: 'registered', label: 'Registered', render: (u) => <span className="text-gray-500">{formatDate(u.registered ?? u.created_at)}</span> },
          {
            key: 'actions',
            label: '',
            sortable: false,
            render: (u) => (
              <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                <Button size="sm" variant="secondary" onClick={() => setModal({ mode: 'edit', user: u })}>Edit</Button>
                {u.role === 'customer' && u.status === 'PENDING' ? (
                  u.email_verified ? (
                    <Button size="sm" variant="secondary" onClick={() => run(() => updateUser(u.id, { status: 'ACTIVE' }), 'Customer account confirmed')}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Confirm account
                    </Button>
                  ) : <span className="px-2 text-xs text-amber-700">Verify email first</span>
                ) : (
                  <Button
                    size="sm"
                    variant={u.status === 'ACTIVE' ? 'ghost' : 'secondary'}
                    onClick={() => run(() => updateUser(u.id, { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }), u.status === 'ACTIVE' ? 'User deactivated' : 'User activated')}
                  >
                    {u.status === 'ACTIVE' ? <><XCircle className="h-3.5 w-3.5" /> Deactivate</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Activate</>}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setConfirm(u)} title="Reset password">
                  <KeyRound className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]}
        rows={rows}
        searchPlaceholder="Search name or email…"
        searchKeys={['fullName', 'email']}
        filters={
          <FilterSelect
            value={roleFilter}
            onChange={setRoleFilter}
            placeholder="All roles"
            options={[{ value: 'manager', label: 'Manager' }, { value: 'staff', label: 'Staff' }, { value: 'customer', label: 'Customer' }]}
          />
        }
        pageSize={8}
      />

      <UserModal modal={modal} onClose={() => setModal(null)} onSave={handleSave} saving={saving} />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Reset password"
        message={`Send a password reset email to ${confirm?.email}?`}
        confirmLabel="Send reset"
        onConfirm={resetPassword}
      />
    </div>
  );
}

function UserModal({ modal, onClose, onSave, saving }) {
  const [form, setForm] = useState(EMPTY);
  useEffect(() => {
    setForm(modal?.mode === 'edit' ? { ...modal.user } : { ...EMPTY });
  }, [modal]);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const togglePermission = (code) => setForm((current) => ({
    ...current,
    permissions: current.permissions.includes(code)
      ? current.permissions.filter((permission) => permission !== code)
      : [...current.permissions, code],
  }));

  return (
    <Modal open={!!modal} onClose={onClose} title={modal?.mode === 'edit' ? 'Edit User' : 'Add User'} width="max-w-2xl">
      <form
        onSubmit={(e) => { e.preventDefault(); onSave({ ...form, mode: modal?.mode }); }}
        className="space-y-4"
      >
        <Input label="Full name" value={form.fullName} onChange={set('fullName')} required />
        <Input label="Email" type="email" value={form.email} onChange={set('email')} required />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Role" value={form.role} onChange={set('role')}>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
            <option value="customer">Customer</option>
          </Select>
          <Select label="Status" value={form.status} onChange={set('status')} disabled={modal?.mode === 'edit' && modal.user?.role === 'customer' && modal.user?.status === 'PENDING'}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            {form.status === 'PENDING' && <option value="PENDING">Pending approval</option>}
          </Select>
        </div>
        {modal?.mode === 'create' && <Input label="Password (at least 6 characters)" type="password" value={form.password} onChange={set('password')} required minLength={6} />}
        {modal?.mode === 'create' && form.role === 'staff' && (
          <fieldset className="rounded-xl border border-gray-200 p-4">
            <legend className="px-1 text-xs font-semibold text-gray-600">Permissions</legend>
            <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
              {Object.entries(PERMISSION_GROUPS).map(([module, codes]) => (
                <div key={module}>
                  <h4 className="mb-2 text-xs font-semibold text-gray-500">{MODULE_LABELS[module] ?? module}</h4>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {codes.map((code) => (
                      <label key={code} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50">
                        <input type="checkbox" checked={form.permissions.includes(code)} onChange={() => togglePermission(code)} className="h-4 w-4 rounded accent-green-600" />
                        {permissionLabel(code)}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Creating…' : modal?.mode === 'edit' ? 'Save Changes' : 'Create User'}</Button>
        </div>
      </form>
    </Modal>
  );
}
