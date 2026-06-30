import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signup } from '../api/authApi.js';
import useAuthStore from '../store/authStore.js';
import AuthShell from '../components/layout/AuthShell.jsx';

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await signup(form);
      setAuth(res.data.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start building thoughtful, organized trips in minutes."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-700">Sign in</Link></>}
    >
        {error && <div className="status-banner border-red-100 bg-red-50 text-red-700">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="label">Password</label>
            <input className="input" type="password" minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required />
            <p className="mt-1.5 text-xs text-slate-400">Use at least 8 characters.</p>
          </div>
          <button type="submit" disabled={loading} className="btn-primary mt-2 w-full py-3">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>
    </AuthShell>
  );
}
