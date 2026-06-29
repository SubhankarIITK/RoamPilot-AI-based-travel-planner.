import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPlanningInterview } from '../src/services/planningInterviewService.js';

test('planning interview is deterministic and reuses saved preferences', () => {
  const interview = buildPlanningInterview(
    { destination: 'Kolkata' },
    {
      travelPace: 'relaxed',
      foodPreference: 'vegetarian',
      hotelPreference: 'boutique hotel',
      accessibilityNeeds: 'avoid stairs',
    },
  );

  assert.equal(interview.questions.length, 6);
  assert.match(interview.questions[1].question, /Kolkata/);
  assert.ok(interview.questions[0].options.includes('Use saved preference: relaxed'));
  assert.ok(interview.questions[2].options.includes('Use saved preference: vegetarian'));
  assert.ok(interview.questions[3].options.includes('Respect saved need: avoid stairs'));
  assert.equal(interview.questions[5].type, 'text');
});
