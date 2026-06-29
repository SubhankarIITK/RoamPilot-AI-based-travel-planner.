export default function TripScoreCard({ score }) {
  if (!score) return null;
  const fields = [
    { key: 'budgetRealism', label: 'Budget' },
    { key: 'timeRealism', label: 'Time' },
    { key: 'safety', label: 'Safety' },
    { key: 'routeEfficiency', label: 'Route' },
    { key: 'restBalance', label: 'Rest' },
    { key: 'foodQuality', label: 'Food' },
  ];

  return (
    <div className="card">
      <div className="mb-5 flex items-center gap-4">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-lime-500 text-xl font-extrabold text-emerald-950 shadow-lg">{score.overall}/10</div>
        <div>
          <div className="font-bold text-slate-900">Trip quality score</div>
          <div className="mt-0.5 text-xs text-slate-500">AI assessment across six planning dimensions</div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {fields.map(f => (
          <div key={f.key} className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
            <div className="text-lg font-extrabold text-slate-800">{score[f.key] || '—'}</div>
            <div className="text-xs text-slate-500">{f.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
