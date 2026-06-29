export default function EmptyState({ icon = '📭', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center shadow-sm">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-3xl shadow-inner">{icon}</div>
      <h3 className="mb-1 text-lg font-bold text-slate-800">{title}</h3>
      {message && <p className="mb-5 max-w-sm text-sm leading-6 text-slate-500">{message}</p>}
      {action}
    </div>
  );
}
