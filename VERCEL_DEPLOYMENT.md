# RoamPilot Vercel Deployment

RoamPilot is a monorepo. Deploy it as two Vercel projects from the same Git
repository:

1. `server` — Express API
2. `client` — Vite SPA

Do not commit either `.env` file. Add all values through each Vercel project's
Settings → Environment Variables page.

## 1. Deploy the API first

Import the repository into Vercel and set **Root Directory** to `server`.
Vercel detects `src/server.js` as the Express entry point. Keep Fluid Compute
enabled and Node.js `22.x`.

Add these required production variables:

```text
NODE_ENV=production
MONGO_URI=...
MONGO_DB_NAME=roampilot
JWT_SECRET=...
JWT_EXPIRES_IN=7d
OTP_SECRET=...
CLIENT_URL=https://YOUR-CLIENT-PROJECT.vercel.app
COOKIE_SAME_SITE=lax
GROQ_API_KEY=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=RoamPilot <...>
```

Copy the remaining enabled-service variables from `server/.env.example`:
Tavily, Geoapify, OpenRouteService, Pexels, Cloudinary, Razorpay, rate limits,
credits, and cache settings.

MongoDB Atlas must allow connections from Vercel. Prefer the Atlas/Vercel
integration. If using Atlas Network Access manually, use a restricted database
user with a strong password and configure network access appropriate for
serverless outbound addresses.

After deployment, verify:

```text
https://YOUR-API-PROJECT.vercel.app/api/health
```

Expected response:

```json
{"status":"ok","app":"RoamPilot"}
```

## 2. Deploy the client

Import the same repository again and set **Root Directory** to `client`.
Vercel detects Vite and uses `client/vercel.json` for SPA deep links.

`client/vercel.json` proxies browser requests under `/api` to the deployed API
project, keeping the authentication cookie first-party. If the API project URL
changes, update the rewrite destination in that file before deploying.

Deploy, then replace the API project's `CLIENT_URL` with the final client URL
and redeploy the API. `CLIENT_URL` accepts comma-separated exact origins if
more than one trusted frontend is required.

## 3. Configure external services

- Razorpay webhook:
  `https://YOUR-API-PROJECT.vercel.app/api/billing/razorpay/webhook`
- Add the production client URL to any OAuth/payment allowlists.
- Confirm SMTP permits sign-in from the deployed environment.
- Test signup OTP, login, logout, password reset, document upload, payments,
  planner generation, and planner resume.

## Planner duration limitation

Vercel Functions have plan-dependent request duration limits. RoamPilot
requests a 300-second maximum and checkpoints completed itinerary batches well
before that boundary. Long plans may require pressing **Resume**; completed
days are not regenerated.

For uninterrupted 15–20 day generation in one run, keep the Vercel frontend
but deploy the Express server and a background worker on an always-on host or
move planning execution to a durable job queue. A request-bound Hobby function
cannot guarantee a single uninterrupted long planner run.
