import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTravelerProfileSnapshot,
  compactTravelerProfileForPrompt,
} from '../src/services/travelerProfileService.js';

test('traveler snapshot preserves all planning-relevant profile constraints', () => {
  const snapshot = buildTravelerProfileSnapshot({
    trip: { travelers: 4, travelStyle: 'packed' },
    profile: {
      budgetType: 'luxury',
      foodPreference: 'vegetarian',
      hotelPreference: 'quiet boutique hotel',
      preferredTransport: ['metro', 'taxi'],
      travelPace: 'relaxed',
      interests: ['history', 'photography'],
      medicalConstraints: 'Peanut allergy',
      accessibilityNeeds: 'Avoid stairs',
      dislikedThings: ['nightclubs'],
      preferredClimate: 'cool',
      adventureLevel: 3,
      nightlifePreference: 'none',
      shoppingPreference: 'low',
      languageComfort: ['English', 'Hindi'],
      travelExperienceLevel: 'beginner',
    },
    planningAnswers: {
      daily_pace: 'Balanced with an afternoon rest',
      family_composition: 'Two adults and two children',
      child_ages: '6 and 10',
    },
    memories: [{
      likedPlaces: ['Victoria Memorial'],
      preferredFood: ['Bengali vegetarian'],
    }],
  });

  assert.equal(snapshot.travelPace, 'Balanced with an afternoon rest');
  assert.equal(snapshot.hotelPreference, 'quiet boutique hotel');
  assert.equal(snapshot.medicalConstraints, 'Peanut allergy');
  assert.equal(snapshot.accessibilityNeeds, 'Avoid stairs');
  assert.deepEqual(snapshot.preferredTransport, ['metro', 'taxi']);
  assert.equal(snapshot.family.composition, 'Two adults and two children');
  assert.equal(snapshot.priorMemories[0].likedPlaces[0], 'Victoria Memorial');

  const compact = compactTravelerProfileForPrompt(snapshot);
  assert.equal(compact.nightlifePreference, 'none');
  assert.equal(compact.shoppingPreference, 'low');
  assert.equal(compact.travelExperienceLevel, 'beginner');
});
