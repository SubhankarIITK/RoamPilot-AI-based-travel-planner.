const isNonLatinLetter = character =>
  /\p{Letter}/u.test(character) && !/\p{Script=Latin}/u.test(character);

const cleanPunctuation = value =>
  value
    .replace(/[、。・「」『』【】（）［］]/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,;:])(?:\s*\1)+/g, '$1')
    .replace(/,\s*,+/g, ',')
    .replace(/\b(visit|explore|see|tour|discover|experience|walk through|stop at),\s+/i, '$1 ')
    .replace(/\b(at|in|to|from|near|inside|outside|around|through),\s+/gi, '$1 ')
    .replace(/^[\s,;:./-]+|[\s,;:./-]+$/g, '')
    .trim();

export const containsNonLatinScript = value =>
  [...String(value || '')].some(isNonLatinLetter);

export const englishDisplayText = (value, fallback = '') => {
  const source = String(value || '').trim();
  if (!source) return fallback;
  if (!containsNonLatinScript(source)) return source;

  const latinOnly = [...source]
    .map(character => isNonLatinLetter(character) ? ' ' : character)
    .join('');
  const cleaned = cleanPunctuation(latinOnly);
  return /[\p{Letter}\p{Number}]/u.test(cleaned) ? cleaned : fallback;
};
