import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';
import useThemeStore from '../store/themeStore.js';
import PageHeader from '../components/common/PageHeader.jsx';
import { updateMe } from '../api/authApi.js';

const themes = [
  { id: 'light', title: 'Light', description: 'Bright and focused', preview: 'bg-[#f5f7fb]' },
  { id: 'dark', title: 'Dark', description: 'Low-light workspace', preview: 'bg-[#080d19]' },
  { id: 'system', title: 'System', description: 'Match your device', preview: 'bg-gradient-to-r from-[#f5f7fb] from-50% to-[#080d19] to-50%' },
];

export default function Settings() {
  const { user, setUser, logout } = useAuthStore();
  const { preference, setPreference } = useThemeStore();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: user?.name || '', email: user?.email || '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const handleSave = async event => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const response = await updateMe(form);
      setUser(response.data.data);
      setMessage('Account details updated.');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Failed to update account');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="page-container max-w-4xl">
      <PageHeader title="Settings" subtitle="Manage your account and personalize your RoamPilot workspace." />
      {message && <div className="status-banner border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:text-blue-200">{message}</div>}

      <div className="space-y-5">
        <section className="card">
          <div className="mb-5">
            <p className="eyebrow">Appearance</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Choose your workspace theme</h2>
            <p className="mt-1 text-sm text-slate-500">Your preference is saved on this device and applied instantly.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {themes.map(theme => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setPreference(theme.id)}
                className={`rounded-2xl border p-3 text-left transition-all ${preference === theme.id ? 'border-indigo-500 bg-indigo-50 ring-4 ring-indigo-100 dark:bg-indigo-400/10 dark:ring-indigo-500/10' : 'border-slate-200 hover:-translate-y-0.5 hover:border-indigo-300 dark:border-white/10 dark:hover:border-indigo-400/40'}`}
              >
                <span className={`relative block h-24 overflow-hidden rounded-xl border border-black/5 ${theme.preview}`}>
                  <span className="absolute inset-y-0 left-0 w-5 bg-slate-900/90" />
                  <span className="absolute left-8 right-3 top-3 h-3 rounded bg-slate-400/20" />
                  <span className="absolute bottom-3 left-8 right-3 top-9 rounded-lg border border-slate-400/20 bg-white/40" />
                </span>
                <span className="mt-3 flex items-center justify-between gap-2">
                  <span>
                    <span className="block text-sm font-bold text-slate-900">{theme.title}</span>
                    <span className="block text-xs text-slate-500">{theme.description}</span>
                  </span>
                  <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${preference === theme.id ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{preference === theme.id ? '✓' : ''}</span>
                </span>
              </button>
            ))}
          </div>
        </section>

        <form onSubmit={handleSave} className="card">
          <div className="mb-5">
            <p className="eyebrow">Profile</p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">Account information</h2>
            <p className="mt-1 text-sm text-slate-500">Used for your workspace identity and trip collaboration.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label">Name</label><input className="input" value={form.name} onChange={event => setForm(current => ({ ...current, name: event.target.value }))} required /></div>
            <div><label className="label">Email</label><input className="input" type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required /></div>
          </div>
          <div className="mt-5 flex justify-end"><button type="submit" disabled={saving} className="btn-primary min-w-36">{saving ? 'Saving...' : 'Save changes'}</button></div>
        </form>

        <section className="card border-red-200/70 dark:border-red-400/15">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-bold text-slate-900">Sign out of RoamPilot</p><p className="mt-1 text-xs text-slate-500">You will need to sign in again to access your workspace.</p></div>
            <button onClick={handleLogout} className="btn-danger">Log out</button>
          </div>
        </section>
      </div>
    </div>
  );
}
