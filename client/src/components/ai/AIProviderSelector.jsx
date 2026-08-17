import { useEffect, useState } from 'react';
import api from '../../api/axiosInstance.js';

export default function AIProviderSelector({ compact = false }) {
  const [configuration, setConfiguration] = useState(null);

  useEffect(() => {
    let active = true;
    api.get('/ai/providers')
      .then(response => {
        if (active) setConfiguration(response.data.data);
      })
      .catch(() => {
        if (active) setConfiguration(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const available = configuration?.availableProviders || {};
  const groqAvailable = configuration === null || Boolean(available.groq);

  return (
    <section className={compact
      ? 'mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3 dark:border-emerald-300/15 dark:bg-emerald-300/[0.05]'
      : 'card'}>
      <div>
        <p className="eyebrow">AI model provider</p>
        <h2 className={`${compact ? 'text-sm' : 'mt-1 text-lg'} font-bold text-slate-900 dark:text-white`}>
          Groq
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          RoamPilot uses the configured Groq model for AI planning and chat.
        </p>
      </div>

      <div className="mt-3 rounded-xl border border-emerald-500 bg-emerald-100/80 p-3 ring-2 ring-emerald-200 dark:bg-emerald-300/10 dark:ring-emerald-400/10">
        <span className="flex items-center justify-between gap-2">
          <span className="text-sm font-extrabold text-slate-900 dark:text-white">
            Groq
          </span>
          <span className={`h-2.5 w-2.5 rounded-full ${groqAvailable ? 'bg-emerald-500' : 'bg-slate-400'}`} />
        </span>
        <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          Fast generation using the configured Groq model.
        </span>
      </div>

      {!groqAvailable && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-300/10 dark:text-amber-200">
          GROQ_API_KEY is not configured on the server.
        </p>
      )}
      {configuration && groqAvailable && (
        <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Active for new requests: Groq
        </p>
      )}
    </section>
  );
}
