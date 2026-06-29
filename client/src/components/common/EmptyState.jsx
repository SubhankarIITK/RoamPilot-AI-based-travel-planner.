export default function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="relative isolate flex min-h-72 flex-col items-center justify-center overflow-hidden rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-white via-emerald-50/70 to-lime-50/50 px-6 py-14 text-center shadow-[0_18px_55px_rgba(5,150,105,0.08)] dark:border-emerald-300/15 dark:from-[#071d17] dark:via-[#09251d] dark:to-[#0d2a1d] dark:shadow-[0_22px_65px_rgba(0,0,0,0.24)]">
      <div className="pointer-events-none absolute -right-20 -top-24 -z-10 h-56 w-56 rounded-full bg-lime-300/20 blur-3xl dark:bg-lime-300/[0.06]" />
      <div className="pointer-events-none absolute -bottom-24 -left-20 -z-10 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-300/[0.07]" />
      <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl border border-emerald-200 bg-emerald-100 text-3xl shadow-inner dark:border-emerald-300/15 dark:bg-emerald-300/10">{icon}</div>
      <h3 className="mb-2 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">{title}</h3>
      {message && <p className="mb-6 max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">{message}</p>}
      {action && <div className="flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}
