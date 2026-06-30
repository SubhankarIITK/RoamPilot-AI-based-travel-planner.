# RoamPilot Travel Data APIs

RoamPilot keeps the existing agent workflow. The Research Agent now gathers a
single cached factual bundle before the foundation and day-planning stages.
The LLM reasons over that data; it does not call providers itself.

## Provider setup

Add these values to `server/.env` and restart the server:

```env
AMADEUS_CLIENT_ID=
AMADEUS_CLIENT_SECRET=
GEOAPIFY_API_KEY=
OPENROUTESERVICE_API_KEY=
```

- Amadeus Self-Service test credentials provide airport matches, flight routes,
  durations, airlines, and test fare snapshots.
- Geoapify provides destination coordinates and one multi-category request for
  named hotels, restaurants, cafes, attractions, museums, and parks.
- OpenRouteService receives one driving and one walking matrix for a bounded
  place shortlist. RoamPilot computes the nearby-stop order locally.
- Open-Meteo requires no key. It is queried only when trip dates are inside the
  live forecast window; otherwise weather claims must be labelled estimated.
- Nager.Date requires no key and is queried once for holidays overlapping the
  trip.

Tavily remains supporting web research. Structured API fields take precedence
when the two disagree.

## Request and cache policy

- Provider requests are serialized per provider and paced by
  `TRAVEL_API_MIN_INTERVAL_MS`.
- Destination/airport identity is cached for 30 days.
- Places and route matrices are cached for 7 days.
- Amadeus fare snapshots and Open-Meteo trip forecasts are cached for 6 hours.
- The complete trip research bundle is also cached by traveler and trip input.
- A provider failure disables only its own facts. The itinerary continues with
  explicit estimated labels and recheck guidance.

No provider key is sent to the browser. All requests run on the server.
