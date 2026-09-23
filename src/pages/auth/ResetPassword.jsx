import { useState } from 'react';
import { Link } from 'react-router-dom';
import { requestPasswordReset } from '../../services/authService';
import AuthLayout, { AuthCardHeader } from '../../components/AuthLayout';

export default function ResetPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err?.message ?? 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
          <AuthCardHeader title="Reset Password" subtitle="We'll email you a reset link" />

          {sent ? (
            <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-700">
              If an account exists for <strong>{email}</strong>, a reset link has been sent.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-gray-700">Email address</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400" />
              </label>
              {error && <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-2.5 text-sm text-red-600">{error}</div>}
              <button type="submit" disabled={loading}
                className="w-full rounded-xl py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #2d9e2d, #1f7a1f)' }}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/login" className="text-green-700 hover:underline">Back to sign in</Link>
          </p>
    </AuthLayout>
  );
}
