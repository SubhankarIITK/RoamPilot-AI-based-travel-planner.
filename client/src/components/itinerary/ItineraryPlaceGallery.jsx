import { useState } from 'react';
import PhotoLightbox from './PhotoLightbox.jsx';

function PlacePhoto({ place, onPreview }) {
  const [imageFailed, setImageFailed] = useState(false);
  if (!place.imageUrl || imageFailed) return null;

  const credit = (
    <span className="text-[11px] text-emerald-100/75">
      {place.imageAttribution || 'Photo from Pexels'}
    </span>
  );

  return (
    <figure className="group overflow-hidden rounded-2xl border border-emerald-300/15 bg-emerald-950/80 shadow-lg shadow-black/10">
      <button
        type="button"
        onClick={onPreview}
        aria-label={`Open photo of ${place.placeName || place.activity}`}
        className="relative block aspect-[16/10] w-full overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-300"
      >
        <img
          src={place.imageUrl}
          alt={place.placeName || place.activity}
          loading="lazy"
          onError={() => setImageFailed(true)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-950 via-emerald-950/75 to-transparent px-4 pb-3 pt-10">
          <figcaption className="line-clamp-2 text-sm font-bold text-white">
            {place.placeName}
          </figcaption>
          <span className="mt-1 block text-[10px] font-bold uppercase tracking-wider text-emerald-100/75 opacity-0 transition group-hover:opacity-100">
            View photo
          </span>
        </div>
      </button>
      <div className="px-4 py-2.5">
        {place.imagePageUrl ? (
          <a
            href={place.imagePageUrl}
            target="_blank"
            rel="noreferrer"
            className="transition hover:text-white"
          >
            {credit}
          </a>
        ) : credit}
      </div>
    </figure>
  );
}

export default function ItineraryPlaceGallery({ gallery, loading }) {
  const [preview, setPreview] = useState(null);

  if (loading) {
    return (
      <section className="card">
        <div className="h-5 w-48 animate-pulse rounded bg-emerald-200/20" />
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map(item => (
            <div key={item} className="aspect-[16/10] animate-pulse rounded-2xl bg-emerald-200/10" />
          ))}
        </div>
      </section>
    );
  }

  const days = (gallery?.days || [])
    .map(day => ({ ...day, places: day.places.filter(place => place.imageUrl) }))
    .filter(day => day.places.length > 0);

  if (!days.length) {
    if (!gallery || gallery.configured !== false) return null;
    return (
      <section className="card">
        <h3 className="font-bold text-slate-800 dark:text-white">Itinerary Place Gallery</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-emerald-100/60">
          Place photos are currently unavailable. Configure the server Pexels key to enable them.
        </p>
      </section>
    );
  }

  return (
    <section className="card overflow-hidden">
      <div>
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
          Pexels place collection
        </p>
        <h3 className="mt-1 text-lg font-bold text-slate-800 dark:text-white">
          Places in your itinerary
        </h3>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-emerald-100/60">
          A separate photo gallery for the locations included in each day.
        </p>
      </div>

      <div className="mt-6 space-y-7">
        {days.map(day => (
          <section key={`${day.day}-${day.date || ''}`}>
            <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h4 className="font-bold text-slate-800 dark:text-white">Day {day.day}</h4>
              {day.theme && (
                <span className="text-xs text-slate-500 dark:text-emerald-100/60">{day.theme}</span>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {day.places.map((place, index) => (
                <PlacePhoto
                  key={`${day.day}-${place.placeName}-${index}`}
                  place={place}
                  onPreview={() => setPreview({ images: day.places, index })}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {preview && (
        <PhotoLightbox
          images={preview.images}
          initialIndex={preview.index}
          onClose={() => setPreview(null)}
        />
      )}
    </section>
  );
}
