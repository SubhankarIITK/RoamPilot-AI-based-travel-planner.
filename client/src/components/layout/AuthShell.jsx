import { Link } from 'react-router-dom';
import ThemeToggle from '../common/ThemeToggle.jsx';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[1.05fr_0.95fr]">
      <div className="relative hidden overflow-hidden bg-slate-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(59,130,246,0.32),transparent_30%),radial-gradient(circle_at_80%_80%,rgba(99,102,241,0.28),transparent_32%)]" />
        <Link to="/" className="relative z-10 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-xl ring-1 ring-white/20">
            ◇
          </span>
          <span className="text-xl font-extrabold tracking-tight">RoamPilot</span>
        </Link>

        <div className="relative z-10 max-w-xl">
          <div className="mb-5 inline-flex rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-semibold text-blue-200">
            AI-powered travel intelligence
          </div>
          <h2 className="text-balance text-4xl font-extrabold leading-tight tracking-tight">
            Plan less. Experience more.
          </h2>
          <p className="mt-4 max-w-lg text-base leading-7 text-slate-300">
            Build complete itineraries, manage budgets and documents, prepare for emergencies,
            and keep every trip detail in one calm workspace.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
            {[
              'Personalized itineraries',
              'Smart budget planning',
              'Offline trip access',
              'Secure document vault',
            ].map(item => (
              <div key={item} className="flex items-center gap-2 text-slate-200">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-400/15 text-xs text-emerald-300">✓</span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-500">Travel planning, organized properly.</p>
      </div>

      <div className="relative flex items-center justify-center bg-slate-50 px-4 py-10 sm:px-8">
        <ThemeToggle className="absolute right-5 top-5 z-20" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-blue-50 to-transparent lg:hidden" />
        <div className="relative w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center gap-2.5 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white">◇</span>
            <span className="text-xl font-extrabold tracking-tight text-slate-900">RoamPilot</span>
          </Link>
          <div className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,23,42,0.1)] sm:p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</p>
            </div>
            {children}
          </div>
          {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
        </div>
      </div>
    </div>
  );
}
