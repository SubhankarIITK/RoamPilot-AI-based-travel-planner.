import { useEffect, useState } from 'react';
import PageHeader from '../components/common/PageHeader.jsx';
import {
  createPaymentOrder,
  getBillingPlans,
  verifyPayment,
} from '../api/billingApi.js';
import useBillingStore from '../store/billingStore.js';

const RAZORPAY_CHECKOUT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let checkoutPromise;

const loadRazorpayCheckout = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (checkoutPromise) return checkoutPromise;
  checkoutPromise = new Promise(resolve => {
    const script = document.createElement('script');
    script.src = RAZORPAY_CHECKOUT_URL;
    script.async = true;
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
  return checkoutPromise;
};

const formatDate = value => value
  ? new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value))
  : '—';

const transactionStyle = type => ({
  credit_purchase: 'bg-emerald-100 text-emerald-700',
  subscription_grant: 'bg-emerald-100 text-emerald-700',
  usage: 'bg-blue-100 text-blue-700',
  refund: 'bg-amber-100 text-amber-700',
  admin_adjustment: 'bg-violet-100 text-violet-700',
}[type] || 'bg-slate-100 text-slate-600');

export default function Billing() {
  const { summary, loading, loadBilling } = useBillingStore();
  const [packs, setPacks] = useState([]);
  const [processing, setProcessing] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    Promise.all([loadBilling(), getBillingPlans()])
      .then(([, response]) => setPacks(response.data.data))
      .catch(requestError => setError(
        requestError.response?.data?.message || 'Could not load credit information.',
      ));
  }, [loadBilling]);

  const openCheckout = async pack => {
    setProcessing(pack.key);
    setError('');
    setSuccess('');
    try {
      const checkoutLoaded = await loadRazorpayCheckout();
      if (!checkoutLoaded) throw new Error('Secure checkout could not load.');
      const response = await createPaymentOrder(pack.key);
      const order = response.data.data;
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'RoamPilot',
        description: `${order.packName} · ${order.credits} AI credits`,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: '#059669' },
        modal: {
          ondismiss: () => setProcessing(''),
        },
        handler: async payment => {
          try {
            const verification = await verifyPayment(payment);
            await loadBilling();
            setSuccess(
              `${verification.data.data.creditsAdded} credits were added successfully.`,
            );
          } catch (verificationError) {
            setError(
              verificationError.response?.data?.message ||
              'Payment was received but confirmation is delayed. The webhook will recover it.',
            );
          } finally {
            setProcessing('');
          }
        },
      });
      checkout.on('payment.failed', failure => {
        setError(
          failure?.error?.description ||
          'Payment failed or was cancelled. No credits were added.',
        );
        setProcessing('');
      });
      checkout.open();
    } catch (requestError) {
      setError(
        requestError.response?.data?.message ||
        requestError.message ||
        'Could not open secure checkout.',
      );
      setProcessing('');
    }
  };

  const credits = summary?.subscription;
  const creditExempt = summary?.creditExempt;

  return (
    <div className="page-container max-w-6xl">
      <PageHeader
        title="Credits & payments"
        subtitle={creditExempt
          ? 'This administrator account has unlimited AI access.'
          : 'Weekly credits renew automatically. Purchased Razorpay credits never expire.'}
      />

      {success && <div className="status-banner border-emerald-200 bg-emerald-50 text-emerald-700">{success}</div>}
      {error && <div className="status-banner border-red-200 bg-red-50 text-red-700">{error}</div>}

      <section className="mb-7 grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="overflow-hidden rounded-3xl border border-emerald-300/20 bg-gradient-to-br from-emerald-950 via-emerald-900 to-lime-950 p-6 text-white shadow-xl sm:p-7">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">Available balance</p>
          <div className="mt-2 flex items-end gap-2">
            <span className="text-5xl font-black tracking-tight">
              {loading && !summary ? '—' : creditExempt ? '∞' : credits?.creditBalance ?? 0}
            </span>
            <span className="pb-1.5 text-sm font-semibold text-emerald-200">
              {creditExempt ? 'administrator access' : 'AI credits'}
            </span>
          </div>
          {!creditExempt && (
            <>
              <p className="mt-4 max-w-xl text-sm leading-6 text-emerald-50/75">
                Weekly credits are spent first. Failed AI requests are refunded automatically,
                and purchased credits remain available until used.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-emerald-100">
                  {credits?.weeklyFreeCreditBalance ?? 0} weekly free
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-emerald-100">
                  {credits?.paidCreditBalance ?? 0} purchased
                </span>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <p className="eyebrow">Weekly renewal</p>
          <h2 className="mt-2 text-xl font-extrabold text-slate-900">
            {creditExempt ? 'Unlimited admin access' : `${credits?.weeklyFreeCreditAllowance ?? summary?.completeTrialCredits ?? 39} free credits`}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {creditExempt
              ? 'No payment or credit reservation is required.'
              : `Renews on ${formatDate(credits?.weeklyFreeCreditsRefreshAt)}. This covers every metered AI feature at least once.`}
          </p>
          {!creditExempt && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
              No subscription or automatic charge. Buy a pack only when you need more.
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="eyebrow">One-time credit packs</p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">Pay securely with Razorpay</h2>
          <p className="mt-1 text-sm text-slate-500">
            No recurring subscription. Razorpay may charge the merchant a processing fee on successful payments.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {packs.map(pack => (
            <article key={pack.key} className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${pack.recommended ? 'border-emerald-400 ring-4 ring-emerald-100' : 'border-slate-200'}`}>
              {pack.recommended && <span className="absolute -top-3 left-6 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">Best value</span>}
              <h3 className="text-lg font-extrabold text-slate-900">{pack.name}</h3>
              <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{pack.description}</p>
              <div className="mt-5">
                <span className="text-3xl font-black text-slate-950">₹{pack.displayPrice.toLocaleString('en-IN')}</span>
                <span className="text-sm text-slate-500"> one time</span>
              </div>
              <div className="mt-2 text-sm font-bold text-emerald-700">{pack.credits} permanent AI credits</div>
              <button
                type="button"
                onClick={() => openCheckout(pack)}
                disabled={creditExempt || !pack.checkoutAvailable || Boolean(processing)}
                className={pack.recommended ? 'btn-primary mt-6 w-full' : 'btn-secondary mt-6 w-full'}
              >
                {creditExempt
                  ? 'Admin access included'
                  : processing === pack.key
                    ? 'Opening secure checkout…'
                    : pack.checkoutAvailable
                      ? 'Buy credits'
                      : 'Razorpay not configured'}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-9 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <div className="card">
          <p className="eyebrow">Credit costs</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">What each action uses</h2>
          <div className="mt-4 divide-y divide-slate-100">
            {Object.entries(summary?.creditCosts || {}).map(([action, cost]) => (
              <div key={action} className="flex items-center justify-between py-2.5 text-sm">
                <span className="capitalize text-slate-600">{action.replace(/([A-Z])/g, ' $1')}</span>
                <span className="font-bold text-slate-900">{cost} credit{cost === 1 ? '' : 's'}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <p className="eyebrow">Credit activity</p>
          <h2 className="mt-1 text-lg font-bold text-slate-900">Recent transactions</h2>
          <div className="mt-4 space-y-2">
            {summary?.transactions?.length ? summary.transactions.map(transaction => (
              <div key={transaction._id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${transactionStyle(transaction.type)}`}>
                  {transaction.amount > 0 ? '+' : ''}{transaction.amount}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{transaction.description || transaction.action}</p>
                  <p className="text-xs text-slate-400">{formatDate(transaction.createdAt)}</p>
                </div>
                <span className="text-xs font-medium text-slate-500">{transaction.balanceAfter} left</span>
              </div>
            )) : <p className="rounded-xl bg-slate-50 p-5 text-center text-sm text-slate-500">No credit activity yet.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}
