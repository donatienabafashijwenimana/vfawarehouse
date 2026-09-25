import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useStore } from '../../store/useStore';
import AuthLayout, { AuthCardHeader } from '../../components/AuthLayout';

export default function Register() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const registerUser = useStore((s) => s.registerUser);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setLoading(true);
    try {
      await registerUser({ fullName: form.fullName, email: form.email, password: form.password });
      setSuccess('Check your email and verify your address. After verification, a manager will confirm your customer account before you can sign in.');
    } catch (err) {
      setError(err?.message ?? 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
          <AuthCardHeader title="Create Account" subtitle="Register as a customer to order certified seed" />

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Full name / Organization</span>
              <input type="text" required value={form.fullName} onChange={set('fullName')}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
              <input type="email" required value={form.email} onChange={set('email')}
                className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Password</span>
                <input type="password" required value={form.password} onChange={set('password')}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Confirm</span>
                <input type="password" required value={form.confirm} onChange={set('confirm')}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </label>
            </div>

            {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
            {success && <div role="status" className="rounded-xl border border-green-100 bg-green-50 px-4 py-2.5 text-sm text-green-700">{success}</div>}

            <button type="submit" disabled={loading}
              className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, #2d9e2d, #1f7a1f)' }}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account? <Link to="/login" className="text-green-700 hover:underline">Sign in</Link>
          </p>
    </AuthLayout>
  );
}
