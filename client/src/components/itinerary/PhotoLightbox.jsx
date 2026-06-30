import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

const wrapIndex = (index, length) => (index + length) % length;

export default function PhotoLightbox({ images = [], initialIndex = 0, onClose }) {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [visible, setVisible] = useState(false);
  const activeImage = images[activeIndex];
  const hasMultipleImages = images.length > 1;

  useEffect(() => {
    const animationFrame = window.requestAnimationFrame(() => setVisible(true));
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.cancelAnimationFrame(animationFrame);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && hasMultipleImages) {
        setActiveIndex(index => wrapIndex(index - 1, images.length));
      }
      if (event.key === 'ArrowRight' && hasMultipleImages) {
        setActiveIndex(index => wrapIndex(index + 1, images.length));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasMultipleImages, images.length, onClose]);

  if (!activeImage || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md transition-opacity duration-200 sm:p-8 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      role="presentation"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Photo of ${activeImage.placeName || activeImage.activity || 'itinerary place'}`}
        className={`relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/15 bg-emerald-950 shadow-2xl shadow-black/50 transition duration-300 ${
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-3 scale-[0.97] opacity-0'
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image preview"
          className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-full border border-white/20 bg-slate-950/65 text-2xl leading-none text-white shadow-lg backdrop-blur transition hover:scale-105 hover:bg-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-300"
        >
          ×
        </button>

        <div className="relative flex min-h-[18rem] max-h-[72vh] items-center justify-center bg-slate-950 sm:min-h-[28rem]">
          <img
            key={activeImage.imageUrl}
            src={activeImage.imageUrl}
            alt={activeImage.placeName || activeImage.activity || 'Itinerary place'}
            className="max-h-[72vh] w-full animate-[fadeIn_.25s_ease-out] object-contain"
          />

          {hasMultipleImages && (
            <>
              <button
                type="button"
                onClick={() => setActiveIndex(index => wrapIndex(index - 1, images.length))}
                aria-label="View previous image"
                className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-slate-950/60 text-2xl text-white backdrop-blur transition hover:scale-105 hover:bg-emerald-900/90 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={() => setActiveIndex(index => wrapIndex(index + 1, images.length))}
                aria-label="View next image"
                className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-slate-950/60 text-2xl text-white backdrop-blur transition hover:scale-105 hover:bg-emerald-900/90 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                ›
              </button>
            </>
          )}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-gradient-to-r from-emerald-950 to-slate-950 px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-bold text-white">
              {activeImage.placeName || activeImage.activity || 'Itinerary photo'}
            </h3>
            <p className="mt-0.5 text-xs text-emerald-100/60">
              {activeImage.imageAttribution || 'Photo from Pexels'}
              {hasMultipleImages && ` · ${activeIndex + 1} of ${images.length}`}
            </p>
          </div>
          {activeImage.imagePageUrl && (
            <a
              href={activeImage.imagePageUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-100 transition hover:bg-emerald-400/20 hover:text-white"
            >
              View on Pexels
            </a>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
