const clean = (value, maxLength = 120) =>
  String(value || '').trim().slice(0, maxLength);

const uniqueOptions = options =>
  [...new Set(options.map(option => clean(option)).filter(Boolean))].slice(0, 5);

export const buildPlanningInterview = (trip, profile = null) => {
  const destination = clean(trip?.destination, 100) || 'your destination';
  const savedPace = clean(profile?.travelPace, 40);
  const savedFood = clean(profile?.foodPreference, 80);
  const savedHotel = clean(profile?.hotelPreference, 80);
  const accessibility = clean(
    profile?.accessibilityNeeds || profile?.medicalConstraints,
    100,
  );

  return {
    intro: 'These choices set the pace, route, meals, stay area, and hard constraints before planning.',
    questions: [
      {
        id: 'budget_approach',
        question: 'Do you have a fixed budget, or should RoamPilot estimate one?',
        reason: 'A fixed amount is treated as a hard limit; otherwise RoamPilot estimates realistic required spend.',
        type: 'single_choice',
        options: [
          'Let RoamPilot estimate it',
          'I have a fixed hard budget',
        ],
        required: true,
      },
      {
        id: 'comfort_level',
        question: 'What comfort level do you prefer?',
        reason: 'This sets realistic stay, food, transport, and activity price ranges.',
        type: 'single_choice',
        options: [
          'Budget',
          'Balanced',
          'Premium',
          'Luxury',
        ],
        required: true,
      },
      {
        id: 'optimization_goal',
        question: 'What should the planner optimize for?',
        reason: 'This decides whether savings, value, or experience quality wins when choices conflict.',
        type: 'single_choice',
        options: [
          'Cheapest',
          'Best value',
          'Best experience',
        ],
        required: true,
      },
      {
        id: 'daily_pace',
        question: 'How full should each day feel?',
        reason: 'This controls activity count, transfer buffers, and rest time.',
        type: 'single_choice',
        options: uniqueOptions([
          savedPace && `Use saved preference: ${savedPace}`,
          'Relaxed: 2-3 main stops',
          'Balanced: 4-5 stops',
          'Packed: see as much as possible',
        ]),
        required: true,
      },
      {
        id: 'top_priority',
        question: `What matters most during this ${destination} trip?`,
        reason: 'The highest-priority experiences receive the best days and time slots.',
        type: 'single_choice',
        options: [
          'Famous highlights',
          'Local culture and history',
          'Food experiences',
          'Nature and views',
          'Hidden gems',
        ],
        required: true,
      },
      {
        id: 'food_style',
        question: 'What food plan should the itinerary follow?',
        reason: 'This sets restaurant type, dietary fit, meal timing, and food budget.',
        type: 'single_choice',
        options: uniqueOptions([
          savedFood && `Use saved preference: ${savedFood}`,
          'Local and authentic',
          'Vegetarian-friendly',
          'Mix of local and familiar',
          'Budget-friendly',
        ]),
        required: true,
      },
      {
        id: 'mobility',
        question: 'What walking and transport level is comfortable?',
        reason: 'This prevents tiring routes and unrealistic transfers.',
        type: 'single_choice',
        options: uniqueOptions([
          accessibility && `Respect saved need: ${accessibility}`,
          'Minimal walking',
          'Moderate walking',
          'Walking is fine',
          'Prefer taxis or private car',
        ]),
        required: true,
      },
      {
        id: 'accommodation',
        question: 'What kind of stay and base area do you prefer?',
        reason: 'The stay location determines daily route efficiency and transport cost.',
        type: 'single_choice',
        options: uniqueOptions([
          savedHotel && `Use saved preference: ${savedHotel}`,
          'Central and convenient',
          'Quiet residential area',
          'Budget transport hub',
          'Premium area near major sights',
        ]),
        required: true,
      },
      {
        id: 'special_requirements',
        question: 'List fixed bookings, celebrations, child needs, accessibility needs, or non-negotiable requests.',
        reason: 'Hard constraints must be placed before the schedule is built.',
        type: 'text',
        options: [],
        required: false,
      },
    ],
  };
};
