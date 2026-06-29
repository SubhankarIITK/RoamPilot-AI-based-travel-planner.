const LIVE_RESEARCH_PATTERNS = [
  /\b(today|tomorrow|right now|currently|current|latest|this week|this month)\b/i,
  /\b(weather|forecast|rain|temperature|air quality)\b/i,
  /\b(open now|closed|closure|opening hours|holiday hours)\b/i,
  /\b(availability|available rooms?|ticket availability|sold out)\b/i,
  /\b(live price|current price|fare|flight status|train status|delay|cancelled)\b/i,
  /\b(visa|permit|entry rule|travel advisory|strike|protest)\b/i,
];

export const needsLiveTravelResearch = message =>
  LIVE_RESEARCH_PATTERNS.some(pattern => pattern.test(String(message || '')));
