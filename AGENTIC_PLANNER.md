# Agentic planner workflow

RoamPilot's itinerary generation is coordinated by
`server/src/agents/graph.js`. The workflow uses specialist model calls instead
of one large prompt:

1. A deterministic profile compiler merges the trip, guided answers, every
   saved profile constraint, and recent trip memories.
2. Intent Agent reports normalized duration, travelers, budget, and preferences
   without spending model tokens.
3. Research Agent optionally collects current transport, closure, seasonal,
   safety, and cost information. Matching user/trip research is reused for six
   hours.
4. Trip Strategy Agent assigns a geographic cluster and useful outcome to every
   day.
5. Budget & Logistics Agent establishes daily spending targets, stay areas,
   transfers, meals, safety, and weather constraints.
6. A deterministic budget engine reconciles arithmetic and derives expected
   spend, retained savings, emergency guidance, and budget fit.
7. Day Architect Agent generates bounded two-day batches by default.
8. Itinerary Critic Agent audits timing, geography, repetition, meals, budget,
   safety, and rest.
9. Itinerary Repair Agent rewrites at most two critic-selected days. It never
   regenerates an already-good full plan.
10. Final Planner Agent validates and merges the result.

## Token controls

- Strategy and logistics: at most 1,200 output tokens per call.
- Two-day batches: 3,600 output tokens normally, with one bounded compact retry.
- Critic: at most 900 output tokens.
- Repairs: at most 1,200 output tokens each, with no more than two repairs.
- Invalid specialist structures receive at most one bounded correction.
- Live research is concise and reused as reference context.
- Critic failure does not discard a structurally complete itinerary.
- Guided planning questions are deterministic and use no model tokens.
- Matching completed plans are returned from cache without charging AI credits.

The full agentic generation costs 18 RoamPilot credits.

## Live progress

The client creates a workflow ID before generation and polls:

```text
GET /api/ai/plan-progress/:workflowId
```

Progress is persisted in MongoDB for 24 hours and includes the real current
agent, completed stages, bounded model-stage count, repair decisions, and
failure details. It is not a simulated timer.
