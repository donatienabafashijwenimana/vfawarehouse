import { useState } from 'react';
import { Save, KeyRound } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { Button, Input } from '../../components/ui/primitives';
import { PageHeader } from '../../components/ui/KPICard';
import { useAction } from '../../hooks/useAction';

export default function Settings() {
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const run = useAction();
  const [form, setForm] = useState({ ...settings });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <PageHeader title="System Settings" subtitle="Organization configuration" />

      <div className="max-w-2xl space-y-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-700">Organization</h3>
          <div className="space-y-4">
            <Input label="Organization name" value={form.organizationName} onChange={set('organizationName')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Default low-stock threshold (kg)" type="number" min="0" value={form.lowStockThresholdDefault} onChange={set('lowStockThresholdDefault')} />
              <Input label="Currency" value={form.currency} onChange={set('currency')} disabled />
            </div>
            <label className="flex items-center gap-3 rounded-xl border border-gray-100 px-4 py-3">
              <input
                type="checkbox"
                checked={form.enableCustomerOrders}
                onChange={(e) => setForm((f) => ({ ...f, enableCustomerOrders: e.target.checked }))}
                className="h-4 w-4 accent-green-600"
              />
              <div>
                <div className="text-sm font-medium text-gray-700">Enable customer orders</div>
                <div className="text-xs text-gray-400">Customers can place orders through the portal when enabled</div>
              </div>
            </label>
            <div className="flex justify-end">
              <Button onClick={() => run(() => updateSettings(form), 'Settings saved')}>
                <Save className="h-4 w-4" /> Save Settings
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Profile page: update own info + change password (§6). */
export function Profile() {
  const profile = useStore((s) => s.profile);
  const updateUserProfile = useStore((s) => s.updateUserProfile);
  const changePassword = useStore((s) => s.changePassword);
  const pushToast = useStore((s) => s.pushToast);
  const [form, setForm] = useState({ fullName: profile?.fullName ?? '', email: profile?.email ?? '', phone: profile?.phone ?? '' });
  const [pw, setPw] = useState({ next: '', confirm: '' });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function saveProfile(e) {
    e.preventDefault();
    try {
      await updateUserProfile({ fullName: form.fullName, phone: form.phone });
      pushToast('Profile updated', 'success');
    } catch (err) {
      pushToast(err.message, 'error');
    }
  }

  async function savePassword(e) {
    e.preventDefault();
    if (pw.next.length < 6) return pushToast('Password must be at least 6 characters', 'error');
    if (pw.next !== pw.confirm) return pushToast('Passwords do not match', 'error');
    try {
      await changePassword(pw.next);
      pushToast('Password changed', 'success');
      setPw({ next: '', confirm: '' });
    } catch (err) {
      pushToast(err.message, 'error');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" subtitle="Your account information and security" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <form onSubmit={saveProfile} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-700">Profile information</h3>
          <div className="space-y-4">
            <Input label="Full name" value={form.fullName} onChange={set('fullName')} required />
            <Input label="Email" type="email" value={form.email} disabled />
            <Input label="Phone" value={form.phone} onChange={set('phone')} />
            <div className="flex justify-end">
              <Button type="submit"><Save className="h-4 w-4" /> Save</Button>
            </div>
          </div>
        </form>

        <form onSubmit={savePassword} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-700">Change password</h3>
          <div className="space-y-4">
            <Input label="New password" type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} required minLength={6} />
            <Input label="Confirm password" type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} required />
            <div className="flex justify-end">
              <Button type="submit"><KeyRound className="h-4 w-4" /> Update Password</Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
