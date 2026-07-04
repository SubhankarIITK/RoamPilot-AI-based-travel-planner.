import { useEffect, useState } from 'react';
import api from '../../api/axiosInstance.js';
import {
  getAIProviderPreference,
  setAIProviderPreference,
} from '../../utils/clientStorage.js';

const PROVIDERS = [
  {
    id: 'auto',
    title: 'Automatic',
    description: 'Use Groq first and switch to Gemini if the provider is temporarily unavailable.',
  },
  {
    id: 'groq',
    title: 'Groq',
    description: 'Fast generation using the configured Groq model.',
  },
  {
    id: 'gemini',
    title: 'Gemini',
    description: 'Use the configured Gemini model for planning and chat.',
  },
];

export default function AIProviderSelector({ compact = false }) {
  const [preference, setPreference] = useState(getAIProviderPreference);
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

  const selectProvider = provider => {
    setAIProviderPreference(provider);
    setPreference(provider);
  };
  const available = configuration?.availableProviders || {};
  const selectedUnavailable =
    preference !== 'auto' && configuration && !available[preference];
  const activeProvider = preference === 'auto'
    ? available.groq
      ? 'groq'
      : available.gemini
        ? 'gemini'
        : null
    : available[preference]
      ? preference
      : null;

  return (
    <section className={compact
      ? 'mb-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-3 dark:border-emerald-300/15 dark:bg-emerald-300/[0.05]'
      : 'card'}>
      <div>
        <p className="eyebrow">AI model provider</p>
        <h2 className={`${compact ? 'text-sm' : 'mt-1 text-lg'} font-bold text-slate-900 dark:text-white`}>
          Choose Groq or Gemini
        </h2>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          The choice applies to your next AI request. API keys always remain on the server.
        </p>
      </div>

      <div className={`mt-3 grid gap-2 ${compact ? 'sm:grid-cols-3' : 'sm:grid-cols-3'}`}>
        {PROVIDERS.map(provider => {
          const providerAvailable =
            provider.id === 'auto' ||
            configuration === null ||
            Boolean(available[provider.id]);
          const selected = preference === provider.id;
          return (
            <button
              key={provider.id}
              type="button"
              disabled={!providerAvailable}
              onClick={() => selectProvider(provider.id)}
              className={`rounded-xl border p-3 text-left transition ${
                selected
                  ? 'border-emerald-500 bg-emerald-100/80 ring-2 ring-emerald-200 dark:bg-emerald-300/10 dark:ring-emerald-400/10'
                  : 'border-slate-200 bg-white hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.03]'
              } ${providerAvailable ? '' : 'cursor-not-allowed opacity-45'}`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="text-sm font-extrabold text-slate-900 dark:text-white">
                  {provider.title}
                </span>
                <span className={`h-2.5 w-2.5 rounded-full ${
                  provider.id === 'auto'
                    ? 'bg-gradient-to-r from-emerald-500 to-blue-500'
                    : providerAvailable
                      ? 'bg-emerald-500'
                      : 'bg-slate-400'
                }`} />
              </span>
              <span className="mt-1 block text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                {provider.description}
              </span>
            </button>
          );
        })}
      </div>

      {selectedUnavailable && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:bg-amber-300/10 dark:text-amber-200">
          {preference === 'gemini' ? 'GEMINI_API_KEY' : 'GROQ_API_KEY'} is not configured on the server.
        </p>
      )}
      {configuration && activeProvider && (
        <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
          Active for new requests: {activeProvider === 'groq' ? 'Groq' : 'Gemini'}
        </p>
      )}
    </section>
  );
}
