import test from 'node:test';
import assert from 'node:assert/strict';
import { reportPlanningProviderUsage } from '../src/services/planningProgressService.js';

test('provider usage is rendered as explicit live, cache, and disabled workflow steps', async () => {
  const steps = [];
  const report = async step => steps.push(step);

  await reportPlanningProviderUsage(report, [
    {
      key: 'geoapify',
      label: 'Geoapify API',
      status: 'used',
      mode: 'live',
      detail: '12 named places supplied',
    },
    {
      key: 'open-meteo',
      label: 'Open-Meteo API',
      status: 'used',
      mode: 'cache',
      detail: '5 forecast days supplied',
    },
    {
      key: 'openrouteservice',
      label: 'OpenRouteService API',
      status: 'not-configured',
      mode: 'live',
      detail: 'No key configured',
    },
  ]);

  assert.equal(steps.length, 3);
  assert.equal(steps[0].key, 'api-geoapify');
  assert.equal(steps[0].status, 'completed');
  assert.equal(steps[0].message, 'Live API data used');
  assert.equal(steps[1].message, 'Reused cached API data');
  assert.equal(steps[2].status, 'skipped');
  assert.equal(steps[2].message, 'API key not configured');
});
