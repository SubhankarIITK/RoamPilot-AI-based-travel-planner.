import { Link } from 'react-router-dom';

const productFeatures = [
  {
    icon: '✦',
    title: 'AI itinerary architect',
    description: 'Detailed daily routes shaped around your pace, priorities, dates, and real budget.',
  },
  {
    icon: '⌁',
    title: 'Live travel intelligence',
    description: 'Research transport, stays, closures, seasonal conditions, and booking requirements.',
  },
  {
    icon: '▣',
    title: 'One organized workspace',
    description: 'Keep budgets, documents, packing, safety information, and trip changes together.',
  },
  {
    icon: '↗',
    title: 'Book and compare',
    description: 'Move from your plan to trusted flight, hotel, train, and bus providers.',
  },
  {
    icon: '↓',
    title: 'Ready when offline',
    description: 'Save essential plans and emergency information before leaving connectivity behind.',
  },
  {
    icon: '◇',
    title: 'Learns how you travel',
    description: 'Carry your food, pace, comfort, and budget preferences into future journeys.',
  },
];

const pricingPlans = [
  { name: 'Explorer', price: '₹499', credits: '100 credits', description: 'Occasional trips and focused AI planning.' },
  { name: 'Navigator', price: '₹999', credits: '300 credits', description: 'Frequent travel, refinements, and comparisons.', recommended: true },
  { name: 'Voyager', price: '₹1,999', credits: '800 credits', description: 'High-volume planning for travel professionals.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#03120f] text-white">
      <section className="relative isolate min-h-[900px] overflow-hidden lg:min-h-screen">
        <img
          src="/jungle.png"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          className="absolute inset-0 -z-30 h-full w-full object-cover object-[62%_center] scale-[1.015]"
        />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(2,12,13,.97)_0%,rgba(3,20,19,.86)_38%,rgba(3,18,15,.38)_70%,rgba(2,10,9,.26)_100%)]" />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(180deg,rgba(2,10,12,.72)_0%,transparent_24%,transparent_65%,#03120f_100%)]" />
        <div className="absolute inset-0 -z-10 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.12)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_right,black,transparent_72%)]" />

        <nav className="relative z-20 border-b border-white/10 bg-[#02110e]/35 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
            <Link to="/" className="flex items-center gap-3" aria-label="RoamPilot home">
              <span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200 shadow-[0_8px_28px_rgba(16,185,129,.16)]">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.8 9.2-1.9 3.7-3.7 1.9 1.9-3.7 3.7-1.9Z" />
                </svg>
              </span>
              <span>
                <span className="block text-base font-extrabold tracking-tight">RoamPilot</span>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200/55">Travel intelligence</span>
              </span>
            </Link>

            <div className="flex items-center gap-2">
              <a href="#pricing" className="hidden rounded-xl px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[0.07] hover:text-white sm:block">
                Pricing
              </a>
              <Link to="/login" className="rounded-xl px-4 py-2 text-sm font-semibold text-white/75 transition hover:bg-white/[0.07] hover:text-white">
                Sign in
              </Link>
              <Link to="/signup" className="rounded-xl border border-emerald-200/70 bg-gradient-to-r from-emerald-300 to-lime-300 px-4 py-2 text-sm font-extrabold text-emerald-950 shadow-[0_10px_30px_rgba(16,185,129,.2)] transition hover:-translate-y-0.5 hover:from-emerald-200 hover:to-lime-200 hover:shadow-[0_14px_34px_rgba(16,185,129,.28)]">
                Create account
              </Link>
            </div>
          </div>
        </nav>

        <div className="relative z-10 mx-auto grid min-h-[calc(100vh-73px)] max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.85fr] lg:py-20">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3.5 py-1.5 text-xs font-bold text-emerald-100 backdrop-blur-md">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-300 shadow-[0_0_14px_rgba(190,242,100,.9)]" />
              Intelligent planning for remarkable journeys
            </div>

            <h1 className="text-balance text-5xl font-black leading-[1.02] tracking-[-0.045em] text-white sm:text-6xl lg:text-7xl">
              The world is wild.
              <span className="mt-1 block bg-gradient-to-r from-emerald-200 via-lime-200 to-amber-200 bg-clip-text text-transparent">
                Your plan shouldn&apos;t be.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-slate-200/80 sm:text-lg">
              Describe the journey you want. RoamPilot researches the details, asks the right
              questions, and turns your ideas into a realistic plan you can actually use.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-gradient-to-r from-emerald-400 to-lime-300 px-6 font-extrabold text-emerald-950 shadow-[0_15px_36px_rgba(52,211,153,.2)] transition hover:-translate-y-0.5 hover:from-emerald-300 hover:to-lime-200">
                Create your account <span className="ml-2">→</span>
              </Link>
              <Link to="/login" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/15 bg-black/15 px-6 font-semibold text-white/85 backdrop-blur-md transition hover:border-emerald-200/30 hover:bg-white/10 hover:text-white">
                Open your workspace
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300/70">
              {['Day-by-day detail', 'Current web research', 'Private by default'].map(item => (
                <span key={item} className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-300/15 text-[10px] font-bold text-emerald-200">✓</span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto hidden w-full max-w-lg lg:block">
            <div className="absolute -inset-12 rounded-full bg-lime-200/10 blur-3xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#061815]/70 p-3 shadow-[0_36px_100px_rgba(0,0,0,.45)] backdrop-blur-2xl">
              <div className="rounded-[1.35rem] border border-white/[0.08] bg-[#081b18]/90 p-5">
                <div className="flex items-start justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Upcoming expedition</p>
                    <h2 className="mt-1 text-xl font-extrabold">Amazon Forest</h2>
                    <p className="mt-1 text-xs text-slate-400">Manaus · Rainforest lodge · Rio Negro</p>
                  </div>
                  <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200 ring-1 ring-emerald-300/15">Ready</span>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[['07', 'Days'], ['₹1.2L', 'Budget'], ['9.1', 'Trip score']].map(([value, label]) => (
                    <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.045] p-3 text-center">
                      <div className="font-extrabold text-white">{value}</div>
                      <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2">
                  {[
                    ['1', 'Arrival and riverfront', 'Manaus · local dinner'],
                    ['2', 'Into the rainforest', 'Lodge transfer · canopy walk'],
                    ['3', 'Wildlife and waterways', 'Dawn safari · Rio Negro'],
                  ].map(([day, title, detail]) => (
                    <div key={day} className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-black/10 p-3">
                      <span className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-300/10 text-xs font-extrabold text-emerald-200">{day}</span>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-slate-100">{title}</div>
                        <div className="truncate text-xs text-slate-500">{detail}</div>
                      </div>
                      <span className="ml-auto text-xs text-emerald-300/60">→</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3 rounded-xl border border-lime-200/10 bg-gradient-to-r from-emerald-300/10 to-lime-200/[0.06] p-3 text-xs leading-5 text-emerald-100/80">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-300 text-sm font-black text-emerald-950">✦</span>
                  Personalized around your pace, comfort, wildlife interests, and budget.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="relative bg-[#03120f]">
        <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_25%_10%,rgba(52,211,153,.18),transparent_28rem),radial-gradient(circle_at_85%_70%,rgba(190,242,100,.09),transparent_24rem)]" />
        <section className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="grid gap-8 lg:grid-cols-[.75fr_1.25fr] lg:gap-16">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-300">One complete travel OS</p>
              <h2 className="mt-4 text-balance text-4xl font-black tracking-[-0.035em] text-white">Everything between the idea and the journey.</h2>
              <p className="mt-4 max-w-xl text-sm leading-7 text-slate-400">
                RoamPilot replaces scattered notes, generic AI answers, and disconnected booking tabs with one focused workspace.
              </p>
              <Link to="/signup" className="mt-7 inline-flex items-center gap-2 text-sm font-bold text-emerald-200 transition hover:text-lime-200">
                Build your workspace <span>→</span>
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {productFeatures.map(feature => (
                <article key={feature.title} className="group rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/20 hover:bg-emerald-300/[0.055]">
                  <span className="grid h-10 w-10 place-items-center rounded-xl border border-emerald-300/10 bg-emerald-300/[0.07] font-bold text-emerald-200 transition group-hover:bg-emerald-300/10">{feature.icon}</span>
                  <h3 className="mt-4 font-bold text-slate-100">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{feature.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="relative border-t border-white/[0.07]">
          <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-emerald-300">Simple monthly pricing</p>
              <h2 className="mt-4 text-4xl font-black tracking-[-0.035em] text-white">Pay for the AI capacity you use.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-400">Every account gets a small weekly allowance to try the AI tools. Subscribe for larger monthly credit balances; failed AI requests are refunded automatically.</p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {pricingPlans.map(plan => (
                <article key={plan.name} className={`relative rounded-3xl border p-6 ${plan.recommended ? 'border-emerald-300/40 bg-emerald-300/[0.08] shadow-[0_20px_60px_rgba(16,185,129,.1)]' : 'border-white/[0.09] bg-white/[0.035]'}`}>
                  {plan.recommended && <span className="absolute -top-3 left-6 rounded-full bg-emerald-300 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-950">Most popular</span>}
                  <h3 className="text-lg font-extrabold text-white">{plan.name}</h3>
                  <p className="mt-2 min-h-10 text-sm leading-5 text-slate-400">{plan.description}</p>
                  <div className="mt-5"><span className="text-3xl font-black text-white">{plan.price}</span><span className="text-sm text-slate-500"> / month</span></div>
                  <p className="mt-2 text-sm font-bold text-emerald-200">{plan.credits} monthly</p>
                  <ul className="my-6 space-y-3 text-sm text-slate-300">
                    {['Weekly free credits included', 'AI itinerary generation', 'AI trip chat and refinements', 'Secure Razorpay payments'].map(feature => (
                      <li key={feature} className="flex gap-2"><span className="text-emerald-300">✓</span>{feature}</li>
                    ))}
                  </ul>
                  <Link to="/signup" className={`inline-flex min-h-11 w-full items-center justify-center rounded-xl px-5 text-sm font-extrabold transition ${plan.recommended ? 'bg-emerald-300 text-emerald-950 hover:bg-emerald-200' : 'border border-white/15 bg-white/[0.06] text-white hover:bg-white/10'}`}>
                    Create account
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="relative border-t border-white/[0.07]">
          <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-5 py-14 sm:px-8 md:flex-row md:items-center">
            <div>
              <p className="text-sm font-bold text-emerald-200">Your next journey starts with one sentence.</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-white">Tell RoamPilot where you want to go.</p>
            </div>
            <Link to="/signup" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-white px-6 font-extrabold text-emerald-950 transition hover:-translate-y-0.5 hover:bg-emerald-50">
              View plans and start
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
