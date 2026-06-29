import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader.jsx';
import {
  createBillingPortal,
  createCheckout,
  getBillingPlans,
} from '../api/billingApi.js';
import useBillingStore from '../store/billingStore.js';

const formatDate = value => value
  ? new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(value))
  : '—';

const transactionStyle = type => ({
  subscription_grant: 'bg-emerald-100 text-emerald-700',
  usage: 'bg-blue-100 text-blue-700',
  refund: 'bg-amber-100 text-amber-700',
  admin_adjustment: 'bg-violet-100 text-violet-700',
}[type] || 'bg-slate-100 text-slate-600');

export default function Billing() {
  const [searchParams, setSearchParams] = useSearchParams();
  const checkoutState = searchParams.get('checkout');
  const { summary, loading, loadBilling } = useBillingStore();
  const [plans, setPlans] = useState([]);
  const [processing, setProcessing] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([loadBilling(), getBillingPlans()])
      .then(([, response]) => setPlans(response.data.data))
      .catch(err => setError(err.response?.data?.message || 'Could not load billing information.'));
  }, [loadBilling]);

  useEffect(() => {
    if (checkoutState === 'success') {
      const timer = setInterval(() => loadBilling().catch(() => {}), 2000);
      const stop = setTimeout(() => clearInterval(timer), 12000);
      return () => {
        clearInterval(timer);
        clearTimeout(stop);
      };
    }
    return undefined;
  }, [checkoutState, loadBilling]);

  const subscription = summary?.subscription;
  const creditExempt = summary?.creditExempt;
  const currentPlan = useMemo(
    () => plans.find(plan => plan.key === subscription?.planKey),
    [plans, subscription?.planKey],
  );

  const redirectToCheckout = async planKey => {
    setProcessing(planKey);
    setError('');
    try {
      const response = await createCheckout(planKey);
      window.location.assign(response.data.data.url);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open secure checkout.');
      setProcessing('');
    }
  };

  const redirectToPortal = async () => {
    setProcessing('portal');
    setError('');
    try {
      const response = await createBillingPortal();
      window.location.assign(response.data.data.url);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not open the billing portal.');
      setProcessing('');
    }
  };

  return (
    <div className="page-container max-w-6xl">
      <PageHeader
        title="Plans & credits"
        subtitle={creditExempt
          ? 'This administrator account has unlimited AI access and does not spend credits.'
          : 'Every account receives weekly free credits. Paid credits are added after Stripe confirms a successful subscription payment.'}
        actions={subscription?.hasBillingAccount ? (
          <button type="button" onClick={redirectToPortal} disabled={processing === 'portal'} className="btn-secondary">
            {processing === 'portal' ? 'Opening…' : 'Manage billing'}
          </button>
        ) : null}
      />

      {checkoutState === 'success' && (
        <div className="status-banner mb-5 border-emerald-200 bg-emerald-50 text-emerald-700">
          Payment received. Your credits will appear as soon as the signed Stripe webhook is processed.
          <button type="button" onClick={() => setSearchParams({})} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      {checkoutState === 'cancelled' && (
        <div className="status-banner mb-5 border-slate-200 bg-slate-50 text-slate-600">
          Checkout was cancelled. No charge or credits were applied.
          <button type="button" onClick={() => setSearchParams({})} className="ml-2 underline">Dismiss</button>
        </div>
      )}
      {error && <div className="status-banner mb-5 border-red-200 bg-red-50 text-red-700">{error}</div>}

      <section className="mb-7 grid gap-4 md:grid-cols-[1.25fr_.75fr]">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-indigo-950 to-blue-900 p-6 text-white shadow-xl sm:p-7">
          <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-200">Available balance</p>
              <div className="mt-2 flex items-end gap-2">
                <span className="text-5xl font-black tracking-tight">{loading && !summary ? '—' : creditExempt ? '∞' : subscription?.creditBalance ?? 0}</span>
                <span className="pb-1.5 text-sm font-semibold text-blue-200">{creditExempt ? 'administrator access' : 'AI credits'}</span>
              </div>
              <p className="mt-4 max-w-lg text-sm leading-6 text-slate-300">
                {creditExempt
                  ? 'AI actions bypass credit reservations and deductions for this allowlisted account.'
                  : `${subscription?.weeklyFreeCreditBalance ?? 0} weekly free credits remain and reset on ${formatDate(subscription?.weeklyFreeCreditsRefreshAt)}. Failed AI requests return credits automatically.`}
              </p>
              {!creditExempt && <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-blue-100">{subscription?.weeklyFreeCreditBalance ?? 0} free</span>
                <span className="rounded-full bg-white/10 px-3 py-1.5 text-blue-100">{subscription?.paidCreditBalance ?? 0} paid</span>
              </div>}
            </div>
            <span className={`self-start rounded-full px-3 py-1.5 text-xs font-bold ${
              subscription?.hasActiveSubscription
                ? 'bg-emerald-400/15 text-emerald-200 ring-1 ring-emerald-300/20'
                : 'bg-white/10 text-slate-300 ring-1 ring-white/10'
            }`}>
              {creditExempt
                ? 'Admin credit exempt'
                : subscription?.hasActiveSubscription
                ? 'Active subscription'
                : subscription?.weeklyFreeCreditBalance > 0
                  ? 'Weekly free access'
                  : 'Free credits used'}
            </span>
          </div>
        </div>

        <div className="card">
          <p className="eyebrow">Current plan</p>
          <h2 className="mt-2 text-xl font-extrabold text-slate-900">{creditExempt ? 'Administrator' : currentPlan?.name || 'No paid plan'}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {creditExempt
              ? 'No subscription or credit balance is required for AI actions.'
              : currentPlan
                ? `${subscription.monthlyCreditAllowance} paid credits added after each paid invoice.`
                : 'Weekly free credits remain available without a subscription.'}
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Status</dt><dd className="mt-1 font-bold capitalize text-slate-800">{subscription?.status?.replace('_', ' ') || 'Inactive'}</dd></div>
            <div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Renews / ends</dt><dd className="mt-1 font-bold text-slate-800">{formatDate(subscription?.currentPeriodEnd)}</dd></div>
          </dl>
          {subscription?.cancelAtPeriodEnd && <p className="mt-3 text-xs font-semibold text-amber-700">Cancellation is scheduled for the end of this billing period.</p>}
        </div>
      </section>

      <section>
        <div className="mb-4">
          <p className="eyebrow">Monthly subscriptions</p>
          <h2 className="mt-1 text-xl font-extrabold text-slate-900">Choose the AI capacity you need</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map(plan => (
            <article key={plan.key} className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${plan.recommended ? 'border-indigo-400 ring-4 ring-indigo-100' : 'border-slate-200'}`}>
              {plan.recommended && <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white">Most popular</span>}
              <h3 className="text-lg font-extrabold text-slate-900">{plan.name}</h3>
              <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{plan.description}</p>
              <div className="mt-5"><span className="text-3xl font-black text-slate-950">₹{plan.displayPrice.toLocaleString('en-IN')}</span><span className="text-sm text-slate-500"> / month</span></div>
              <div className="mt-2 text-sm font-bold text-indigo-700">{plan.monthlyCredits} AI credits monthly</div>
              <ul className="my-6 flex-1 space-y-3">
                {plan.features.map(feature => <li key={feature} className="flex gap-2 text-sm text-slate-600"><span className="font-bold text-emerald-500">✓</span>{feature}</li>)}
              </ul>
              <button
                type="button"
                onClick={() => redirectToCheckout(plan.key)}
                disabled={creditExempt || !plan.checkoutAvailable || Boolean(subscription?.hasActiveSubscription) || processing === plan.key}
                className={plan.recommended ? 'btn-primary w-full' : 'btn-secondary w-full'}
              >
                {creditExempt
                  ? 'Admin access included'
                  : subscription?.planKey === plan.key && subscription?.hasActiveSubscription
                  ? 'Current plan'
                  : processing === plan.key
                    ? 'Opening checkout…'
                    : plan.checkoutAvailable
                      ? 'Subscribe securely'
                      : 'Checkout not configured'}
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
