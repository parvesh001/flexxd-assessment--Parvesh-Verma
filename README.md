# Visit Credits Booking API

Pay-per-visit marketplace backend. Users spend visit credits to book venues; each booking gets a redemption code that expires. All data is in memory and resets on restart.

## Run

```bash
npm install
npm test                       # automated tests (Jest + Supertest)
npm start                      # http://localhost:3000, codes valid for 1 hour
CODE_TTL_SECONDS=10 npm start  # short expiry for manual testing
```

| Env var | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `CODE_TTL_SECONDS` | `3600` | Redemption code lifetime |

## Seed data

| User | Name | Credits |
|---|---|---|
| `u1` | Alice | 3 |
| `u2` | Bob | 0 |

| Venue | Name | Price/visit | Daily capacity |
|---|---|---|---|
| `v1` | City Gym | 15 | 2 |
| `v2` | Yoga Loft | 20 | 10 |

## Endpoints

### `POST /bookings`
Body `{ "userId": "u1", "venueId": "v1" }` → `201` booking, one credit deducted.

```bash
curl -X POST localhost:3000/bookings -H 'Content-Type: application/json' -d '{"userId":"u1","venueId":"v1"}'
```

### `POST /bookings/redeem`
Body `{ "code": "ABCD2345" }` (case-insensitive) → `200` booking with `status: "redeemed"`.

```bash
curl -X POST localhost:3000/bookings/redeem -H 'Content-Type: application/json' -d '{"code":"<CODE>"}'
```

### `GET /users/{id}`
→ `200` `{ id, name, credits, bookings[] }`, newest booking first.

```bash
curl localhost:3000/users/u1
```

**Booking shape:** `{ id, userId, venueId, code, status, createdAt, expiresAt, redeemedAt }`. `status` is `active`, `redeemed` or `expired`, worked out each time the booking is read.

## Errors

Every error looks like this: `{ "error": { "code": "...", "message": "..." } }`

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` / `INVALID_JSON` | Missing or invalid fields, or a body that isn't valid JSON |
| 402 | `INSUFFICIENT_CREDITS` | User has no credits |
| 404 | `USER_NOT_FOUND` / `VENUE_NOT_FOUND` | Unknown user or venue |
| 404 | `CODE_NOT_FOUND` | Unknown redemption code |
| 409 | `DUPLICATE_BOOKING` | User already has an active booking at this venue today |
| 409 | `VENUE_FULL` | Venue's daily capacity reached |
| 409 | `ALREADY_REDEEMED` | Code already used |
| 410 | `CODE_EXPIRED` | Code past `expiresAt` |

Booking checks run in this order: user, venue, duplicate, capacity, credits. A rejected booking never deducts a credit.

## Testing expiry
- **Automated:** tests move a fake clock (`src/clock.js`) past `expiresAt`, so nothing actually waits.
- **Manual:** `CODE_TTL_SECONDS=10 npm start`, book, wait 10 seconds, redeem → `410 CODE_EXPIRED`.

## Layout
```
src/app.js                      Express app + error handler
src/server.js                   Starts the listener
src/config.js                   Env config
src/clock.js                    Replaceable clock (for tests)
src/store.js                    In-memory data + seed
src/errors.js                   AppError
src/services/bookingService.js  All business rules
src/routes/                     Input validation and HTTP mapping only
tests/                          Jest + Supertest
```

See `ASSUMPTIONS.md` for the design assumptions.
