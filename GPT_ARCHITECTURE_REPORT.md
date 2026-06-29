# RoamPilot Architecture and Reliability Handoff

Last reviewed: 2026-06-29

## Product and stack

RoamPilot is a full-stack AI travel planner.

```text
React + Vite client
  -> Axios API client + JWT from localStorage
  -> Express routes
  -> authentication and credit middleware
  -> controllers/services
  -> MongoDB (Mongoose)
  -> Groq, Stripe, and Cloudinary
```

- Client: React Router, Zustand stores, Tailwind, service worker/offline trips, voice input.
- Server: Node.js ESM, Express, Mongoose, JWT authentication.
- External systems: Groq for AI and web research, Stripe for billing, Cloudinary for documents.
- Core data: users, travel profiles, trips, planning runs/cache, chat messages, versions, memories, expenses, checklists, documents, shares, notifications, subscriptions, and credit transactions.
- Every private query is expected to include `userId`; Mongo uses the explicit `MONGO_DB_NAME`.

## Main AI architecture

`POST /api/ai/plan-trip` currently remains open while this workflow runs:

1. Load trip, profile, memories, and exact-input cache.
2. Optional Compound web research.
3. Strategy model: route and daily themes.
4. Logistics model: budget, hotels, transport, safety, and meals.
5. Day Architect: two-day itinerary batches.
6. Critic: audit the complete result.
7. Repair at most two selected days.
8. Normalize fields, save the trip/version/cache, and complete the progress run.

Progress is stored in `PlanningRun` and polled through
`GET /api/ai/plan-progress/:workflowId`. A matching plan is cached for 12 hours.
AI routes consume application credits and should refund them on failed actions.

Groq access is centralized in `server/src/services/groqService.js`. It currently
uses one `GROQ_API_KEY`, per-model in-memory queues, estimated token pacing,
rate-limit response headers, and bounded 429 retries. Scout is used for JSON
planning; Compound Mini is used for live web research.

## Two Groq API keys

Do **not** combine keys from two accounts to bypass minute limits. Groq limits
are organization-wide, so two keys in one organization share the same quota.
Groq's Acceptable Use Policy also prohibits registering multiple accounts or
orchestrating multiple organizations to exceed published limits.

Safe reliability options:

- Use one legitimate organization and upgrade its limits or use Groq's
  Performance/Flex tiers.
- Keep one secondary key only for credential rotation or incident recovery,
  not quota multiplication.
- Pace requests from the returned limit/reset headers.
- Reduce model calls, cache completed plans, and prevent duplicate workflows.
- If multiple server instances are deployed, use a shared Redis-backed limiter;
  the current in-memory limiter is insufficient.

References:

- https://console.groq.com/docs/rate-limits
- https://console.groq.com/docs/legal/ai-policy
- https://console.groq.com/docs/performance-tier
- https://console.groq.com/docs/flex-processing

## Main problems to address

### Critical reliability

1. Planning is a long synchronous HTTP request. Hosting/proxy timeouts can fail
   the request even while model work is valid. Move generation to a background
   job and return `202 + workflowId`.
2. Token queues and quotas are process-local. Restarts erase usage history and
   multiple instances can exceed the same organization limit.
3. There is no strong per-trip/idempotency lock. Double clicks or retries can
   launch duplicate plans, spend credits twice, and overwrite results.
4. One plan requires many dependent model calls:
   research + strategy + logistics + `ceil(days/2)` batches + critic + repairs.
   Each stage increases latency and failure probability.
5. AI plans use a Mongoose `Mixed` field. There is no authoritative persisted
   schema/version migration, so malformed or older plans can reach the UI.

### Functional and quality risks

1. Minor model field variations previously stopped complete plans. Local
   normalization now prevents this, but generated fallback travel times,
   transport, or meal areas are estimates and must be labeled as such.
2. Final quality warnings no longer block saving. This improves completion but
   can allow a structurally valid, weak itinerary.
3. `transformTrip` sends the complete plan back through one bounded model call;
   multi-day plans can truncate. Transform days in batches instead.
4. Chat uses Compound web search for every message, including requests that do
   not need current data. Route ordinary chat to Scout and search only when
   freshness is required.
5. A title such as “6-day trip” can disagree with inclusive date calculation
   returning seven itinerary days. Use one shared duration function in client
   and server.
6. Raw provider errors are stored/displayed in planning progress. Sanitize them
   into stable internal error codes and user-safe messages.

### Security and maintainability

1. No general API/IP rate limiter, request schema library, or Helmet middleware
   is visible. The global JSON body limit is 10 MB.
2. JWTs are stored in localStorage, increasing impact from an XSS bug; prefer
   secure HttpOnly cookies where practical.
3. `/api/health` only reports that Express is alive; it does not report Mongo,
   Groq configuration, queue state, or dependency readiness.
4. Credit debit, ledger creation, and refund are separate operations rather
   than one transaction. Audit crash/race behavior and refund idempotency.
5. Encoding artifacts such as `Â·` and `â†’` exist in server output/prompts.
6. `AGENTIC_PLANNER.md` has drifted from current batch sizes/token settings.
7. Tests are mainly unit tests; add integration tests for authentication,
   credits/refunds, duplicate plan requests, provider 429/413 handling,
   persistence, and one browser-level planning flow.

## Recommended simpler target

```text
POST /plan-trip with idempotency key
  -> create/reuse PlanningJob and return 202
  -> worker acquires trip lock
  -> optional one-time research
  -> one overview call (strategy + logistics)
  -> bounded day batches
  -> deterministic schema validation/normalization
  -> optional critic only when requested or quality score is low
  -> transactional save, cache, credit settlement
  -> UI polls or receives server-sent progress
```

Use a strict versioned plan schema, shared distributed rate limiter, per-stage
timeouts, one retry maximum, and a circuit breaker. A failed optional research
or critic stage should not destroy a structurally complete itinerary.

## Important files

- `server/src/agents/graph.js` — planning workflow and validation.
- `server/src/services/groqService.js` — Groq calls, pacing, retries.
- `server/src/controllers/aiController.js` — AI endpoints and persistence.
- `server/src/services/planningProgressService.js` — workflow progress.
- `server/src/middlewares/creditMiddleware.js` — charging/refunds.
- `server/src/models/Trip.js`, `PlanningRun.js`, `PlannerCache.js` — plan state.
- `client/src/pages/AIPlanner.jsx` — planning UI and progress polling.
- `client/src/api/aiApi.js` — AI HTTP calls.
- `client/src/store/tripStore.js` — active trip state.

