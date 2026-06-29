const conditions = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Light Rain', 'Clear'];

export const getMockWeather = (destination, days = 5) => {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    condition: conditions[Math.floor(Math.random() * conditions.length)],
    temperature: { min: 20 + Math.floor(Math.random() * 5), max: 28 + Math.floor(Math.random() * 7) },
    rainChance: Math.floor(Math.random() * 60),
    notes: `Typical weather for ${destination}`,
  }));
};