import { useEffect, useRef, useState } from 'react';
import { transcribeSpeech } from '../../api/aiApi.js';

const MAX_RECORDING_MS = 45 * 1000;

const joinTranscript = (base, spoken) => {
  const cleanBase = String(base || '').trimEnd();
  const cleanSpoken = String(spoken || '').trim();
  if (!cleanBase) return cleanSpoken;
  if (!cleanSpoken) return cleanBase;
  return `${cleanBase} ${cleanSpoken}`;
};

const getSupportedMimeType = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  return [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ].find(type => MediaRecorder.isTypeSupported(type)) || '';
};

const fileDetails = mimeType => {
  const cleanType = String(mimeType || '').split(';')[0];
  if (cleanType === 'audio/mp4') return { mimeType: cleanType, fileName: 'voice.m4a' };
  if (cleanType === 'audio/ogg') return { mimeType: cleanType, fileName: 'voice.ogg' };
  return { mimeType: cleanType || 'audio/webm', fileName: 'voice.webm' };
};

const microphoneSupported = () =>
  typeof navigator !== 'undefined' &&
  Boolean(navigator.mediaDevices?.getUserMedia) &&
  typeof MediaRecorder !== 'undefined';

export default function VoiceInputButton({
  value,
  onChange,
  disabled = false,
  language,
  label = 'Speak to write',
  compact = false,
  className = '',
}) {
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const stopTimerRef = useRef(null);
  const baseValueRef = useRef('');
  const onChangeRef = useRef(onChange);
  const mountedRef = useRef(true);
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState('');

  onChangeRef.current = onChange;

  const releaseMicrophone = () => {
    if (stopTimerRef.current) window.clearTimeout(stopTimerRef.current);
    stopTimerRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
  };

  useEffect(() => {
    setSupported(microphoneSupported());
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recorderRef.current?.state === 'recording') {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      releaseMicrophone();
    };
  }, []);

  const submitRecording = async (blob, mimeType) => {
    if (!blob || blob.size < 100) {
      setError('No speech was captured. Try again.');
      return;
    }
    setTranscribing(true);
    try {
      const details = fileDetails(mimeType);
      const audio = new Blob([blob], { type: details.mimeType });
      const locale = String(language || navigator.language || '').split('-')[0].toLowerCase();
      const response = await transcribeSpeech({
        audio,
        fileName: details.fileName,
        language: /^[a-z]{2}$/.test(locale) ? locale : '',
      });
      if (!mountedRef.current) return;
      const transcript = response.data?.data?.text || '';
      onChangeRef.current(joinTranscript(baseValueRef.current, transcript));
    } catch (requestError) {
      if (!mountedRef.current) return;
      setError(
        requestError.response?.data?.message ||
        'Voice transcription is unavailable. You can still type your answer.',
      );
    } finally {
      if (mountedRef.current) setTranscribing(false);
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const start = async () => {
    if (!microphoneSupported() || disabled || transcribing) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      baseValueRef.current = String(value || '');

      recorder.ondataavailable = event => {
        if (event.data?.size) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        if (mountedRef.current) setError('The microphone recording stopped unexpectedly.');
      };
      recorder.onstop = () => {
        const recordedType = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: recordedType });
        chunksRef.current = [];
        recorderRef.current = null;
        releaseMicrophone();
        if (mountedRef.current) {
          setRecording(false);
          submitRecording(blob, recordedType);
        }
      };

      recorder.start(500);
      setRecording(true);
      stopTimerRef.current = window.setTimeout(stop, MAX_RECORDING_MS);
    } catch (microphoneError) {
      releaseMicrophone();
      const denied = ['NotAllowedError', 'PermissionDeniedError'].includes(microphoneError?.name);
      setError(denied
        ? 'Microphone permission was denied.'
        : 'No working microphone was found.');
    }
  };

  const unavailable = !supported || disabled || transcribing;
  const title = !supported
    ? 'Audio recording is not supported by this browser'
    : transcribing
      ? 'Converting speech to text'
      : recording
        ? 'Stop and transcribe'
        : label;

  return (
    <span className={`relative inline-flex shrink-0 ${className}`}>
      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={unavailable}
        aria-label={title}
        aria-pressed={recording}
        title={title}
        className={`inline-flex items-center justify-center gap-2 rounded-xl border font-bold transition ${
          compact ? 'h-10 w-10 p-0' : 'min-h-10 px-3 text-xs'
        } ${
          recording
            ? 'border-red-300 bg-red-50 text-red-600 shadow-[0_0_0_4px_rgba(248,113,113,.12)]'
            : transcribing
              ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700'
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {transcribing ? (
          <span aria-hidden="true" className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600/25 border-t-emerald-600" />
        ) : (
          <svg aria-hidden="true" className={`h-4 w-4 ${recording ? 'animate-pulse' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21m-3 0h6" />
          </svg>
        )}
        {!compact && (
          <span>{transcribing ? 'Transcribing…' : recording ? 'Stop & convert' : 'Speak'}</span>
        )}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {recording
          ? 'Recording voice. Select again to stop.'
          : transcribing
            ? 'Converting speech to text with Whisper.'
            : error}
      </span>
      {error && (
        <span className="absolute bottom-full right-0 z-[90] mb-2 w-64 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-medium leading-4 text-white shadow-xl">
          {error}
        </span>
      )}
    </span>
  );
}
