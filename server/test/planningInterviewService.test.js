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

  assert.equal(interview.questions.length, 9);
  assert.match(interview.questions[0].question, /fixed budget/i);
  assert.match(interview.questions[1].question, /comfort level/i);
  assert.match(interview.questions[2].question, /optimize/i);
  assert.match(interview.questions[4].question, /Kolkata/);
  assert.ok(interview.questions[3].options.includes('Use saved preference: relaxed'));
  assert.ok(interview.questions[5].options.includes('Use saved preference: vegetarian'));
  assert.ok(interview.questions[6].options.includes('Respect saved need: avoid stairs'));
  assert.equal(interview.questions[8].type, 'text');
});
