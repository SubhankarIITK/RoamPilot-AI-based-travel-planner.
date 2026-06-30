import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  requestPasswordReset,
  resetPassword,
} from '../api/authApi.js';
import AuthShell from '../components/layout/AuthShell.jsx';

const RESEND_SECONDS = 60;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState('request');
  const [form, setForm] = useState({
    email: '',
    otp: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown(value => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const requestCode = async event => {
    event?.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await requestPasswordReset(form.email);
      setMessage(response.data.message);
      setStep('reset');
      setCooldown(RESEND_SECONDS);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not request a reset code.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async event => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await resetPassword(form);
      navigate('/login', {
        replace: true,
        state: { message: 'Password reset complete. Sign in with your new password.' },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Password reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={step === 'request' ? 'Reset your password' : 'Enter your reset code'}
      subtitle={step === 'request'
        ? 'We will send a secure code if an eligible account exists.'
        : 'Use the six-digit email code and choose a new password.'}
      footer={<Link to="/login" className="font-semibold text-emerald-700">← Back to sign in</Link>}
    >
      {message && <div className="status-banner border-emerald-200 bg-emerald-50 text-emerald-800">{message}</div>}
      {error && <div className="status-banner border-red-100 bg-red-50 text-red-700">{error}</div>}

      {step === 'request' ? (
        <form onSubmit={requestCode} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" autoComplete="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-3">
            {loading ? 'Sending…' : 'Send reset code'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} required />
          </div>
          <div>
            <label className="label">Six-digit code</label>
            <input
              className="input text-center text-xl font-extrabold tracking-[0.35em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={form.otp}
              onChange={event => setForm(current => ({ ...current, otp: event.target.value.replace(/\D/g, '').slice(0, 6) }))}
              required
            />
          </div>
          <div>
            <label className="label">New password</label>
            <input className="input" type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} required />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input className="input" type="password" minLength={8} autoComplete="new-password" value={form.confirmPassword} onChange={event => setForm(current => ({ ...current, confirmPassword: event.target.value }))} required />
          </div>
          <button type="submit" disabled={loading || form.otp.length !== 6} className="btn-primary w-full py-3">
            {loading ? 'Resetting…' : 'Reset password'}
          </button>
          <button type="button" onClick={requestCode} disabled={loading || cooldown > 0} className="btn-secondary w-full">
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend reset code'}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
