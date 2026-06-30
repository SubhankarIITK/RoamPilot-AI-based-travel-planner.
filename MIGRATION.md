# RoamPilot Phase 1 Migration

## What changed

- Added persistent `PlanningJob` records for job status, checkpoints, attempts, errors, and credit reservation state.
- Added `Trip.aiPlanV2` while retaining the existing `Trip.aiPlan` field.
- Added lazy v1-to-v2 plan migration on `GET /api/trips/:id`.
- New and modified plans are written to both `aiPlan` and `aiPlanV2`; `planVersion` is set to `2`.
- AI credits now use a reservation lifecycle: reserve before work, charge after a successful response, or refund after a failed response.
- Split AI HTTP handlers into plan and chat controllers.
- Split the planner workflow into intent, research, foundation, day, critic, and repair stages.
- Limited the model critic to qualitative review; deterministic validation still handles structure and arithmetic.
- Added a day-prompt context budget guard to prevent oversized foundation context.

No route paths or client response shapes changed.

## Lazy `aiPlan` to `aiPlanV2` migration

Existing trip documents do not require a bulk database migration. When a trip is read through
`GET /api/trips/:id`, the server checks whether `aiPlanV2` is empty while `aiPlan` exists. It then:

1. Copies all existing plan fields.
2. Adds `schemaVersion: 2`.
3. Adds `generatedAt` when it is missing.
4. Copies `generationContext.workflowVersion`, or defaults it to `7`.
5. Saves the result to `aiPlanV2` and sets `planVersion` to `2`.

The response continues to include both `aiPlan` and `aiPlanV2`.

## Verification

Request an existing planned trip:

```http
GET /api/trips/:id
```

Then inspect the trip document in MongoDB. A migrated document has:

```js
{
  planVersion: 2,
  aiPlan: { /* original plan remains */ },
  aiPlanV2: {
    schemaVersion: 2,
    generatedAt: "ISO timestamp",
    workflowVersion: 7
  }
}
```

## Rollback

For a trip-level data rollback, set:

```js
{
  planVersion: 1,
  aiPlanV2: null
}
```

The application can continue using the retained `aiPlan` field. While Phase 1 lazy migration code
is deployed, reading that trip again will recreate `aiPlanV2`; disable or revert the lazy migration
code first if the rollback must remain permanent.
