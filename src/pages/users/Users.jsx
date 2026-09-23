import { useMemo, useState } from 'react';
import { UserPlus, KeyRound, CheckCircle2, XCircle } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { DataTable } from '../../components/ui/DataTable';
import { Button, Input, Select, StatusBadge } from '../../components/ui/primitives';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/KPICard';
import { FilterSelect } from '../../components/ui/feedback';
import { useAction } from '../../hooks/useAction';
import { formatDate } from '../../lib/format';

const EMPTY = { fullName: '', email: '', role: 'staff', password: '', status: 'ACTIVE' };

export default function Users() {
  const users = useStore((s) => s.users);
  const addUser = useStore((s) => s.addUser);
  const updateUser = useStore((s) => s.updateUser);
  const pushToast = useStore((s) => s.pushToast);
  const run = useAction();

  const [modal, setModal] = useState(null); // null | { mode, user }
  const [confirm, setConfirm] = useState(null);
  const [roleFilter, setRoleFilter] = useState('');

  const rows = useMemo(
    () => (roleFilter ? users.filter((u) => u.role === roleFilter) : users),
    [users, roleFilter]
  );

  function handleSave(form) {
    if (!form.fullName.trim()) return pushToast('Name is required', 'error');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return pushToast('Valid email is required', 'error');
    if (form.mode === 'create' && form.password.length < 6) return pushToast('Password must be at least 6 characters', 'error');

    if (form.mode === 'create') {
      run(() => addUser({
        id: `u_${Date.now()}`,
        fullName: form.fullName,
        email: form.email,
        password: form.password,
        role: form.role,
        status: form.status,
        registered: new Date().toISOString().slice(0, 10),
      }), 'User created');
    } else {
      run(() => updateUser(form.id, {
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        status: form.status,
      }), 'User updated');
    }
    setModal(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        subtitle="Create and manage staff and customer accounts"
        actions={
          <Button onClick={() => setModal({ mode: 'create' })}>
            <UserPlus className="h-4 w-4" /> Add User
          </Button>
        }
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
                <Button
                  size="sm"
                  variant={u.status === 'ACTIVE' ? 'ghost' : 'secondary'}
                  onClick={() => run(() => updateUser(u.id, { status: u.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' }), u.status === 'ACTIVE' ? 'User deactivated' : 'User activated')}
                >
                  {u.status === 'ACTIVE' ? <><XCircle className="h-3.5 w-3.5" /> Deactivate</> : <><CheckCircle2 className="h-3.5 w-3.5" /> Activate</>}
                </Button>
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

      <UserModal modal={modal} onClose={() => setModal(null)} onSave={handleSave} />
      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        title="Reset password"
        message={`Send a password reset to ${confirm?.email}? In demo mode no email is actually sent.`}
        confirmLabel="Send reset"
        onConfirm={() => pushToast(`Reset link sent to ${confirm?.email}`, 'success')}
      />
    </div>
  );
}

function UserModal({ modal, onClose, onSave }) {
  const [form, setForm] = useState(() =>
    modal?.mode === 'edit'
      ? { ...modal.user }
      : { ...EMPTY }
  );
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Modal open={!!modal} onClose={onClose} title={modal?.mode === 'edit' ? 'Edit User' : 'Create User'}>
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
          <Select label="Status" value={form.status} onChange={set('status')}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </Select>
        </div>
        {modal?.mode === 'create' && (
          <Input label="Password (min 6 chars)" type="password" value={form.password} onChange={set('password')} required minLength={6} />
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">{modal?.mode === 'edit' ? 'Save Changes' : 'Create User'}</Button>
        </div>
      </form>
    </Modal>
  );
}
