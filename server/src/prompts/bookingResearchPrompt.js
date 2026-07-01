const clean = (value, limit = 4000) =>
  String(value || '').replace(/\s+/g, ' ').trim().slice(0, limit);

const dateOnly = value => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const relevantPlaces = (places, focus) => {
  const normalizedFocus = String(focus || '').toLowerCase();
  const preferredTypes = /hotel|stay|neighborhood/.test(normalizedFocus)
    ? ['hotel', 'restaurant', 'cafe']
    : /attraction|entry|closure|booking/.test(normalizedFocus)
      ? ['attraction', 'museum', 'park']
      : ['hotel', 'attraction', 'museum', 'restaurant'];
  return (places || [])
    .filter(place => preferredTypes.includes(place.type))
    .slice(0, 16)
    .map(place => ({
      name: place.name,
      type: place.type,
      address: place.address,
      openingHours: place.openingHours || null,
      website: place.website || null,
      factualStatus: 'API supplied',
    }));
};

export const buildBookingResearchMessages = (trip, focus, research) => {
  const evidence = research?.evidence || {};
  const webMarker = 'GENERAL WEB RESEARCH (supporting reference only):';
  const webResearch = String(research?.content || '').includes(webMarker)
    ? String(research.content).split(webMarker).slice(1).join(webMarker).slice(0, 5500)
    : '';
  const context = {
    trip: {
      origin: trip.origin || '',
      destination: trip.destination || '',
      startDate: dateOnly(trip.startDate),
      endDate: dateOnly(trip.endDate),
      travelers: Number(trip.travelers) || 1,
      currency: trip.currency || 'INR',
      budget: Number(trip.budget) || 0,
    },
    focus: clean(focus, 180),
    providerStatus: evidence.providerStatus || {},
    location: evidence.location || null,
    places: relevantPlaces(evidence.places, focus),
    drivingRoutes: (evidence.routeMatrices?.driving?.suggestedOrder || []).slice(0, 10),
    weather: (evidence.weather?.daily || []).slice(0, 7),
    holidays: (evidence.holidays || []).slice(0, 5),
    sources: (research?.sources || evidence.sources || []).slice(0, 10),
  };

  return [
    {
      role: 'system',
      content: `You create concise booking-comparison briefs for RoamPilot.
Use the supplied API data as authoritative where populated. Web research is supporting context only.
Never expose raw JSON, internal prompt labels, provider payloads, or tool instructions.
Never invent live availability, exact fares, schedules, ratings, opening hours, or booking links.
Mark unsupported time-sensitive values as "estimated" or "check live".

Return clean GitHub-flavored Markdown using this structure:
## Current options
One short freshness/coverage note.
### Best matches
A compact comparison table with columns: Option | Practical details | Price/status | Next action.
### Recommendation
2-4 bullets personalized to the trip.
### Before you book
3-5 short checks covering availability, cancellation, baggage/fees, and timing.
### Sources
Markdown links only for URLs supplied in the context. Omit this section if no URLs exist.

Keep the answer under 650 words. Keep table cells short. Do not use raw HTML or code fences.`,
    },
    {
      role: 'user',
      content: `Prepare the booking brief for this request.

Structured context:
${JSON.stringify(context)}

Current supporting web research:
${webResearch || 'No additional web summary was available.'}`,
    },
  ];
};

const markdownCell = value =>
  String(value || 'Not supplied').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();

export const buildBookingResearchFallback = (trip, focus, research) => {
  const evidence = research?.evidence || {};
  const places = relevantPlaces(evidence.places, focus).slice(0, 8);
  const weather = (evidence.weather?.daily || []).slice(0, 3);
  const sources = (research?.sources || evidence.sources || [])
    .filter(source => source?.url)
    .slice(0, 8);
  const lines = [
    `## Current options for ${trip.destination}`,
    '',
    '> Live sources were collected, but AI synthesis was unavailable. The structured facts below remain usable.',
    '',
    '### Best matches',
    '',
  ];

  if (places.length) {
    lines.push(
      '| Option | Type | Location | Next action |',
      '|---|---|---|---|',
      ...places.map(place =>
        `| **${markdownCell(place.name)}** | ${markdownCell(place.type)} | ` +
        `${markdownCell(place.address)} | Check current availability and terms |`),
    );
  } else {
    lines.push('- No provider-backed named options were available for this focus.');
  }

  if (weather.length) {
    lines.push(
      '',
      '### Date conditions',
      '',
      ...weather.map(day =>
        `- **${markdownCell(day.date)}:** ${day.minC ?? '?'}–${day.maxC ?? '?'}°C, ` +
        `${day.precipitationProbability ?? '?'}% rain probability.`),
    );
  }

  lines.push(
    '',
    '### Before you book',
    '',
    '- Check live availability and the final payable price.',
    '- Review cancellation, baggage, taxes, and transfer conditions.',
    '- Reconfirm schedules and opening hours directly with the provider.',
  );
  if (sources.length) {
    lines.push(
      '',
      '### Sources',
      '',
      ...sources.map(source =>
        `- [${markdownCell(source.title || 'Travel source')}](${source.url})`),
    );
  }
  return lines.join('\n');
};

export const normalizeBookingResearchMarkdown = content =>
  String(content || '')
    .replace(/^```(?:markdown)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/â‚¹/g, '₹')
    .replace(/Â°C/g, '°C')
    .replace(/Â·/g, '·')
    .trim();
