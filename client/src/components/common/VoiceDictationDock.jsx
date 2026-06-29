import { useEffect, useState } from 'react';
import VoiceInputButton from './VoiceInputButton.jsx';

const allowedInputTypes = new Set(['text', 'search', 'tel', 'url']);

const isVoiceTarget = element => {
  if (!element || element.disabled || element.readOnly || element.dataset.voiceDisabled === 'true') {
    return false;
  }
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLInputElement && allowedInputTypes.has(element.type || 'text');
};

const setNativeValue = (element, value) => {
  const prototype = element instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
  setter?.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

export default function VoiceDictationDock() {
  const [target, setTarget] = useState(null);
  const [value, setValue] = useState('');

  useEffect(() => {
    const handleFocus = event => {
      if (isVoiceTarget(event.target)) {
        setTarget(event.target);
        setValue(event.target.value || '');
      } else if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        setTarget(null);
      }
    };
    const handleInput = event => {
      if (event.target === target) setValue(event.target.value || '');
    };
    document.addEventListener('focusin', handleFocus);
    document.addEventListener('input', handleInput);
    return () => {
      document.removeEventListener('focusin', handleFocus);
      document.removeEventListener('input', handleInput);
    };
  }, [target]);

  if (!target || !document.contains(target)) return null;

  const fieldName = target.getAttribute('aria-label')
    || target.getAttribute('placeholder')
    || target.id
    || 'selected field';

  return (
    <div className="fixed bottom-4 right-4 z-[75] flex max-w-[min(22rem,calc(100vw-2rem))] items-center gap-3 rounded-2xl border border-slate-200 bg-white/95 p-2.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95">
      <VoiceInputButton
        compact
        value={value}
        onChange={nextValue => {
          setNativeValue(target, nextValue);
          setValue(nextValue);
          target.focus();
        }}
        label={`Speak into ${fieldName}`}
      />
      <div className="min-w-0 pr-2">
        <p className="text-xs font-extrabold text-slate-800">Voice typing ready</p>
        <p className="truncate text-[10px] text-slate-500">{fieldName}</p>
      </div>
    </div>
  );
}
