import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getTripById, getTripPlaceImages } from '../api/tripApi.js';
import {
  finalizeLazyPlan,
  generateLazyDay,
  getLazyPlan,
  getLatestTripPlanningProgress,
  getPlanningProgress,
  getPlanningQuestions,
  initializeLazyPlan,
  optimizeBudget,
  repairLazyDay,
  regenerateDay,
  transformTrip,
} from '../api/aiApi.js';
import AgentProgress from '../components/ai/AgentProgress.jsx';
import PlanningInterview from '../components/ai/PlanningInterview.jsx';
import ItineraryDayCard from '../components/itinerary/ItineraryDayCard.jsx';
import TripScoreCard from '../components/trip/TripScoreCard.jsx';
import Loader from '../components/common/Loader.jsx';
import { formatCurrency } from '../utils/formatCurrency.js';
import VoiceInputButton from '../components/common/VoiceInputButton.jsx';
import AIProviderSelector from '../components/ai/AIProviderSelector.jsx';

const transformations = [
  { id: 'cheaper', label: 'Make Cheaper' },
  { id: 'relaxed', label: 'Make Relaxed' },
  { id: 'adventurous', label: 'More Adventurous' },
  { id: 'hidden-gems', label: 'Find Hidden Gems' },
  { id: 'food-focus', label: 'Local Food Focus' },
  { id: 'family-friendly', label: 'Family Friendly' },
  { id: 'romantic', label: 'More Romantic' },
  { id: 'rainy-safe', label: 'Rainy-day Safe' },
];

const instructionPresets = [
  'Make every day highly detailed with realistic travel times and booking guidance.',
  'Prioritize authentic local food and well-reviewed restaurants.',
  'Keep walking and transfers low, with a relaxed daily pace.',
  'Make the itinerary family-friendly with regular rest breaks.',
];

function LazyDayPlaceholder({ record, currency, busy, onGenerate }) {
  const skeleton = record.skeleton || {};
  const failed = record.status === 'failed';
  const needsRepair = record.status === 'needs_repair';
  const isGenerating = record.status === 'generating' || busy;
  return (
    <article className={`card overflow-hidden border ${
      failed || needsRepair
        ? 'border-amber-300/70'
        : 'border-emerald-200/70 dark:border-emerald-300/15'
    }`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-600 text-sm font-black text-white">
            {record.day}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-extrabold text-slate-900 dark:text-white">
                Day {record.day} · {skeleton.theme}
              </h4>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
                failed || needsRepair
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-300/10 dark:text-amber-200'
                  : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200'
              }`}>
                {record.status.replaceAll('_', ' ')}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {skeleton.cityZone} · {skeleton.roughPace} pace
              {skeleton.budgetEnvelope > 0 &&
                ` · ${formatCurrency(skeleton.budgetEnvelope, currency)} day envelope`}
            </p>
            {skeleton.requiredPlaces?.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Planned destination visits
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {skeleton.requiredPlaces.map(place => (
                    <span key={place.placeId || place.name} className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-100">
                      {place.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {skeleton.mustAccomplish?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {skeleton.mustAccomplish.slice(0, 4).map(item => (
                  <span key={item} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/5 dark:text-slate-300">
                    {item}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
              {failed
                ? record.lastError
                : `${skeleton.previousDayContinuity}. ${skeleton.nextDayContinuity}.`}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          disabled={isGenerating}
          onClick={() => onGenerate(record.day, needsRepair)}
        >
          {isGenerating
            ? 'Generating…'
            : needsRepair
              ? 'Repair this day'
              : failed
                ? 'Retry this day'
                : 'Generate day'}
        </button>
      </div>
    </article>
  );
}

export default function AIPlanner() {
  const { id } = useParams();
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [useWebSearch, setUseWebSearch] = useState(true);
  const [interview, setInterview] = useState(null);
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [workflowProgress, setWorkflowProgress] = useState(null);
  const [placeGallery, setPlaceGallery] = useState(null);
  const [placeGalleryLoading, setPlaceGalleryLoading] = useState(false);
  const [lazyPlan, setLazyPlan] = useState(null);
  const [activeDayNumber, setActiveDayNumber] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const lazyGeneratingDayKey = lazyPlan?.days
    ?.filter(day => day.status === 'generating')
    .map(day => day.day)
    .join(',') || '';

  const beginInterview = async (reset = false) => {
    setShowInterview(true);
    setInterviewLoading(true);
    setError('');
    if (reset) {
      setAnswers({});
      setQuestionIndex(0);
    }
    try {
      const response = await getPlanningQuestions(id);
      setInterview(response.data.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not prepare planning questions.');
      setShowInterview(false);
    } finally {
      setInterviewLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      try {
        const response = await getTripById(id);
        const loadedTrip = response.data.data;
        setTrip(loadedTrip);
        setInstructions(loadedTrip.aiPlan?.generationContext?.customInstructions || '');
        setAnswers(loadedTrip.aiPlan?.generationContext?.planningAnswers || {});
        let restoredLazyPlan = null;
        try {
          const lazyResponse = await getLazyPlan(id);
          restoredLazyPlan = lazyResponse.data.data;
          setLazyPlan(restoredLazyPlan);
          const lazyRunning =
            restoredLazyPlan.status === 'foundation_generating' ||
            restoredLazyPlan.days?.some(day => day.status === 'generating');
          setGenerating(Boolean(lazyRunning));
          if (restoredLazyPlan.status === 'failed' && restoredLazyPlan.lastError) {
            setError(restoredLazyPlan.lastError);
          }
          setShowInterview(false);
        } catch (lazyError) {
          if (lazyError.response?.status !== 404) {
            console.error('Could not restore lazy planning state:', lazyError.message);
          }
        }
        let restoredProgress = null;
        if (!restoredLazyPlan) {
          try {
            const progressResponse = await getLatestTripPlanningProgress(id);
            restoredProgress = progressResponse.data.data;
            setWorkflowProgress(restoredProgress);
            setGenerating(restoredProgress.status === 'running');
            setShowInterview(false);
          } catch (progressError) {
            if (progressError.response?.status !== 404) {
              console.error('Could not restore planning progress:', progressError.message);
            }
          }
        }
        if (!loadedTrip.aiPlan && !restoredProgress && !restoredLazyPlan) await beginInterview();
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load this trip.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  useEffect(() => {
    const workflowId = workflowProgress?.workflowId;
    if (!workflowId || workflowProgress.status !== 'running') return undefined;

    let cancelled = false;
    setGenerating(true);
    const poll = async () => {
      try {
        const response = await getPlanningProgress(workflowId);
        if (cancelled) return;
        const progress = response.data.data;
        setWorkflowProgress(progress);
        if (progress.status === 'completed') {
          const tripResponse = await getTripById(id);
          if (!cancelled) {
            setTrip(tripResponse.data.data);
            setError('');
            setGenerating(false);
          }
        } else if (progress.status === 'failed') {
          setGenerating(false);
        }
      } catch (pollError) {
        if (!cancelled && pollError.response?.status !== 404) {
          console.error('Planning progress polling failed:', pollError.message);
        }
      }
    };
    poll();
    const interval = window.setInterval(poll, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [id, workflowProgress?.workflowId, workflowProgress?.status]);

  useEffect(() => {
    const lazyRunning =
      lazyPlan?.status === 'foundation_generating' ||
      lazyPlan?.days?.some(day => day.status === 'generating');
    if (!lazyPlan || !lazyRunning || activeDayNumber) return undefined;

    let cancelled = false;
    const poll = async () => {
      try {
        const response = await getLazyPlan(id);
        if (cancelled) return;
        const state = response.data.data;
        setLazyPlan(state);
        const stillRunning =
          state.status === 'foundation_generating' ||
          state.days?.some(day => day.status === 'generating');
        setGenerating(Boolean(stillRunning));
        if (!stillRunning) {
          const tripResponse = await getTripById(id);
          if (!cancelled) setTrip(tripResponse.data.data);
        }
        if (state.status === 'failed' && state.lastError) {
          setError(state.lastError);
        }
      } catch (pollError) {
        if (!cancelled && pollError.response?.status !== 404) {
          console.error('Lazy planning status polling failed:', pollError.message);
        }
      }
    };
    const interval = window.setInterval(poll, 2500);
    poll();
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [id, lazyPlan?.status, lazyGeneratingDayKey, activeDayNumber]);

  useEffect(() => {
    if (!trip?.aiPlan?.dayWiseItinerary?.length) {
      setPlaceGallery(null);
      return undefined;
    }

    let cancelled = false;
    setPlaceGalleryLoading(true);
    getTripPlaceImages(id)
      .then(response => {
        if (!cancelled) setPlaceGallery(response.data.data);
      })
      .catch(() => {
        if (!cancelled) setPlaceGallery(null);
      })
      .finally(() => {
        if (!cancelled) setPlaceGalleryLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, trip?.aiPlan]);

  const runAction = async (action, fallbackMessage) => {
    setGenerating(true);
    setWorkflowProgress(null);
    setError('');
    try {
      const response = await action();
      setTrip(response.data.data.trip);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || fallbackMessage);
      return false;
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = async () => {
    setShowInterview(false);
    setGenerating(true);
    setError('');
    setWorkflowProgress(null);

    try {
      const response = await initializeLazyPlan(id, {
        instructions: instructions.trim(),
        useWebSearch,
        planningAnswers: answers,
      });
      setTrip(response.data.data.trip);
      setLazyPlan(response.data.data.lazyPlan);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || 'Trip foundation generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };
  const handleTransform = transformation => runAction(() => transformTrip(id, transformation), 'Trip transformation failed.');
  const handleOptimizeBudget = () => runAction(() => optimizeBudget(id), 'Budget optimization failed.');
  const handleRegenDay = (dayNumber, instruction) => {
    if (!lazyPlan) {
      return runAction(
        () => regenerateDay(id, dayNumber, instruction),
        'Day regeneration failed.',
      );
    }
    return handleLazyDay(dayNumber, true, instruction);
  };
  const handleLazyDay = async (dayNumber, repair = false, instruction = '') => {
    if (activeDayNumber) return;
    setActiveDayNumber(dayNumber);
    setError('');
    try {
      const response = repair
        ? await repairLazyDay(id, dayNumber, instruction)
        : await generateLazyDay(id, dayNumber);
      setTrip(response.data.data.trip);
      setLazyPlan(response.data.data.lazyPlan);
    } catch (err) {
      setError(err.response?.data?.message || `Day ${dayNumber} generation failed.`);
      try {
        const state = await getLazyPlan(id);
        setLazyPlan(state.data.data);
      } catch {
        // The original error remains the useful user-facing message.
      }
      return false;
    } finally {
      setActiveDayNumber(null);
    }
  };
  const handleFinalize = async () => {
    if (finalizing) return;
    setFinalizing(true);
    setError('');
    try {
      const response = await finalizeLazyPlan(id);
      setTrip(response.data.data.trip);
      setLazyPlan(response.data.data.lazyPlan);
      if (!response.data.data.finalized) {
        setError('The full draft is saved, but the marked days need targeted repair before publishing.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Final itinerary validation failed.');
    } finally {
      setFinalizing(false);
    }
  };
  const handleInterviewNext = () => {
    if (questionIndex >= (interview?.questions?.length || 1) - 1) {
      setShowInterview(false);
      if (plan) handleGenerate();
    } else {
      setQuestionIndex(index => index + 1);
    }
  };

  if (loading) return <Loader />;

  const plan = trip?.aiPlan;
  const budgetVerdict = plan?.budgetSummary?.verdict ||
    plan?.budgetSummary?.status ||
    'comfortable';
  const isOverBudget = ['insufficient', 'over-budget'].includes(budgetVerdict);
  const hasRetainedSavings = !isOverBudget && Number(plan?.budgetSummary?.savings) > 0;
  const getDayGallery = day =>
    placeGallery?.days?.find(galleryDay => Number(galleryDay.day) === Number(day?.day));
  const lazyIsFinalized = lazyPlan?.status === 'completed';
  const generationPreferences = (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 text-left sm:p-5">
      <AIProviderSelector compact />
      <div className="flex items-center justify-between gap-3">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="planner-instructions">Extra instructions</label>
        <VoiceInputButton value={instructions} onChange={nextValue => setInstructions(nextValue.slice(0, 1200))} label="Speak extra planning instructions" />
      </div>
      <p className="mt-1 text-xs leading-5 text-slate-500">Add anything the guided questions did not cover.</p>
      <textarea data-voice-disabled="true" id="planner-instructions" value={instructions} onChange={event => setInstructions(event.target.value)} rows={4} maxLength={1200} className="input mt-3 resize-y leading-6" placeholder="Example: Include photography times, exact transfer guidance, rest breaks, estimated costs, and rainy-day alternatives." />
      <div className="mt-3 flex flex-wrap gap-2">
        {instructionPresets.map(preset => <button key={preset} type="button" onClick={() => setInstructions(preset)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-300 hover:text-blue-700">{preset}</button>)}
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-3">
        <input type="checkbox" checked={useWebSearch} onChange={event => setUseWebSearch(event.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-600" />
        <span><span className="block text-sm font-semibold text-slate-800">Use live web research</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Check current transport, closures, seasonal conditions, safety, and local costs.</span></span>
      </label>
      {Object.keys(answers).length > 0 && <p className="mt-3 text-xs font-semibold text-emerald-700">✓ {Object.keys(answers).length} guided answers will be used</p>}
    </div>
  );

  return (
    <div className="page-container">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link to={`/trips/${id}`} className="mb-1 block text-sm text-blue-600 hover:underline">← Back to Workspace</Link>
          <h1 className="text-xl font-bold text-slate-800">AI Planner · {trip?.title}</h1>
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto"><Link to={`/trips/${id}/bookings`} className="btn-secondary">Book & Compare</Link><Link to={`/trips/${id}/chat`} className="btn-secondary">AI Chat</Link></div>
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      <AgentProgress isRunning={generating} progress={workflowProgress} />
      {(generating || workflowProgress?.status === 'failed') &&
        workflowProgress?.partialItinerary?.length > 0 && (
        <section className="card mb-5 border-emerald-200/80 dark:border-emerald-300/20">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                Saved itinerary progress
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Completed days are stored safely and will not be regenerated.
                {workflowProgress.status === 'failed' && ' Retry generation to continue from the next day.'}
              </p>
            </div>
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700 dark:bg-emerald-300/10 dark:text-emerald-200">
              {workflowProgress.partialItinerary.length}/{workflowProgress.totalDays || '?'} days saved
            </span>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {workflowProgress.partialItinerary.map(day => (
              <article
                key={day.day}
                className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-300/10 dark:bg-emerald-300/[0.045]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-600 text-xs font-black text-white">
                    {day.day}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-slate-800 dark:text-slate-100">
                      Day {day.day} · {day.theme}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {day.scheduleCount || 0} stops · {day.mealCount || 0} meals
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {showInterview && !generating && (
        <PlanningInterview
          interview={interview}
          loading={interviewLoading}
          answers={answers}
          currentIndex={questionIndex}
          onAnswer={(key, value) => setAnswers(current => ({ ...current, [key]: value }))}
          onNext={handleInterviewNext}
          onBack={() => setQuestionIndex(index => Math.max(0, index - 1))}
          onSkip={() => setShowInterview(false)}
        />
      )}

      {!plan && !generating && !showInterview && (
        <div className="card mx-auto max-w-3xl space-y-6 py-8 text-center sm:py-10">
          <div className="text-5xl">🧭</div>
          <div><h2 className="text-lg font-semibold text-slate-800">Ready to build your detailed plan</h2><p className="mt-2 text-sm text-slate-500">Your answers will shape the route, pace, meals, costs, transport, and booking advice.</p></div>
          {generationPreferences}
          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <button onClick={() => beginInterview(true)} className="btn-secondary px-6">Change guided answers</button>
            <button onClick={handleGenerate} className="btn-primary px-8 py-3 text-base">
              {workflowProgress?.partialItinerary?.length
                ? workflowProgress.partialItinerary.length >= (workflowProgress.totalDays || Infinity)
                  ? 'Resume final repair'
                  : `Resume from day ${workflowProgress.partialItinerary.length + 1}`
                : 'Build trip foundation'}
            </button>
          </div>
        </div>
      )}

      {plan && !generating && !showInterview && (
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-bold text-slate-800">{plan.tripTitle}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{plan.summary}</p>
            <div className="my-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                {lazyPlan && !lazyIsFinalized ? 'Foundation-first day generation' : 'Timed day-wise plan'}
              </span>
              {plan.generationContext?.planningAnswers && <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">Personalized from your answers</span>}
              {plan.generationContext?.webResearchUsed && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Live web research used</span>}
            </div>
            {lazyPlan?.dataProviders?.length > 0 && (
              <div className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-300/10 dark:bg-emerald-300/[0.045]">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                  Travel intelligence used for this foundation
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {lazyPlan.dataProviders.map(provider => {
                    const active = provider.status === 'used';
                    return (
                      <span
                        key={provider.key}
                        title={provider.detail}
                        className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                          active
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-100'
                            : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'
                        }`}
                      >
                        {active ? '✓' : '–'} {provider.label}
                        {provider.mode === 'cache' || provider.mode === 'research-cache'
                          ? ' · cached'
                          : ''}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => beginInterview(false)} className="btn-primary text-xs">Refine with guided questions</button>
              {(!lazyPlan || lazyIsFinalized) && (
                <button onClick={handleOptimizeBudget} className="btn-secondary text-xs">Optimize Budget</button>
              )}
            </div>
          </div>

          <details className="card"><summary className="cursor-pointer text-sm font-semibold text-slate-800">Extra instructions and research settings</summary><div className="mt-4">{generationPreferences}<button onClick={handleGenerate} className="btn-primary mt-4">Regenerate with these settings</button></div></details>

          {(!lazyPlan || lazyIsFinalized) && (
            <div><h3 className="mb-2 font-semibold text-slate-700">Quick transformations</h3><div className="flex flex-wrap gap-2">{transformations.map(item => <button key={item.id} onClick={() => handleTransform(item.id)} className="btn-secondary text-xs">{item.label}</button>)}</div></div>
          )}

          <TripScoreCard score={plan.tripScore} />

          {plan.budgetBreakdown && (
            <div className="card">
              <h3 className="mb-3 font-semibold text-slate-700">Budget Breakdown</h3>
              {plan.budgetSummary && (
                <div className={`mb-4 grid gap-3 rounded-xl border p-4 sm:grid-cols-3 ${
                  isOverBudget
                    ? 'border-red-200 bg-red-50/80 dark:border-red-300/20 dark:bg-red-400/10'
                    : 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-300/15 dark:bg-emerald-300/[0.07]'
                }`}>
                  <div>
                    <div className={`text-xs font-semibold uppercase tracking-wide ${isOverBudget ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>Expected spend</div>
                    <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white">{formatCurrency(plan.budgetSummary.expectedSpend, trip.currency)}</div>
                  </div>
                  <div>
                    <div className={`text-xs font-semibold uppercase tracking-wide ${isOverBudget ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                      {isOverBudget ? 'Additional budget needed' : hasRetainedSavings ? 'Unused savings' : 'Budget method'}
                    </div>
                    <div className="mt-1 text-lg font-bold text-slate-800 dark:text-white">
                      {isOverBudget
                        ? formatCurrency(plan.budgetSummary.shortfall, trip.currency)
                        : hasRetainedSavings
                          ? formatCurrency(plan.budgetSummary.savings, trip.currency)
                          : String(plan.budgetSummary.budgetMode || 'AI-managed').replaceAll('-', ' ')}
                    </div>
                  </div>
                  <div>
                    <div className={`text-xs font-semibold uppercase tracking-wide ${isOverBudget ? 'text-red-700 dark:text-red-300' : 'text-emerald-700 dark:text-emerald-300'}`}>Budget verdict</div>
                    <div className="mt-1 text-sm font-bold capitalize text-slate-800 dark:text-white">{String(budgetVerdict).replaceAll('-', ' ')}</div>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 min-[390px]:grid-cols-2 md:grid-cols-4">
                {Object.entries(plan.budgetBreakdown).filter(([, value]) => typeof value === 'number').map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-3 text-center"><div className="text-base font-bold text-slate-700">{formatCurrency(value, trip.currency)}</div><div className="mt-0.5 text-xs capitalize text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</div></div>)}
              </div>
            </div>
          )}

          {(plan.route?.length > 0 || plan.hotelSuggestions?.length > 0 || plan.transportStrategy?.length > 0) && (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="card">
                <h3 className="font-bold text-slate-800">Route and recommended bases</h3>
                {plan.route?.length > 0 && <div className="mt-3 flex flex-wrap items-center gap-2">{plan.route.map((stop, index) => <span key={`${stop}-${index}`} className="flex items-center gap-2 text-xs font-bold text-blue-700"><span className="rounded-full bg-blue-50 px-3 py-1.5">{stop}</span>{index < plan.route.length - 1 && <span className="text-slate-300">→</span>}</span>)}</div>}
                <div className="mt-4 space-y-2">
                  {plan.hotelSuggestions?.map((stay, index) => <div key={`${stay.area}-${index}`} className="rounded-xl border border-slate-200 p-3"><div className="flex items-start justify-between gap-3"><span className="text-sm font-bold text-slate-800">{stay.area}</span><span className="shrink-0 text-xs font-semibold text-emerald-700">{stay.estimatedPerNight}</span></div><p className="mt-1 text-xs leading-5 text-slate-500">{stay.reason}</p></div>)}
                </div>
              </div>
              <div className="card">
                <h3 className="font-bold text-slate-800">Important transfers</h3>
                <div className="mt-3 space-y-2">
                  {plan.transportStrategy?.map((transfer, index) => <div key={`${transfer.from}-${transfer.to}-${index}`} className="rounded-xl border border-slate-200 p-3"><div className="text-sm font-bold text-slate-800">{transfer.from} → {transfer.to}</div><p className="mt-1 text-xs leading-5 text-slate-500">{transfer.recommendedMode} · {transfer.typicalDuration} · {transfer.costGuidance}</p>{transfer.bookingAdvice && <p className="mt-1 text-xs leading-5 text-amber-700">{transfer.bookingAdvice}</p>}</div>)}
                  {!plan.transportStrategy?.length && <p className="text-sm text-slate-500">Daily transfer guidance is included inside each itinerary day.</p>}
                </div>
              </div>
            </section>
          )}

          {(plan.warnings?.length > 0 || plan.weatherNotes?.length > 0) && (
            <div className="card">
              <h3 className="font-bold text-slate-800">Plan-critical notes</h3>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {plan.warnings?.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-extrabold uppercase tracking-wider text-amber-800">Verify or resolve</p><ul className="mt-2 space-y-1">{plan.warnings.map((warning, index) => <li key={index} className="text-xs leading-5 text-amber-700">• {warning}</li>)}</ul></div>}
                {plan.weatherNotes?.length > 0 && <div className="rounded-xl border border-sky-200 bg-sky-50 p-4"><p className="text-xs font-extrabold uppercase tracking-wider text-sky-800">Weather preparation</p><ul className="mt-2 space-y-1">{plan.weatherNotes.map((note, index) => <li key={index} className="text-xs leading-5 text-sky-700">• {note}</li>)}</ul></div>}
              </div>
            </div>
          )}

          <section>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">Detailed Daily Schedule</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {lazyPlan && !lazyIsFinalized
                    ? 'Open only the days you need. Completed days stay cached and are not regenerated.'
                    : 'Expand a day, view its place photos, mark activities complete, or regenerate only that day.'}
                </p>
              </div>
              {lazyPlan && (
                <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-extrabold text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-200">
                  {lazyPlan.completedDays}/{lazyPlan.totalDays} days ready
                </span>
              )}
            </div>
            <div className="space-y-4">
              {lazyPlan
                ? lazyPlan.days.map(record => {
                  if (record.detail) {
                    return (
                      <div key={record.day} className="space-y-2">
                        {record.status === 'needs_repair' && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/[0.08] dark:text-amber-100">
                            <p className="font-extrabold">Day {record.day} needs a targeted repair</p>
                            {record.validationIssues.slice(0, 3).map(issue => (
                              <p key={issue.message}>• {issue.message}</p>
                            ))}
                            <button
                              type="button"
                              className="btn-secondary mt-2 text-xs"
                              disabled={Boolean(activeDayNumber)}
                              onClick={() => handleLazyDay(record.day, true, record.validationIssues[0]?.message)}
                            >
                              {activeDayNumber === record.day ? 'Repairing…' : 'Repair this day'}
                            </button>
                          </div>
                        )}
                        <ItineraryDayCard
                          day={record.detail}
                          destination={trip.destination}
                          onRegenerate={handleRegenDay}
                          regenerating={activeDayNumber === record.day}
                          dayGallery={getDayGallery(record.detail)}
                          imagesLoading={placeGalleryLoading}
                        />
                      </div>
                    );
                  }
                  return (
                    <LazyDayPlaceholder
                      key={record.day}
                      record={record}
                      currency={trip.currency}
                      busy={activeDayNumber === record.day}
                      onGenerate={handleLazyDay}
                    />
                  );
                })
                : plan.dayWiseItinerary?.map(day => (
                  <ItineraryDayCard
                    key={day.day}
                    day={day}
                    destination={trip.destination}
                    onRegenerate={handleRegenDay}
                    regenerating={lazyPlan
                      ? activeDayNumber === day.day
                      : generating}
                    dayGallery={getDayGallery(day)}
                    imagesLoading={placeGalleryLoading}
                  />
                ))}
            </div>
          </section>

          {lazyPlan && !lazyIsFinalized && (
            <section className="card border-emerald-200/80 dark:border-emerald-300/15">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-extrabold text-slate-900 dark:text-white">
                    Final itinerary validation
                  </h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                    Generate every day, then run duplicate, transfer, budget, continuity, and evidence checks.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-primary shrink-0"
                  disabled={!lazyPlan.canFinalize || finalizing || Boolean(activeDayNumber)}
                  onClick={handleFinalize}
                >
                  {finalizing
                    ? 'Validating…'
                    : lazyPlan.canFinalize
                      ? 'Finalize complete trip'
                      : `${lazyPlan.totalDays - lazyPlan.completedDays - lazyPlan.needsRepairDays} days remaining`}
                </button>
              </div>
              {lazyPlan.validationIssues?.length > 0 && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-300/20 dark:bg-amber-300/[0.08] dark:text-amber-100">
                  {lazyPlan.validationIssues.slice(0, 5).map(issue => (
                    <p key={`${issue.day}-${issue.message}`}>• {issue.message}</p>
                  ))}
                </div>
              )}
            </section>
          )}

          {plan.safetyTips?.length > 0 && <div className="card"><h3 className="mb-2 font-semibold text-slate-700">Safety Tips</h3><ul className="space-y-2">{plan.safetyTips.map((tip, index) => <li key={index} className="flex gap-2 text-sm leading-6 text-slate-600"><span>•</span>{tip}</li>)}</ul></div>}

          {plan.packingList?.length > 0 && <div className="card"><h3 className="mb-3 font-semibold text-slate-700">Packing List</h3><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">{plan.packingList.map((category, index) => <div key={index} className="rounded-xl bg-slate-50 p-3"><div className="mb-1 text-xs font-semibold uppercase text-slate-500">{category.category}</div><ul className="space-y-1">{category.items?.map((item, itemIndex) => <li key={itemIndex} className="text-sm text-slate-600">• {item}</li>)}</ul></div>)}</div></div>}

          {plan.researchSources?.length > 0 && <div className="card"><h3 className="font-semibold text-slate-700">Live Research Sources</h3><p className="mb-3 mt-1 text-xs leading-5 text-slate-500">Verify time-sensitive prices, schedules, and entry rules directly.</p><div className="space-y-2">{plan.researchSources.map((source, index) => <a key={`${source.url}-${index}`} href={source.url} target="_blank" rel="noreferrer" className="block rounded-xl border border-slate-200 p-3 transition hover:border-blue-300 hover:bg-blue-50/40"><span className="block text-sm font-semibold text-blue-700">{source.title || 'Research source'}</span>{source.note && <span className="mt-1 block text-xs leading-5 text-slate-500">{source.note}</span>}</a>)}</div></div>}

          {plan.criticNotes?.length > 0 && <div className="card border-amber-200 bg-amber-50 dark:border-amber-300/20 dark:bg-amber-300/[0.08]"><h3 className="mb-2 font-semibold text-amber-800 dark:text-amber-200">Plan Review Notes</h3>{plan.criticNotes.map((note, index) => <p key={index} className="text-sm leading-6 text-amber-700 dark:text-amber-100/80">• {note}</p>)}</div>}
        </div>
      )}
    </div>
  );
}
