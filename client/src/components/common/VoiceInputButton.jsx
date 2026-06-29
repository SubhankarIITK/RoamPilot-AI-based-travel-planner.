import { useEffect, useRef, useState } from 'react';

const getRecognitionConstructor = () => {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

const joinTranscript = (base, spoken) => {
  const cleanBase = String(base || '').trimEnd();
  const cleanSpoken = String(spoken || '').trim();
  if (!cleanBase) return cleanSpoken;
  if (!cleanSpoken) return cleanBase;
  return `${cleanBase} ${cleanSpoken}`;
};

export default function VoiceInputButton({
  value,
  onChange,
  disabled = false,
  language,
  label = 'Speak to write',
  compact = false,
  className = '',
}) {
  const recognitionRef = useRef(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState('');

  valueRef.current = value;
  onChangeRef.current = onChange;

  useEffect(() => {
    setSupported(Boolean(getRecognitionConstructor()));
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = () => {
    recognitionRef.current?.stop();
  };

  const start = () => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition || disabled) return;

    const recognition = new Recognition();
    const baseValue = String(valueRef.current || '');
    const changeValue = onChangeRef.current;
    recognition.lang = language || navigator.language || 'en-IN';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = event => {
      const spoken = Array.from(event.results)
        .map(result => result[0]?.transcript || '')
        .join(' ');
      changeValue(joinTranscript(baseValue, spoken));
    };
    recognition.onerror = event => {
      const messages = {
        'not-allowed': 'Microphone permission was denied.',
        'audio-capture': 'No working microphone was found.',
        network: 'Voice recognition could not reach the browser service.',
        'no-speech': 'No speech was detected. Try again.',
      };
      setError(messages[event.error] || 'Voice recognition stopped unexpectedly.');
    };
    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    setError('');
    setListening(true);
    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setListening(false);
      setError('Voice recognition is already running.');
    }
  };

  const unavailable = !supported || disabled;
  const title = !supported
    ? 'Voice typing is not supported by this browser'
    : listening
      ? 'Stop voice typing'
      : label;

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        onClick={listening ? stop : start}
        disabled={unavailable}
        aria-label={title}
        aria-pressed={listening}
        title={title}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border font-bold transition ${
          compact ? 'h-10 w-10 p-0' : 'min-h-10 px-3 text-xs'
        } ${
          listening
            ? 'border-red-300 bg-red-50 text-red-600 shadow-[0_0_0_4px_rgba(248,113,113,.12)]'
            : 'border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700'
        } disabled:cursor-not-allowed disabled:opacity-40`}
      >
        <svg aria-hidden="true" className={`h-4 w-4 ${listening ? 'animate-pulse' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21m-3 0h6" />
        </svg>
        {!compact && <span>{listening ? 'Listening…' : 'Speak'}</span>}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {listening ? 'Voice typing is listening.' : error}
      </span>
      {error && (
        <span className="absolute bottom-full right-0 z-[90] mb-2 w-56 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-medium leading-4 text-white shadow-xl">
          {error}
        </span>
      )}
    </span>
  );
}
