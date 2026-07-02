import { useEffect, useId, useMemo, useRef, useState } from 'react';

const normalizeOption = option => typeof option === 'string'
  ? { value: option, label: option }
  : option;

export default function SelectField({
  value,
  onChange,
  options,
  id,
  multiple = false,
  placeholder = 'Select an option',
  ariaLabel,
  className = '',
  buttonClassName = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const listboxId = useId();
  const normalizedOptions = useMemo(() => options.map(normalizeOption), [options]);
  const selectedValues = multiple
    ? (Array.isArray(value) ? value : [])
    : [value];
  const selectedOptions = normalizedOptions.filter(option =>
    selectedValues.includes(option.value),
  );

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = event => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = event => {
      if (event.key === 'Escape') {
        setOpen(false);
        rootRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  const selectOption = optionValue => {
    if (multiple) {
      const nextValues = selectedValues.includes(optionValue)
        ? selectedValues.filter(item => item !== optionValue)
        : [...selectedValues, optionValue];
      onChange(nextValues);
      return;
    }
    onChange(optionValue);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(current => !current)}
        onKeyDown={event => {
          if (['ArrowDown', 'Enter', ' '].includes(event.key) && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={`input flex min-h-11 items-center justify-between gap-3 text-left ${
          open ? 'border-emerald-500 ring-4 ring-emerald-100 dark:ring-emerald-500/15' : ''
        } ${buttonClassName}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {selectedOptions.length ? (
            multiple ? selectedOptions.map(option => (
              <span
                key={option.value}
                className="max-w-full truncate rounded-lg bg-emerald-100 px-2 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-300/10 dark:text-emerald-100"
              >
                {option.label}
              </span>
            )) : (
              <span className="truncate">{selectedOptions[0].label}</span>
            )
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </span>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-multiselectable={multiple || undefined}
          className="absolute z-[70] mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-emerald-200 bg-white p-1.5 shadow-[0_18px_55px_rgba(2,44,34,0.24)] dark:border-emerald-300/20 dark:bg-[#071d17]"
        >
          {normalizedOptions.map(option => {
            const selected = selectedValues.includes(option.value);
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                key={option.value}
                onClick={() => selectOption(option.value)}
                className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                  selected
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-300/15 dark:text-emerald-50'
                    : 'text-slate-700 hover:bg-emerald-50 dark:text-slate-200 dark:hover:bg-white/[0.06]'
                }`}
              >
                <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border text-xs font-black ${
                  selected
                    ? 'border-emerald-600 bg-emerald-600 text-white'
                    : 'border-slate-300 text-transparent dark:border-slate-600'
                }`}>
                  ✓
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{option.label}</span>
                  {option.detail && (
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {option.detail}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
