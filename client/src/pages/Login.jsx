import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../api/authApi.js';
import useAuthStore from '../store/authStore.js';
import AuthShell from '../components/layout/AuthShell.jsx';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await login(form);
      setAuth(res.data.data.user);
      navigate('/dashboard');
    } catch (err) {
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
        {error && <div className="status-banner border-red-100 bg-red-50 text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-3">
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
    </AuthShell>
  );
}
