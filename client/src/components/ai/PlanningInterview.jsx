import VoiceInputButton from '../common/VoiceInputButton.jsx';

export default function PlanningInterview({
  interview,
  loading,
  answers,
  currentIndex,
  onAnswer,
  onNext,
  onBack,
  onSkip,
}) {
  if (loading) {
    return (
      <div className="card mx-auto max-w-3xl py-10 text-center">
        <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-blue-100 border-t-blue-600" />
        <h2 className="font-semibold text-slate-800">Preparing questions for your trip</h2>
        <p className="mt-1 text-sm text-slate-500">The AI is checking what it needs to know before planning.</p>
      </div>
    );
  }

  if (!interview?.questions?.length) return null;

  const question = interview.questions[currentIndex];
  const value = answers[question.id] || '';
  const isLast = currentIndex === interview.questions.length - 1;
  const canContinue = !question.required || Boolean(value.trim());
  const progress = ((currentIndex + 1) / interview.questions.length) * 100;

  return (
    <section className="card mx-auto max-w-3xl overflow-hidden p-0">
      <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 via-white to-indigo-50 p-5 dark:from-blue-500/10 dark:via-slate-900 dark:to-indigo-500/10 sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">AI planning interview</span>
          <span className="text-xs font-semibold text-slate-500">Question {currentIndex + 1} of {interview.questions.length}</span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-blue-100">
          <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
        {currentIndex === 0 && <p className="mt-4 text-sm leading-6 text-slate-600">{interview.intro}</p>}
      </div>

      <div className="p-5 sm:p-7">
        <h2 className="text-xl font-bold leading-8 text-slate-900">{question.question}</h2>
        {question.reason && <p className="mt-2 text-sm leading-6 text-slate-500">{question.reason}</p>}

        {question.type === 'single_choice' ? (
          <div className="mt-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {question.options.map(option => (
                <button
                  key={option}
                  type="button"
                  onClick={() => onAnswer(question.id, option)}
                  className={`rounded-xl border p-3 text-left text-sm font-medium leading-5 transition ${value === option ? 'border-blue-500 bg-blue-50 text-blue-800 ring-2 ring-blue-100 dark:border-blue-400 dark:bg-blue-400/10 dark:text-blue-100 dark:ring-blue-500/15' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 dark:border-white/10 dark:bg-white/[0.035] dark:text-slate-200 dark:hover:border-blue-400/40 dark:hover:bg-blue-400/[0.07]'}`}
                >
                  <span className="flex items-center gap-2">
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${value === option ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>{value === option ? '✓' : ''}</span>
                    {option}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2">
              <input
                data-voice-disabled="true"
                value={question.options.includes(value) ? '' : value}
                onChange={event => onAnswer(question.id, event.target.value)}
                className="input"
                placeholder="Or write your own specific answer..."
              />
              <VoiceInputButton compact value={question.options.includes(value) ? '' : value} onChange={nextValue => onAnswer(question.id, nextValue)} label="Speak a custom answer" />
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <div className="mb-2 flex justify-end">
              <VoiceInputButton value={value} onChange={nextValue => onAnswer(question.id, nextValue)} label="Speak your answer" />
            </div>
            <textarea
              data-voice-disabled="true"
              autoFocus
              value={value}
              onChange={event => onAnswer(question.id, event.target.value)}
              className="input min-h-32 resize-y leading-6"
              placeholder="Write your answer naturally. You can include several details."
            />
          </div>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onSkip} className="text-sm font-medium text-slate-500 hover:text-slate-800">Skip interview</button>
          <div className="flex gap-2">
            {currentIndex > 0 && <button type="button" onClick={onBack} className="btn-secondary">Back</button>}
            <button type="button" onClick={onNext} disabled={!canContinue} className="btn-primary min-w-28 disabled:cursor-not-allowed disabled:opacity-50">
              {isLast ? 'Use my answers' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
