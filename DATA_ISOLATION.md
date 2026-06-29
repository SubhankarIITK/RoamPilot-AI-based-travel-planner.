# RoamPilot data isolation

## MongoDB Atlas

RoamPilot always connects to the database named by:

```env
MONGO_DB_NAME=roampilot
```

This is independent of the database name embedded in `MONGO_URI`. Other
projects using the same Atlas cluster must use their own database names.

Before this change, a URI without a database path caused Mongoose to use its
default database. Collections such as `users` were therefore shared with other
projects, which could produce false "email already registered" errors.

Switching to the isolated `roampilot` database intentionally does not copy
records from the old shared database. Copying them automatically could import
another project's users and recreate the privacy problem.

## Browser authentication

RoamPilot now uses:

```text
roampilot:v1:auth-token
```

The old generic `rp_token` key is deleted and never migrated because it may
belong to another application running on the same localhost origin. Users need
to sign in once after this change.

## Offline trips

Offline data is stored under a user-specific key:

```text
roampilot:v1:offline-trips:<userId>
```

Every saved object also contains `ownerUserId` and reads filter by that owner.
Old global offline entries had no reliable owner, so they are discarded rather
than exposed to whichever account signs in next.
