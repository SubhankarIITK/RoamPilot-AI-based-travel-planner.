# Agentic planner workflow

RoamPilot's itinerary generation is coordinated by
`server/src/agents/graph.js`. The workflow uses specialist model calls instead
of one large prompt:

1. Intent Agent normalizes duration, travelers, budget, and preferences without
   spending model tokens.
2. Research Agent optionally collects current transport, closure, seasonal,
   safety, and cost information.
3. Trip Strategy Agent assigns a geographic cluster and useful outcome to every
   day.
4. Budget & Logistics Agent establishes daily spending targets, stay areas,
   transfers, meals, safety, and weather constraints.
5. Day Architect Agent generates bounded two-day batches for trips up to 14
   days. Longer trips use three-day batches.
6. Itinerary Critic Agent audits timing, geography, repetition, meals, budget,
   safety, and rest.
7. Itinerary Repair Agent rewrites at most two critic-selected days. It never
   regenerates an already-good full plan.
8. Final Planner Agent validates and merges the result.

## Token controls

- Strategy and logistics: at most 2,400 output tokens each.
- Day batches: at most 4,000 output tokens per batch.
- Critic: at most 1,800 output tokens.
- Repairs: at most 2,800 output tokens each, with no more than two repairs.
- Invalid specialist structures receive at most one bounded correction.
- Live research is concise and reused as reference context.
- Critic failure does not discard a structurally complete itinerary.

The full agentic generation costs 18 RoamPilot credits.

## Live progress

The client creates a workflow ID before generation and polls:

```text
GET /api/ai/plan-progress/:workflowId
```

Progress is persisted in MongoDB for 24 hours and includes the real current
agent, completed stages, bounded model-stage count, repair decisions, and
failure details. It is not a simulated timer.
