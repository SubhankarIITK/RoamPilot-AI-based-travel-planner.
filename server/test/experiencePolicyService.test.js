import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDestinationCoveragePlan,
  createExperiencePolicy,
} from '../src/services/experiencePolicyService.js';

test('relaxed mode preserves destination coverage while reducing daily density', () => {
  const policy = createExperiencePolicy({
    travelStyle: 'relaxed',
    planningMode: 'Slow Travel + Photography',
  }, {
    top_priority: 'Nature and views',
    daily_pace: 'Relaxed: 2-3 main stops',
  }, 3);

  assert.equal(policy.pace, 'relaxed');
  assert.equal(policy.mainExperiencesPerFullDay, 2);
  assert.equal(policy.minimumMajorPlaces, 6);
  assert.ok(policy.experienceTypes.includes('signature highlights'));
  assert.ok(policy.experienceTypes.includes('nature'));
  assert.match(policy.hotelRule, /logistics only/i);
});

test('coverage prioritizes must-visits and attractions instead of hotels', () => {
  const foundation = {
    strategy: {
      dayThemes: [
        { day: 1, theme: 'Ghatshila nature', primaryArea: 'Ghatshila' },
        { day: 2, theme: 'Lakes and waterfalls', primaryArea: 'Ghatshila' },
      ],
      destinationHighlights: [{
        name: 'Phuldungri Hill',
        zone: 'Ghatshila',
        category: 'viewpoint',
        priority: 'essential',
        source: 'web research',
      }],
    },
  };
  const plan = buildDestinationCoveragePlan({
    trip: {
      planningMode: 'Slow Travel',
      travelStyle: 'relaxed',
      mustVisitPlaces: ['Burudi Lake'],
      avoidList: [],
    },
    foundation,
    planningAnswers: { top_priority: 'Nature and views' },
    factualEvidence: {
      places: [
        {
          name: 'Dharagiri Falls',
          type: 'nature',
          address: 'Ghatshila',
          placeId: 'falls',
          categories: ['natural.water'],
        },
        {
          name: 'Ghatshila Tourist Resort',
          type: 'hotel',
          address: 'Ghatshila',
          placeId: 'hotel',
          categories: ['accommodation.hotel'],
        },
        {
          name: 'Rankini Temple',
          type: 'heritage',
          address: 'Ghatshila',
          placeId: 'temple',
          categories: ['religion'],
        },
      ],
    },
  });

  assert.equal(plan.selectedPlaces[0].name, 'Burudi Lake');
  assert.ok(plan.selectedPlaces.some(place => place.name === 'Dharagiri Falls'));
  assert.ok(plan.selectedPlaces.some(place => place.name === 'Phuldungri Hill'));
  assert.ok(!plan.selectedPlaces.some(place => place.name === 'Ghatshila Tourist Resort'));
  assert.equal(
    [...plan.dayAssignments.values()].flat().length,
    plan.selectedPlaces.length,
  );
  assert.ok(
    Math.max(...[...plan.dayAssignments.values()].map(places => places.length)) <= 2,
  );
});

test('foundation anchor-place assignments are preserved across relaxed days', () => {
  const plan = buildDestinationCoveragePlan({
    trip: {
      planningMode: 'Slow Travel + Photography',
      travelStyle: 'relaxed',
      mustVisitPlaces: [],
      avoidList: [],
    },
    planningAnswers: { top_priority: 'Nature and views' },
    factualEvidence: { places: [] },
    foundation: {
      strategy: {
        dayThemes: [
          {
            day: 1,
            theme: 'Nature and Photography',
            primaryArea: 'Ghatshila',
            anchorPlaces: ['Burudih Lake', 'Phuldungri Hill'],
          },
          {
            day: 2,
            theme: 'Heritage and Culture',
            primaryArea: 'Ghatshila',
            anchorPlaces: ['Rankini Temple', 'Gouri Kunj'],
          },
          {
            day: 3,
            theme: 'Nature and Views',
            primaryArea: 'Ghatshila',
            anchorPlaces: ['Dharagiri Waterfall', 'Galudih Barrage'],
          },
        ],
        destinationHighlights: [
          'Burudih Lake',
          'Dharagiri Waterfall',
          'Phuldungri Hill',
          'Rankini Temple',
          'Gouri Kunj',
          'Galudih Barrage',
        ].map(name => ({
          name,
          zone: 'Ghatshila',
          category: /Temple|Kunj/.test(name) ? 'culture and heritage' : 'nature',
          priority: 'essential',
          source: 'web research',
        })),
      },
    },
  });

  assert.deepEqual(
    plan.dayAssignments.get(1).map(place => place.name).sort(),
    ['Burudih Lake', 'Phuldungri Hill'],
  );
  assert.deepEqual(
    plan.dayAssignments.get(2).map(place => place.name).sort(),
    ['Gouri Kunj', 'Rankini Temple'],
  );
  assert.deepEqual(
    plan.dayAssignments.get(3).map(place => place.name).sort(),
    ['Dharagiri Waterfall', 'Galudih Barrage'],
  );
});
