const safeJsonParse = (text) => {
  if (typeof text !== 'string') return null;

  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed);
  } catch {}

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {}
  }

  const possibleStarts = [trimmed.indexOf('{'), trimmed.indexOf('[')]
    .filter(index => index >= 0);
  const start = possibleStarts.length ? Math.min(...possibleStarts) : -1;
  if (start < 0) return null;

  const opening = trimmed[start];
  const closing = opening === '{' ? '}' : ']';
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < trimmed.length; index += 1) {
    const char = trimmed[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === opening) {
      depth += 1;
    } else if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(trimmed.slice(start, index + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
};

export default safeJsonParse;
