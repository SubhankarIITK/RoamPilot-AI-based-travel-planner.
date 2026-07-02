import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTrip, parseTripDescription } from '../api/tripApi.js';
import PageHeader from '../components/common/PageHeader.jsx';
import VoiceInputButton from '../components/common/VoiceInputButton.jsx';
import SelectField from '../components/common/SelectField.jsx';

const planningModes = [
  { value: 'AI decides', label: 'AI decides', detail: 'RoamPilot infers the best mix from your destination, travelers, budget, and notes.' },
  { value: 'Budget Saver', label: 'Budget Saver' },
  { value: 'Luxury Comfort', label: 'Luxury Comfort' },
  { value: 'Hidden Gems', label: 'Hidden Gems' },
  { value: 'Foodie', label: 'Foodie' },
  { value: 'Family Safe', label: 'Family Safe' },
  { value: 'Couple Romantic', label: 'Couple Romantic' },
  { value: 'Backpacker', label: 'Backpacker' },
  { value: 'Weekend Fast Plan', label: 'Weekend Fast Plan' },
  { value: 'Slow Travel', label: 'Slow Travel' },
  { value: 'Photography', label: 'Photography' },
  { value: 'Adventure', label: 'Adventure' },
  { value: 'Spiritual/Cultural', label: 'Spiritual/Cultural' },
];
const planningModeValues = planningModes.map(mode => mode.value);
const normalizePlanningModeSelection = (value, fallback = ['AI decides']) => {
  const values = Array.isArray(value) ? value : [value];
  const matches = planningModeValues.filter(mode =>
    values.some(item => String(item || '').toLowerCase().includes(mode.toLowerCase())),
  );
  return matches.length ? matches : fallback;
};
const budgetModes = [
  { value: 'ai-managed', label: 'AI-managed budget', detail: 'RoamPilot estimates the realistic amount from your trip choices.' },
  { value: 'budget-friendly', label: 'Budget-friendly', detail: 'Lower-cost stays, food, transport, and activities.' },
  { value: 'balanced', label: 'Balanced', detail: 'Comfort and value without unnecessary upgrades.' },
  { value: 'premium', label: 'Premium', detail: 'Higher-comfort stays, dining, and smoother transport.' },
  { value: 'luxury', label: 'Luxury', detail: 'Luxury stays and experiences within a realistic range.' },
  { value: 'hard-budget', label: 'User-defined hard budget', detail: 'Use a fixed ceiling and warn if the trip is not feasible.' },
];

const manualQuestions = [
  { id: 'title', question: 'What would you like to call this trip?', help: 'Give it a short name you will recognize later.', required: true },
  { id: 'origin', question: 'Where will you start your journey?', help: 'Enter your departure city or location.' },
  { id: 'destination', question: 'Where do you want to go?', help: 'Enter the main destination for this trip.', required: true },
  { id: 'startDate', question: 'When will your trip begin?', help: 'You can skip this if your dates are not decided yet.' },
  { id: 'endDate', question: 'When will your trip end?', help: 'The end date must be on or after the start date.' },
  { id: 'travelers', question: 'How many people are travelling?', help: 'Include yourself in the total.' },
  { id: 'budgetMode', question: 'Do you have a fixed budget, or should RoamPilot estimate one?', help: 'Choose how the planner should handle money for this trip.', required: true },
  { id: 'budget', question: 'What is your fixed total trip budget?', help: 'This amount is only required for a user-defined hard budget.' },
  { id: 'travelStyle', question: 'What pace do you prefer?', help: 'This controls how much is planned into each day.' },
  { id: 'planningMode', question: 'What kind of experience are you looking for?', help: 'Let AI decide, or combine as many travel styles as you need.' },
  { id: 'mustVisitPlaces', question: 'Are there places you definitely want to visit?', help: 'Separate multiple places with commas.' },
  { id: 'avoidList', question: 'Is there anything you want to avoid?', help: 'For example: long hikes, nightlife, crowds, or specific foods.' },
  { id: 'notes', question: 'Anything else the planner should know?', help: 'Add accessibility needs, occasions, preferences, or other context.' },
];

export default function CreateTrip() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '', origin: '', destination: '', startDate: '', endDate: '',
    travelers: 1, budgetMode: 'ai-managed', budget: '', currency: 'INR', travelStyle: 'balanced',
    planningMode: ['AI decides'], mustVisitPlaces: '', avoidList: '', notes: '',
  });
  const [creationMode, setCreationMode] = useState('ai');
  const [description, setDescription] = useState('');
  const [aiMessage, setAiMessage] = useState('');
  const [manualStep, setManualStep] = useState(0);
  const [parsing, setParsing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (key, value) => {
    setForm(current => ({ ...current, [key]: value }));
    setError('');
  };

  const handleParseDescription = async () => {
    if (description.trim().length < 15) {
      setError('Describe your trip in a little more detail.');
      return;
    }

    setParsing(true);
    setError('');
    setAiMessage('');
    try {
      const response = await parseTripDescription(description.trim());
      const { draft, missingFields = [] } = response.data.data;
      setForm(current => ({
        ...current,
        ...draft,
        title: draft.title || current.title,
        origin: draft.origin || '',
        destination: draft.destination || '',
        startDate: draft.startDate || '',
        endDate: draft.endDate || '',
        travelers: draft.travelers || 1,
        budget: draft.budget || '',
        budgetMode: Number(draft.budget) > 0 ? 'hard-budget' : 'ai-managed',
        currency: draft.currency || current.currency,
        travelStyle: draft.travelStyle || current.travelStyle,
        planningMode: normalizePlanningModeSelection(draft.planningMode, current.planningMode),
        mustVisitPlaces: (draft.mustVisitPlaces || []).join(', '),
        avoidList: (draft.avoidList || []).join(', '),
        notes: draft.notes || description.trim(),
      }));
      setCreationMode('form');
      const firstMissingStep = manualQuestions.findIndex(question => missingFields.includes(question.id));
      setManualStep(firstMissingStep >= 0 ? firstMissingStep : 0);
      setAiMessage(missingFields.length
        ? `AI prepared the draft. Please review it and complete: ${missingFields.join(', ')}.`
        : 'AI prepared the trip details. Review them before creating the trip.');
    } catch (err) {
      setError(err.response?.data?.message || 'AI could not understand the trip description.');
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.title.trim()) {
      setManualStep(manualQuestions.findIndex(question => question.id === 'title'));
      setError('Please give your trip a title.');
      return;
    }
    if (!form.destination.trim()) {
      setManualStep(manualQuestions.findIndex(question => question.id === 'destination'));
      setError('Please enter your destination.');
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setManualStep(manualQuestions.findIndex(question => question.id === 'endDate'));
      setError('End date cannot be before the start date.');
      return;
    }
    if (form.budgetMode === 'hard-budget' && !(Number(form.budget) > 0)) {
      setManualStep(manualQuestions.findIndex(question => question.id === 'budget'));
      setError('Please enter a positive amount for your hard budget.');
      return;
    }

    setLoading(true);
    try {
      const data = {
        ...form,
        planningMode: Array.isArray(form.planningMode)
          ? form.planningMode.join(' + ')
          : form.planningMode,
        budget: form.budgetMode === 'hard-budget' ? Number(form.budget) : 0,
        travelers: Number(form.travelers),
        mustVisitPlaces: form.mustVisitPlaces.split(',').map(value => value.trim()).filter(Boolean),
        avoidList: form.avoidList.split(',').map(value => value.trim()).filter(Boolean),
      };
      const response = await createTrip(data);
      navigate(`/trips/${response.data.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create trip');
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = manualQuestions[manualStep];
  const isLastQuestion = manualStep === manualQuestions.length - 1;
  const currentAnswer = form[currentQuestion.id];
  const hasCurrentAnswer = currentQuestion.id === 'budget' && form.budgetMode !== 'hard-budget'
    ? true
    : String(currentAnswer ?? '').trim().length > 0;
  const currentQuestionRequired = currentQuestion.required ||
    (currentQuestion.id === 'budget' && form.budgetMode === 'hard-budget');
  const supportsVoiceAnswer = [
    'title',
    'origin',
    'destination',
    'mustVisitPlaces',
    'avoidList',
    'notes',
  ].includes(currentQuestion.id);

  const goToNextQuestion = () => {
    if (currentQuestionRequired && !hasCurrentAnswer) {
      setError(`Please answer: ${currentQuestion.question}`);
      return;
    }
    if (currentQuestion.id === 'endDate' && form.startDate && form.endDate && form.endDate < form.startDate) {
      setError('End date cannot be before the start date.');
      return;
    }
    setError('');
    setManualStep(step => Math.min(step + 1, manualQuestions.length - 1));
  };

  const renderManualAnswer = () => {
    const sharedProps = {
      className: 'input min-h-12 text-base',
      autoFocus: true,
      'aria-label': currentQuestion.question,
    };

    switch (currentQuestion.id) {
      case 'title':
        return <input {...sharedProps} value={form.title} onChange={event => set('title', event.target.value)} placeholder="Goa Beach Vacation" />;
      case 'origin':
        return <input {...sharedProps} value={form.origin} onChange={event => set('origin', event.target.value)} placeholder="Mumbai" />;
      case 'destination':
        return <input {...sharedProps} value={form.destination} onChange={event => set('destination', event.target.value)} placeholder="Goa" />;
      case 'startDate':
        return <input {...sharedProps} type="date" value={form.startDate} onChange={event => set('startDate', event.target.value)} />;
      case 'endDate':
        return <input {...sharedProps} type="date" min={form.startDate || undefined} value={form.endDate} onChange={event => set('endDate', event.target.value)} />;
      case 'travelers':
        return <input {...sharedProps} type="number" min="1" value={form.travelers} onChange={event => set('travelers', event.target.value)} />;
      case 'budgetMode':
        return (
          <div className="grid gap-2 sm:grid-cols-2">
            {budgetModes.map(mode => (
              <button
                type="button"
                key={mode.value}
                onClick={() => {
                  set('budgetMode', mode.value);
                  if (mode.value !== 'hard-budget') {
                    setForm(current => ({ ...current, budget: '' }));
                  }
                }}
                className={`rounded-2xl border p-4 text-left transition ${
                  form.budgetMode === mode.value
                    ? 'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-200 dark:bg-emerald-400/10 dark:ring-emerald-400/15'
                    : 'border-slate-200 bg-white hover:border-emerald-200 dark:border-white/10 dark:bg-slate-900/60'
                }`}
              >
                <span className="block text-sm font-bold text-slate-900 dark:text-white">{mode.label}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">{mode.detail}</span>
              </button>
            ))}
          </div>
        );
      case 'budget':
        if (form.budgetMode !== 'hard-budget') {
          return (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-400/[0.08] dark:text-emerald-100">
              No amount is required. RoamPilot will estimate a realistic total and will not artificially spend up to a ceiling.
            </div>
          );
        }
        return (
          <div className="flex gap-3">
            <SelectField
              className="w-28 shrink-0"
              buttonClassName="min-h-12 text-base"
              value={form.currency}
              onChange={value => set('currency', value)}
              options={['INR', 'USD', 'EUR', 'GBP']}
              ariaLabel="Budget currency"
            />
            <input {...sharedProps} className={`${sharedProps.className} flex-1`} type="number" min="1" value={form.budget} onChange={event => set('budget', event.target.value)} placeholder="50000" />
          </div>
        );
      case 'travelStyle':
        return (
          <SelectField
            buttonClassName="min-h-12 text-base"
            value={form.travelStyle}
            onChange={value => set('travelStyle', value)}
            options={[
              { value: 'relaxed', label: 'Relaxed' },
              { value: 'balanced', label: 'Balanced' },
              { value: 'packed', label: 'Packed' },
            ]}
            ariaLabel={currentQuestion.question}
          />
        );
      case 'planningMode':
        return (
          <div>
            <SelectField
              multiple
              buttonClassName="min-h-12 text-base"
              value={form.planningMode}
              onChange={nextValues => {
                const selectedAiLast = nextValues.at(-1) === 'AI decides';
                const withoutAi = nextValues.filter(value => value !== 'AI decides');
                set('planningMode', selectedAiLast || withoutAi.length === 0
                  ? ['AI decides']
                  : withoutAi);
              }}
              options={planningModes}
              placeholder="Choose one or more styles"
              ariaLabel={currentQuestion.question}
            />
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Multiple selections are blended into one itinerary. Selecting “AI decides” clears manual styles.
            </p>
          </div>
        );
      case 'mustVisitPlaces':
        return <input {...sharedProps} value={form.mustVisitPlaces} onChange={event => set('mustVisitPlaces', event.target.value)} placeholder="Baga Beach, Dudhsagar Falls" />;
      case 'avoidList':
        return <input {...sharedProps} value={form.avoidList} onChange={event => set('avoidList', event.target.value)} placeholder="Long hikes, casinos, crowded places" />;
      case 'notes':
        return <textarea {...sharedProps} className={`${sharedProps.className} min-h-32 resize-y`} value={form.notes} onChange={event => set('notes', event.target.value)} placeholder="Anniversary trip, travelling with elderly parents..." />;
      default:
        return null;
    }
  };

  return (
    <div className="page-container max-w-3xl">
      <PageHeader title="Plan a New Trip" subtitle="Describe the journey naturally or enter the details yourself" />
      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <button type="button" onClick={() => setCreationMode('ai')} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${creationMode === 'ai' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
          Describe with AI
        </button>
        <button type="button" onClick={() => setCreationMode('form')} className={`rounded-lg px-3 py-2.5 text-sm font-semibold transition ${creationMode === 'form' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
          Manual details
        </button>
      </div>

      {creationMode === 'ai' && (
        <section className="card overflow-hidden p-0">
          <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 p-5 dark:from-blue-500/10 dark:to-indigo-500/10 sm:p-7">
            <span className="mb-3 inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-blue-700 shadow-sm dark:bg-blue-400/10 dark:text-blue-200">AI trip builder</span>
            <h2 className="text-xl font-bold text-slate-900">Tell us what your ideal trip looks like</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Include the destination, dates, travelers, budget, interests, pace, and anything you want to avoid. Write normally.</p>
          </div>
          <div className="space-y-4 p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <label className="label mb-0" htmlFor="trip-description">Your trip description</label>
              <VoiceInputButton value={description} onChange={setDescription} label="Speak your trip description" />
            </div>
            <textarea
              data-voice-disabled="true"
              id="trip-description"
              className="input min-h-44 resize-y leading-6"
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Plan a 7-day family trip from Kolkata to Kerala in December for 4 people. Budget is ₹1,20,000. We prefer a relaxed pace, nature, local food, and comfortable hotels. Avoid long hikes."
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">AI creates an editable draft. Nothing is saved until you review and create it.</p>
              <button type="button" onClick={handleParseDescription} disabled={parsing} className="btn-primary min-w-40">
                {parsing ? 'Understanding...' : 'Create editable draft'}
              </button>
            </div>
          </div>
        </section>
      )}

      {creationMode === 'form' && (
        <form
          onSubmit={isLastQuestion ? handleSubmit : event => { event.preventDefault(); goToNextQuestion(); }}
          className="card p-0"
        >
          {aiMessage && <div className="m-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-300/15 dark:bg-emerald-300/10 dark:text-emerald-200 sm:mx-7">{aiMessage}</div>}
          <div className="rounded-t-2xl border-b border-emerald-200/70 bg-emerald-50/70 px-5 py-4 dark:border-emerald-300/10 dark:bg-emerald-300/[0.04] sm:px-7">
            <div className="mb-2 flex items-center justify-between gap-4 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <span>Question {manualStep + 1} of {manualQuestions.length}</span>
              <span>{Math.round(((manualStep + 1) / manualQuestions.length) * 100)}% complete</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-emerald-100 dark:bg-emerald-950/70">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-lime-500 transition-[width] duration-300"
                style={{ width: `${((manualStep + 1) / manualQuestions.length) * 100}%` }}
              />
            </div>
          </div>

          <div className="px-5 py-8 sm:px-8 sm:py-10">
            <div className="mx-auto max-w-xl">
              <span className="eyebrow">{currentQuestionRequired ? 'Required' : 'Optional'}</span>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">{currentQuestion.question}</h2>
              <p className="mb-6 mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{currentQuestion.help}</p>
              {renderManualAnswer()}
              {supportsVoiceAnswer && (
                <div className="mt-3 flex justify-end">
                  <VoiceInputButton
                    value={String(currentAnswer || '')}
                    onChange={nextValue => set(currentQuestion.id, nextValue)}
                    label="Speak your answer"
                  />
                </div>
              )}

              <div className="mt-8 flex items-center justify-between gap-3">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={manualStep === 0 || loading}
                  onClick={() => { setError(''); setManualStep(step => Math.max(0, step - 1)); }}
                >
                  ← Back
                </button>
                <button type="submit" disabled={loading} className="btn-primary min-w-32">
                  {loading
                    ? 'Creating...'
                    : isLastQuestion
                      ? 'Create Trip →'
                      : (!currentQuestionRequired && !hasCurrentAnswer ? 'Skip →' : 'Next →')}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
