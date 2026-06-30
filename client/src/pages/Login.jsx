import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../api/authApi.js';
import useAuthStore from '../store/authStore.js';
import AuthShell from '../components/layout/AuthShell.jsx';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await login(form);
      setAuth(res.data.data.user);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.data?.code === 'EMAIL_NOT_VERIFIED') {
        navigate(`/verify-email?email=${encodeURIComponent(err.response.data.email || form.email)}`, {
          state: { message: 'Your account still needs email verification.' },
        });
        return;
      }
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue planning your next journey."
      footer={<>New to RoamPilot? <Link to="/signup" className="font-semibold text-blue-600 hover:text-blue-700">Create an account</Link></>}
    >
        {location.state?.message && <div className="status-banner border-emerald-200 bg-emerald-50 text-emerald-800">{location.state.message}</div>}
        {error && <div className="status-banner border-red-100 bg-red-50 text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label className="label mb-0">Password</label>
              <Link to="/forgot-password" className="text-xs font-semibold text-emerald-700 hover:text-emerald-600">Forgot password?</Link>
            </div>
            <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-3">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
    </AuthShell>
  );
}
