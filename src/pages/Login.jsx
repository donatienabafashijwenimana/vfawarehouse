import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import logo from '../assets/logo.JPG';

const USERS = [
  { id: 1, name: 'Software Manager', email: 'manager@vfa.rw', password: 'vfa2025', role: 'Software Manager' },
  { id: 2, name: 'Jean D\'Amour Nyisngize', email: 'ceo@vfa.rw', password: 'vfa2025', role: 'CEO' },
  { id: 3, name: 'Field Officer', email: 'field@vfa.rw', password: 'vfa2025', role: 'Field Officer' },
];

export default function Login() {
  const [email, setEmail] = useState('manager@vfa.rw');
  const [password, setPassword] = useState('vfa2025');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useStore();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    await new Promise(r => setTimeout(r, 800));
    const user = USERS.find(u => u.email === email && u.password === password);
    if (user) {
      login(user);
      navigate('/app');
    } else {
      setError('Invalid email or password');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0b2c0b 0%, #1f7a1f 50%, #2d9e2d 100%)' }}>
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center px-16 text-white">
        <div className="mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center mb-6 overflow-hidden">
            <img src={logo} alt="VFA logo" className="w-12 h-12 object-contain" />
          </div>
          <h1 className="font-display text-4xl font-bold leading-tight mb-4">
            VFA Greenhouse<br />Seeds Hub Ltd
          </h1>
          <p className="text-green-200 text-lg leading-relaxed">
            Integrated digital platform for potato seed production, greenhouse monitoring, farmer advisory, and business management.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Registered Farms', value: '120+' },
            { label: 'Seed Batches', value: '340+' },
            { label: 'Partner Coops', value: '28' },
            { label: 'Tonnes Produced', value: '450t' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white/10 backdrop-blur rounded-xl p-4">
              <div className="font-display text-3xl font-bold text-green-300">{value}</div>
              <div className="text-green-200 text-sm mt-1">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-4 overflow-hidden">
                <img src={logo} alt="VFA logo" className="w-9 h-9 object-contain" />
              </div>
              <h2 className="font-display text-2xl font-bold text-gray-800">Welcome Back</h2>
              <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent" />
                  <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && <div className="bg-red-50 text-red-600 text-sm px-4 py-2.5 rounded-xl border border-red-100">{error}</div>}

              <button type="submit" disabled={loading}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all duration-200 shadow-lg hover:shadow-green-200 disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #2d9e2d, #1f7a1f)' }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>

            
          </div>
        </div>
      </div>
    </div>
  );
}
