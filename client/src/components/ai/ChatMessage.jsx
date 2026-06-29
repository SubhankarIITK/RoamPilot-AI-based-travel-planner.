import { lazy, Suspense } from 'react';
import { formatDateTime } from '../../utils/formatDate.js';

const FormattedMessage = lazy(() => import('./FormattedMessage.jsx'));

export default function ChatMessage({ message }) {
  const isUser = message.role === 'user';
  return (
    <div className={`flex items-end gap-2.5 ${isUser ? 'justify-end' : 'justify-start'} mb-5`}>
      {!isUser && (
        <div className="mb-5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-lime-500 text-sm text-emerald-950 shadow-sm">
          ✦
        </div>
      )}
      <div className={`min-w-0 ${isUser ? 'max-w-[82%] sm:max-w-[68%]' : 'max-w-[92%] lg:max-w-[82%]'}`}>
        <div className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${
          isUser
            ? 'rounded-br-md bg-gradient-to-br from-emerald-600 to-green-600 text-white'
            : 'rounded-bl-md border border-slate-200/80 bg-white text-slate-800'
        }`}>
          {isUser ? (
            <p className="whitespace-pre-wrap leading-6">{message.content}</p>
          ) : (
            <Suspense fallback={<p className="whitespace-pre-wrap leading-6">{message.content}</p>}>
              <FormattedMessage content={message.content} />
            </Suspense>
          )}
        </div>
        <p className={`mt-1.5 px-1 text-[11px] ${isUser ? 'text-right text-slate-400' : 'text-slate-400'}`}>
          {isUser ? 'You' : 'RoamPilot'} · {formatDateTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
