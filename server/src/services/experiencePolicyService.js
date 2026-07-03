const normalize = value =>
  String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const MODE_EXPERIENCES = [
  {
    match: /hidden gems|backpacker/,
    experiences: ['signature highlights', 'hidden gems', 'local culture', 'local food'],
  },
  {
    match: /foodie|food/,
    experiences: ['signature highlights', 'local food', 'market experience', 'local culture'],
  },
  {
    match: /photography/,
    experiences: ['signature highlights', 'viewpoints', 'golden-hour photography', 'local culture'],
  },
  {
    match: /adventure/,
    experiences: ['signature highlights', 'nature', 'outdoor activity', 'viewpoints'],
  },
  {
    match: /spiritual|cultural/,
    experiences: ['signature highlights', 'heritage', 'spiritual place', 'local culture'],
  },
  {
    match: /family/,
    experiences: ['signature highlights', 'family experience', 'nature', 'local food'],
  },
  {
    match: /couple|romantic/,
    experiences: ['signature highlights', 'scenic experience', 'local food', 'sunset'],
  },
  {
    match: /slow travel/,
    experiences: ['signature highlights', 'nature', 'local culture', 'slow local experience'],
  },
];

const priorityExperience = value => {
  const text = normalize(value);
  if (/famous|highlight/.test(text)) return 'signature highlights';
  if (/culture|history/.test(text)) return 'local culture';
  if (/food/.test(text)) return 'local food';
  if (/nature|view/.test(text)) return 'nature';
  if (/hidden/.test(text)) return 'hidden gems';
  return '';
};

export const createExperiencePolicy = (
  trip,
  planningAnswers = {},
  totalDays = 1,
) => {
  const mode = normalize(trip?.planningMode);
  const paceAnswer = normalize(planningAnswers.daily_pace);
  const relaxed = trip?.travelStyle === 'relaxed' || /relaxed|slow/.test(paceAnswer);
  const packed = trip?.travelStyle === 'packed' || /packed|see as much/.test(paceAnswer);
  const mainExperiencesPerFullDay = relaxed ? 2 : packed ? 4 : 3;
  const selected = MODE_EXPERIENCES
    .filter(rule => rule.match.test(mode))
    .flatMap(rule => rule.experiences);
  const topPriority = priorityExperience(planningAnswers.top_priority);
  const experienceTypes = [...new Set([
    topPriority,
    ...selected,
    'signature highlights',
    relaxed ? 'slow local experience' : 'local culture',
    'local food',
  ].filter(Boolean))];
  const minimumMajorPlaces = Math.min(
    18,
    Math.max(3, Number(totalDays) * mainExperiencesPerFullDay),
  );
  return {
    pace: relaxed ? 'relaxed' : packed ? 'packed' : 'balanced',
    mainExperiencesPerFullDay,
    minimumMajorPlaces,
    experienceTypes,
    attractionRule: relaxed
      ? 'Plan 2 strong place visits plus one unhurried local experience; rest is a buffer, not the main activity.'
      : packed
        ? 'Cover 4 geographically clustered place visits with explicit transfer time.'
        : 'Cover 3 strong place visits with one local experience and practical breaks.',
    hotelRule:
      'Hotels are logistics only. Include check-in or check-out when necessary, never use hotel rest as a primary sightseeing experience.',
    coverageRule:
      'Cover destination-defining highlights first, then personalize with nature, culture, food, hidden gems, or activities selected by the traveler.',
  };
};

const placeCategory = place => {
  const text = normalize(`${place?.type} ${(place?.categories || []).join(' ')}`);
  if (/natural|park|garden|water|beach|mountain|forest|picnic/.test(text)) return 'nature';
  if (/museum|heritage|historic|religion|temple|monument|culture/.test(text)) {
    return 'culture and heritage';
  }
  return 'signature attraction';
};

const candidateScore = place => {
  const categories = normalize((place?.categories || []).join(' '));
  const importance = Number(place?.importance) || 0;
  let score = importance * 100;
  if (/tourism\.attraction|heritage|national_park/.test(categories)) score += 35;
  if (/museum|natural|leisure\.park|beach/.test(categories)) score += 25;
  if (place?.website) score += 5;
  const distance = Number(place?.distanceMeters);
  if (Number.isFinite(distance)) score += Math.max(0, 10 - distance / 5000);
  return score;
};

const isSupportPlace = place =>
  ['hotel', 'restaurant', 'cafe'].includes(String(place?.type || ''));

export const buildDestinationCoveragePlan = ({
  trip,
  foundation,
  factualEvidence,
  planningAnswers = {},
}) => {
  const themes = foundation?.strategy?.dayThemes || [];
  const policy = createExperiencePolicy(trip, planningAnswers, themes.length || 1);
  const avoid = (trip?.avoidList || []).map(normalize).filter(Boolean);
  const candidates = new Map();
  const addCandidate = candidate => {
    const name = String(candidate?.name || '').trim();
    const key = normalize(name);
    if (!key || avoid.some(blocked => key.includes(blocked) || blocked.includes(key))) return;
    const existing = candidates.get(key);
    if (!existing || Number(candidate.priorityScore) > Number(existing.priorityScore)) {
      candidates.set(key, candidate);
    }
  };

  (trip?.mustVisitPlaces || []).forEach(name => addCandidate({
    name,
    placeId: '',
    zone: '',
    category: 'user must-visit',
    source: 'user',
    priorityScore: 1000,
    required: true,
  }));
  (foundation?.strategy?.destinationHighlights || []).forEach((highlight, index) =>
    addCandidate({
      name: highlight.name,
      placeId: highlight.placeId || '',
      zone: highlight.zone || '',
      category: highlight.category || 'signature attraction',
      source: highlight.source || 'web research',
      priorityScore: 600 - index,
      required: highlight.priority === 'essential',
      whyVisit: highlight.whyVisit || '',
    }));
  (factualEvidence?.places || [])
    .filter(place => !isSupportPlace(place))
    .sort((left, right) => candidateScore(right) - candidateScore(left))
    .forEach((place, index) => addCandidate({
      name: place.name,
      placeId: place.placeId || '',
      zone: place.address || '',
      category: placeCategory(place),
      source: 'geoapify',
      priorityScore: 400 - index + candidateScore(place),
      required: false,
      whyVisit: '',
    }));

  const selected = [...candidates.values()]
    .sort((left, right) => Number(right.priorityScore) - Number(left.priorityScore))
    .slice(0, policy.minimumMajorPlaces);
  const assignments = new Map(themes.map(theme => [Number(theme.day), []]));
  const dayLoads = new Map(themes.map(theme => [Number(theme.day), 0]));
  selected.forEach((place, index) => {
    const placeZone = normalize(place.zone);
    const placeName = normalize(place.name);
    const explicitlyAssigned = themes.filter(theme =>
      (theme.anchorPlaces || []).some(anchor => {
        const key = normalize(anchor);
        return key && (key.includes(placeName) || placeName.includes(key));
      }));
    const scoredThemes = themes.map(theme => {
      const themeZone = normalize(
        `${theme.primaryArea} ${theme.theme} ${(theme.mustAccomplish || []).join(' ')} ` +
        `${(theme.experienceTypes || []).join(' ')}`,
      );
      let score = 0;
      if (
        placeName &&
        (themeZone.includes(placeName) || placeName.includes(themeZone))
      ) score += 8;
      if (
        placeZone &&
        themeZone &&
        (placeZone.includes(themeZone) || themeZone.includes(placeZone))
      ) score += 2;
      const category = normalize(place.category);
      if (/nature|view|water|hill|park/.test(category) &&
          /nature|view|photo|outdoor|lake|waterfall|hill/.test(themeZone)) score += 4;
      if (/culture|heritage|temple|market/.test(category) &&
          /culture|heritage|temple|history|market|local/.test(themeZone)) score += 4;
      return { theme, score };
    });
    const bestScore = Math.max(0, ...scoredThemes.map(item => item.score));
    const candidates = explicitlyAssigned.length
      ? explicitlyAssigned
      : scoredThemes.filter(item => item.score === bestScore).map(item => item.theme);
    const theme = [...candidates].sort((left, right) =>
      (dayLoads.get(Number(left.day)) || 0) - (dayLoads.get(Number(right.day)) || 0))[0]
      || themes[index % Math.max(1, themes.length)];
    if (!theme) return;
    const day = Number(theme.day);
    assignments.get(day).push({
      name: place.name,
      placeId: place.placeId,
      category: place.category,
      source: place.source,
      required: place.required,
      whyVisit: place.whyVisit,
    });
    dayLoads.set(day, (dayLoads.get(day) || 0) + 1);
  });

  return {
    policy,
    selectedPlaces: selected,
    dayAssignments: assignments,
  };
};
