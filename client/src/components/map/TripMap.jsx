import { useEffect, useMemo, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { englishDisplayText } from '../../utils/englishDisplayText.js';

const mapKey = import.meta.env.VITE_GEOAPIFY_MAP_KEY || '';
const fallbackCenter = [78.9629, 20.5937];

const mapStyle = mapKey
  ? `https://maps.geoapify.com/v1/styles/osm-bright/style.json?apiKey=${encodeURIComponent(mapKey)}`
  : {
      version: 8,
      sources: {
        openStreetMap: {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© OpenStreetMap contributors',
          maxzoom: 19,
        },
      },
      layers: [{
        id: 'openStreetMap',
        type: 'raster',
        source: 'openStreetMap',
      }],
    };

const coordinatesOf = value => {
  const coordinates = value?.coordinates;
  const latitude = Number(Array.isArray(coordinates) ? coordinates[1] : coordinates?.latitude);
  const longitude = Number(Array.isArray(coordinates) ? coordinates[0] : coordinates?.longitude);
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return null;
  }
  return [longitude, latitude];
};

const dayStops = day => {
  const stops = [];
  (day?.schedule || []).forEach((item, index) => {
    const coordinates = coordinatesOf(item);
    if (!coordinates) return;
    stops.push({
      id: `schedule-${day.day}-${index}`,
      order: stops.length + 1,
      coordinates,
      title: englishDisplayText(item.activity || item.location, 'Itinerary stop'),
      location: englishDisplayText(item.location, 'Mapped itinerary location'),
      description: englishDisplayText(item.details),
      time: item.time,
      type: 'activity',
    });
  });
  (day?.meals || []).forEach((meal, index) => {
    const coordinates = coordinatesOf(meal);
    if (!coordinates) return;
    stops.push({
      id: `meal-${day.day}-${index}`,
      order: stops.length + 1,
      coordinates,
      title: englishDisplayText(meal.placeOrArea, 'Meal stop'),
      location: 'Meal stop',
      description: englishDisplayText(meal.suggestion),
      time: meal.time,
      type: 'meal',
    });
  });
  return stops.filter((stop, index, allStops) =>
    allStops.findIndex(candidate =>
      candidate.coordinates[0] === stop.coordinates[0] &&
      candidate.coordinates[1] === stop.coordinates[1]) === index);
};

const createPopupContent = stop => {
  const root = document.createElement('div');
  root.className = 'roampilot-map-card';

  const topRow = document.createElement('div');
  topRow.className = 'roampilot-map-card__top';

  const icon = document.createElement('span');
  icon.className = 'roampilot-map-card__icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = stop.type === 'meal' ? '🍴' : '✦';

  const eyebrow = document.createElement('p');
  eyebrow.className = 'roampilot-map-card__eyebrow';
  eyebrow.textContent = `${stop.time || 'Flexible time'} · ${stop.type}`;
  topRow.append(icon, eyebrow);

  const title = document.createElement('h3');
  title.className = 'roampilot-map-card__title';
  title.textContent = stop.title || 'Itinerary stop';

  root.append(topRow, title);

  if (stop.location && stop.location !== stop.title) {
    const location = document.createElement('p');
    location.className = 'roampilot-map-card__location';
    location.textContent = `⌖ ${stop.location}`;
    root.append(location);
  }
  if (
    stop.description &&
    stop.description !== stop.title &&
    stop.description !== stop.location
  ) {
    const description = document.createElement('p');
    description.className = 'roampilot-map-card__description';
    description.textContent = stop.description;
    root.append(description);
  }

  const externalLink = document.createElement('a');
  externalLink.className = 'roampilot-map-card__action';
  externalLink.href = externalMapUrl(stop.coordinates);
  externalLink.target = '_blank';
  externalLink.rel = 'noopener noreferrer';
  const actionLabel = document.createElement('span');
  actionLabel.textContent = 'Open live navigation';
  const actionIcon = document.createElement('span');
  actionIcon.setAttribute('aria-hidden', 'true');
  actionIcon.textContent = '↗';
  externalLink.append(actionLabel, actionIcon);
  root.append(externalLink);
  return root;
};

export const externalMapUrl = coordinates => {
  if (!coordinates) return '';
  const [longitude, latitude] = coordinates;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;
};

export default function TripMap({ days = [], initialDay, selectedStopId, className = '' }) {
  const availableDays = useMemo(
    () => days.map(day => ({ day, stops: dayStops(day) })).filter(item => item.stops.length),
    [days],
  );
  const initialAvailableDay = availableDays.find(item => Number(item.day.day) === Number(initialDay))
    || availableDays[0];
  const [activeDayNumber, setActiveDayNumber] = useState(initialAvailableDay?.day?.day);
  const [mapReady, setMapReady] = useState(false);
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const popupsRef = useRef([]);

  const activeDay = availableDays.find(item =>
    Number(item.day.day) === Number(activeDayNumber)) || initialAvailableDay;
  const activeStops = activeDay?.stops || [];

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !activeStops.length) return undefined;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: activeStops[0]?.coordinates || fallbackCenter,
      zoom: 12,
      attributionControl: true,
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
    map.on('load', () => setMapReady(true));
    mapRef.current = map;
    return () => {
      markersRef.current.forEach(marker => marker.remove());
      popupsRef.current.forEach(popup => popup.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !activeStops.length) return;

    markersRef.current.forEach(marker => marker.remove());
    popupsRef.current.forEach(popup => popup.remove());
    markersRef.current = [];
    popupsRef.current = [];

    const route = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: activeStops.length > 1
          ? activeStops.map(stop => stop.coordinates)
          : [activeStops[0].coordinates, activeStops[0].coordinates],
      },
    };
    const routeSource = map.getSource('itinerary-route');
    if (routeSource) routeSource.setData(route);
    else {
      map.addSource('itinerary-route', { type: 'geojson', data: route });
      map.addLayer({
        id: 'itinerary-route-shadow',
        type: 'line',
        source: 'itinerary-route',
        paint: {
          'line-color': '#052e25',
          'line-width': 8,
          'line-opacity': 0.22,
        },
      });
      map.addLayer({
        id: 'itinerary-route',
        type: 'line',
        source: 'itinerary-route',
        paint: {
          'line-color': '#059669',
          'line-width': 4,
          'line-opacity': 0.88,
        },
      });
    }

    const bounds = new maplibregl.LngLatBounds();
    activeStops.forEach(stop => {
      const markerElement = document.createElement('button');
      markerElement.type = 'button';
      markerElement.className = `grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-emerald-600 text-xs font-black text-white shadow-lg transition hover:scale-110 ${
        stop.id === selectedStopId ? 'ring-4 ring-lime-300/70' : ''
      }`;
      markerElement.textContent = String(stop.order);
      markerElement.setAttribute('aria-label', `Show ${stop.title} on map`);
      const popup = new maplibregl.Popup({
        offset: 22,
        maxWidth: '330px',
        className: 'roampilot-map-popup',
      })
        .setDOMContent(createPopupContent(stop));
      const marker = new maplibregl.Marker({ element: markerElement, anchor: 'center' })
        .setLngLat(stop.coordinates)
        .setPopup(popup)
        .addTo(map);
      markerElement.addEventListener('click', () => {
        map.flyTo({ center: stop.coordinates, zoom: 15, essential: true });
      });
      markersRef.current.push(marker);
      popupsRef.current.push(popup);
      bounds.extend(stop.coordinates);
      if (stop.id === selectedStopId) {
        popup.setLngLat(stop.coordinates).addTo(map);
      }
    });

    if (activeStops.length === 1) {
      map.flyTo({ center: activeStops[0].coordinates, zoom: 15, essential: true });
    } else {
      map.fitBounds(bounds, { padding: 70, maxZoom: 15, duration: 700 });
    }
  }, [activeStops, mapReady, selectedStopId]);

  if (!availableDays.length) {
    return (
      <div className={`card py-12 text-center ${className}`}>
        <div className="text-4xl">🗺️</div>
        <h3 className="mt-3 font-extrabold text-slate-900 dark:text-white">Map coordinates are unavailable</h3>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
          This older itinerary does not contain verified coordinates. Location links will still open an external map search.
        </p>
      </div>
    );
  }

  return (
    <section className={`overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm dark:border-emerald-300/15 dark:bg-[#071d17] ${className}`}>
      <div className="flex snap-x gap-2 overflow-x-auto border-b border-emerald-100 p-3 dark:border-emerald-300/10">
        {availableDays.map(item => (
          <button
            type="button"
            key={item.day.day}
            onClick={() => setActiveDayNumber(item.day.day)}
            className={`min-h-10 shrink-0 snap-start rounded-xl px-3 py-2 text-xs font-bold transition ${
              Number(activeDay?.day?.day) === Number(item.day.day)
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-white/[0.05] dark:text-emerald-100'
            }`}
          >
            Day {item.day.day} · {item.stops.length} stops
          </button>
        ))}
      </div>

      <div className="relative">
        <div ref={containerRef} className="h-[58dvh] min-h-[24rem] w-full sm:h-[34rem]" />
        {!mapReady && (
          <div className="absolute inset-0 grid place-items-center bg-emerald-950/85 text-sm font-bold text-emerald-100">
            Loading map…
          </div>
        )}
      </div>

      <div className="border-t border-emerald-100 bg-emerald-50/60 p-3 dark:border-emerald-300/10 dark:bg-emerald-300/[0.04]">
        <div className="flex gap-2 overflow-x-auto">
          {activeStops.map(stop => (
            <button
              type="button"
              key={stop.id}
              onClick={() => mapRef.current?.flyTo({
                center: stop.coordinates,
                zoom: 15,
                essential: true,
              })}
              className="flex min-w-52 shrink-0 items-center gap-3 rounded-xl border border-emerald-100 bg-white p-2.5 text-left transition hover:border-emerald-300 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-600 text-xs font-black text-white">
                {stop.order}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-xs font-bold text-slate-900 dark:text-white">{stop.title}</span>
                <span className="mt-0.5 block text-[10px] text-slate-500">{stop.time || 'Flexible time'}</span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-2 text-[10px] leading-4 text-slate-500">
          The green line shows itinerary order, not turn-by-turn road directions. Open a location externally for live navigation.
        </p>
        {!mapKey && (
          <p className="mt-2 text-[10px] leading-4 text-slate-500">
            Development fallback tiles are active. Configure VITE_GEOAPIFY_MAP_KEY for the production Geoapify style.
          </p>
        )}
      </div>
    </section>
  );
}
