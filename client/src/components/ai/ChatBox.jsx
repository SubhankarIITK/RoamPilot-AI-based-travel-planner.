import { useState, useRef, useEffect } from 'react';
import ChatMessage from './ChatMessage.jsx';
import { chatTrip } from '../../api/aiApi.js';
import VoiceInputButton from '../common/VoiceInputButton.jsx';

const suggestions = [
  'Make day 2 cheaper',
  'Add more local food',
  'What if it rains?',
  'Give safety guide',
  'Create packing list',
  'Make it more relaxed',
];

export default function ChatBox({ tripId, history, onNewMessage }) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  const send = async (msg) => {
    const text = msg || input.trim();
    if (!text) return;
    setInput('');
    setLoading(true);
    try {
      await onNewMessage({ role: 'user', content: text, createdAt: new Date() });
      const res = await chatTrip(tripId, text);
      await onNewMessage({ role: 'assistant', content: res.data.data.reply, createdAt: new Date() });
    } catch (err) {
      await onNewMessage({
        role: 'assistant',
        content: err.response?.data?.message || 'Unable to reach the AI service. Please try again.',
        createdAt: new Date(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!loading) send();
    }
  };

  return (
    <div className="flex h-full flex-col bg-slate-50/70 dark:bg-transparent">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-3 py-5 sm:px-6 sm:py-6">
        {history.length === 0 && (
          <div className="mx-auto flex max-w-md flex-col items-center py-16 text-center">
            <div className="mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-lime-500 text-2xl text-emerald-950 shadow-[0_12px_30px_rgba(16,185,129,0.22)]">
              ✦
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Your trip copilot</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Ask for itinerary changes, local recommendations, budget help, safety guidance, or packing advice.
            </p>
          </div>
        )}
        {history.map((m, i) => <ChatMessage key={i} message={m} />)}
        {loading && (
          <div className="mb-5 flex items-end gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-lime-500 text-sm text-emerald-950 shadow-sm">
              ✦
            </div>
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
        </div>
      </div>
      <div className="border-t border-slate-200/80 bg-white/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85 dark:shadow-[0_-12px_30px_rgba(0,0,0,0.22)] sm:px-6 sm:pb-3">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-2.5 flex gap-2 overflow-x-auto pb-1">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                disabled={loading}
                className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-sm transition focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 dark:border-white/10 dark:bg-white/[0.045] dark:focus-within:border-indigo-400 dark:focus-within:ring-indigo-500/15">
            <textarea
              data-voice-disabled="true"
              className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-5 text-slate-800 outline-none placeholder:text-slate-400"
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask RoamPilot about this trip..."
            />
            <VoiceInputButton compact value={input} onChange={setInput} disabled={loading} label="Speak your trip question" />
            <button
              type="button"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="btn-primary h-10 min-h-10 px-3 sm:px-4"
              aria-label="Send message"
            >
              Send
            </button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            AI suggestions can be inaccurate. Verify bookings, prices, and emergency information.
          </p>
        </div>
      </div>
    </div>
  );
}
