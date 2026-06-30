# Itinerary Place Gallery

RoamPilot displays a separate, day-grouped photo gallery for every named location in a saved
itinerary. Photos are fetched from Pexels and are not embedded inside the schedule cards.
The dashboard also stores up to six representative itinerary photos on each trip. Recent-trip
cards cross-fade through those photos every 5.5 seconds and loop continuously. Reduced-motion
browser preferences disable the automatic rotation.

## Configuration

1. Create a free API key at <https://www.pexels.com/api/>.
2. Add it to `server/.env`:

```env
PEXELS_API_KEY=your_pexels_api_key
IMAGE_CACHE_TTL_HOURS=720
```

3. Restart the server after changing `.env`.

Pexels' free API does not require a payment method. If the key is absent or rejected, trip
planning continues normally and the gallery remains unavailable.

## API and caching

The client requests `GET /api/trips/:id/place-images` after an itinerary loads. The server:

- extracts each unique schedule location, grouped by itinerary day;
- searches Pexels with the location and trip destination;
- returns only gallery metadata and image URLs;
- caches successful results for 720 hours by default;
- caches missing results for 24 hours;
- avoids duplicate concurrent lookups for the same place;
- stops making Pexels requests after 180 calls in a rolling hour per Node process.

`POST /api/trips/card-images` resolves the representative images for up to 12 of the signed-in
user's trips at once. The selected image set is stored on the trip with a signature derived from
its itinerary locations. Regenerating a plan changes the signature and refreshes the backgrounds;
unchanged plans reuse the stored image set.

Cached records are stored in MongoDB's `imagecaches` collection. To force stale photos to refresh,
delete the relevant records from that collection; the next gallery request resolves them again.

The hourly safeguard is process-local. A distributed counter should replace it if the application
is deployed across multiple Node instances.
