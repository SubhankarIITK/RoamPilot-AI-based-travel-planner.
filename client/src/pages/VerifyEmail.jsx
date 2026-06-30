import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { resendVerification, verifyEmail } from '../api/authApi.js';
import useAuthStore from '../store/authStore.js';
import AuthShell from '../components/layout/AuthShell.jsx';

const RESEND_SECONDS = 60;

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState(location.state?.message || '');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(location.state?.codeSent ? RESEND_SECONDS : 0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setCooldown(value => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async event => {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await verifyEmail({ email, otp });
      setAuth(response.data.data.user);
      navigate('/dashboard');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Email verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setMessage('');
    setResending(true);
    try {
      const response = await resendVerification(email);
      setMessage(response.data.message || 'A new verification code was sent.');
      setCooldown(RESEND_SECONDS);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Enter the six-digit code sent to your inbox. It expires in 10 minutes."
      footer={<>Already verified? <Link to="/login" className="font-semibold text-emerald-700">Sign in</Link></>}
    >
      {message && <div className="status-banner border-emerald-200 bg-emerald-50 text-emerald-800">{message}</div>}
      {error && <div className="status-banner border-red-100 bg-red-50 text-red-700">{error}</div>}
      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={event => setEmail(event.target.value)} required />
        </div>
        <div>
          <label className="label">Verification code</label>
          <input
            className="input text-center text-xl font-extrabold tracking-[0.35em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={otp}
            onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            required
          />
        </div>
        <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary w-full py-3">
          {loading ? 'Verifying…' : 'Verify and continue'}
        </button>
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || cooldown > 0 || !email}
          className="btn-secondary w-full"
        >
          {resending ? 'Sending…' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </form>
    </AuthShell>
  );
}
