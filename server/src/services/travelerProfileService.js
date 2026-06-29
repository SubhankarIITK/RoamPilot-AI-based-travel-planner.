const cleanText = (value, maxLength = 240) =>
  String(value || '').trim().slice(0, maxLength);

const cleanList = (value, maxItems = 12, itemLength = 120) =>
  (Array.isArray(value) ? value : [])
    .map(item => cleanText(item, itemLength))
    .filter(Boolean)
    .slice(0, maxItems);

const compactMemory = memory => ({
  likedPlaces: cleanList(memory?.likedPlaces, 6),
  dislikedPlaces: cleanList(memory?.dislikedPlaces, 6),
  preferredPace: cleanText(memory?.preferredPace, 40),
  preferredFood: cleanList(memory?.preferredFood, 6),
  budgetBehavior: cleanText(memory?.budgetBehavior, 180),
  notes: cleanText(memory?.notes, 160),
});

export const buildTravelerProfileSnapshot = ({
  trip,
  profile,
  memories = [],
  planningAnswers = {},
}) => {
  const answers = Object.fromEntries(
    Object.entries(planningAnswers || {})
      .slice(0, 12)
      .map(([key, value]) => [cleanText(key, 80), cleanText(value, 300)])
      .filter(([key, value]) => key && value),
  );
  const priorMemories = memories.slice(0, 5).map(compactMemory);

  return {
    budgetType: cleanText(profile?.budgetType, 40) || 'mid-range',
    foodPreference: cleanText(profile?.foodPreference, 120) || 'no-preference',
    hotelPreference: cleanText(profile?.hotelPreference, 120) || 'hotel',
    preferredTransport: cleanList(profile?.preferredTransport, 8),
    travelPace: cleanText(
      answers.daily_pace || profile?.travelPace || trip?.travelStyle,
      120,
    ) || 'balanced',
    interests: cleanList(profile?.interests, 12),
    medicalConstraints: cleanText(profile?.medicalConstraints, 240),
    accessibilityNeeds: cleanText(profile?.accessibilityNeeds, 240),
    dislikedThings: cleanList(profile?.dislikedThings, 12),
    preferredClimate: cleanText(profile?.preferredClimate, 80),
    adventureLevel: Math.min(10, Math.max(1, Number(profile?.adventureLevel) || 5)),
    nightlifePreference: cleanText(profile?.nightlifePreference, 80) || 'moderate',
    shoppingPreference: cleanText(profile?.shoppingPreference, 80) || 'moderate',
    languageComfort: cleanList(profile?.languageComfort, 8),
    travelExperienceLevel: cleanText(profile?.travelExperienceLevel, 40) || 'intermediate',
    family: {
      travelers: Math.max(1, Number(trip?.travelers) || 1),
      composition: cleanText(answers.family_composition, 160),
      childAges: cleanText(answers.child_ages, 120),
    },
    guidedAnswers: answers,
    priorMemories,
  };
};

export const compactTravelerProfileForPrompt = snapshot => ({
  budgetType: snapshot?.budgetType,
  foodPreference: snapshot?.foodPreference,
  hotelPreference: snapshot?.hotelPreference,
  preferredTransport: snapshot?.preferredTransport || [],
  travelPace: snapshot?.travelPace,
  interests: snapshot?.interests || [],
  medicalConstraints: snapshot?.medicalConstraints || '',
  accessibilityNeeds: snapshot?.accessibilityNeeds || '',
  dislikedThings: snapshot?.dislikedThings || [],
  preferredClimate: snapshot?.preferredClimate || '',
  adventureLevel: snapshot?.adventureLevel,
  nightlifePreference: snapshot?.nightlifePreference,
  shoppingPreference: snapshot?.shoppingPreference,
  languageComfort: snapshot?.languageComfort || [],
  travelExperienceLevel: snapshot?.travelExperienceLevel,
  family: snapshot?.family || {},
});
