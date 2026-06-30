import { useMemo } from 'react';

const statusIcon = status => ({
  completed: '✓',
  skipped: '–',
  failed: '!',
  running: '→',
}[status] || '○');

const statusClass = status => ({
  completed: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-300/20 dark:bg-emerald-300/[0.08] dark:text-emerald-100',
  skipped: 'border-slate-200 bg-slate-50 text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400',
  failed: 'border-red-200 bg-red-50 text-red-700 dark:border-red-300/20 dark:bg-red-400/10 dark:text-red-200',
  running: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-emerald-300/25 dark:bg-emerald-300/10 dark:text-emerald-100',
}[status] || 'border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-400');

export default function AgentProgress({ isRunning, progress }) {
  const steps = useMemo(() => {
    const ordered = [];
    const indexes = new Map();
    for (const step of progress?.steps || []) {
      if (indexes.has(step.key)) {
        ordered[indexes.get(step.key)] = step;
      } else {
        indexes.set(step.key, ordered.length);
        ordered.push(step);
      }
    }
    return ordered;
  }, [progress?.steps]);

  if (!isRunning && !progress) return null;

  if (!progress) {
    return (
      <div className="card mb-4 flex items-center gap-3 border-blue-200 bg-blue-50 dark:border-emerald-300/20 dark:bg-[#08231b]">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
        <div>
          <p className="text-sm font-bold text-blue-800">Starting the planning workflow</p>
          <p className="mt-0.5 text-xs text-blue-600">Reserving credits and preparing specialist agents…</p>
        </div>
      </div>
    );
  }

  const content = (
    <div className="space-y-2">
      {steps.map(step => (
        <div key={step.key} className={`rounded-xl border px-3 py-2.5 ${statusClass(step.status)}`}>
          <div className="flex items-start gap-2.5">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-black ${
              step.status === 'running' ? 'animate-pulse bg-blue-600 text-white' : 'bg-white/70 dark:bg-black/25'
            }`}>
              {statusIcon(step.status)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2">
                <span className="text-xs font-extrabold">{step.agent}</span>
                <span className="text-xs">{step.message}</span>
              </div>
              {step.detail && <p className="mt-1 text-[11px] leading-4 opacity-80">{step.detail}</p>}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (!isRunning && progress.status === 'completed') {
    return (
      <details className="card mb-5 border-emerald-200 bg-emerald-50/70 dark:border-emerald-300/20 dark:bg-[#071d17]">
        <summary className="cursor-pointer text-sm font-bold text-emerald-800 dark:text-emerald-200">
          Agent workflow completed · {progress.modelCalls || 0} bounded model stages
        </summary>
        <div className="mt-4">{content}</div>
      </details>
    );
  }

  return (
    <section className="card mb-5 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:border-emerald-300/20 dark:from-[#071d17] dark:to-[#0b281e]">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {isRunning && <span className="h-5 w-5 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />}
          <div>
            <p className="text-sm font-extrabold text-blue-900">
              {progress.status === 'failed' ? 'Planning workflow stopped' : 'Specialist agents are building your plan'}
            </p>
            <p className="mt-0.5 text-xs text-blue-600">Current: {progress.currentAgent}</p>
          </div>
        </div>
        <span className="self-start rounded-full bg-white/80 px-3 py-1 text-[11px] font-bold text-indigo-700 dark:bg-black/25 dark:text-emerald-200">
          {progress.modelCalls || 0} model stage{progress.modelCalls === 1 ? '' : 's'}
        </span>
      </div>
      {content}
      {progress.error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs text-red-700">{progress.error}</p>}
    </section>
  );
}
