# CONTRACT_DEVIATIONS.md

No deviations from `openapi.yaml`.

During Week 5 verification, two implementation bugs were found and fixed to
match the existing contract — the contract itself was not changed.

1. **Missing route** — `GET /workers/{id}` was not implemented in
   `server/routes/workers.js` at all (only `GET /workers` existed). Added the
   handler back, returning the full `WorkerProfile` shape already defined in
   `openapi.yaml` (`id`, `name`, `jobType`, `location`, `rating`,
   `ratePerHour`, `experienceYears`, `reviews`).

2. **Timezone drift on date fields** — `scheduledFor` and `createdAt` in
   booking responses were shifting by the local server timezone offset (EAT,
   UTC+3) instead of returning UTC as the contract promises. For example, a
   booking sent with `scheduledFor: "2026-09-15T09:00:00Z"` was coming back
   as `"2026-09-15T06:00:00.000Z"` — a silent 3-hour drift. Fixed by setting
   `timezone: '+00:00'` on the MySQL connection pool in `server/db.js`, so
   date columns are read back as UTC rather than being reinterpreted in the
   server's local timezone.

3. **Type drift on numeric fields** — `rating` and `ratePerHour` in worker
   responses were being returned as strings (e.g. `"4.8"`, `"800.00"`)
   instead of numbers, due to how the `mysql2` driver reads `DECIMAL`
   columns by default. Fixed by explicitly casting both fields with
   `Number()` before sending the response, in both `GET /workers` and
   `GET /workers/{id}`.

All three GET endpoints (`GET /workers`, `GET /workers/{id}`,
`GET /bookings/{id}`) were re-verified against `openapi.yaml` after these
fixes, field by field, in Swagger Editor's preview and via direct browser
requests. All field names, types, and status codes now match the contract.

## Week 6

No deviations from `openapi.yaml`.

Implemented validation for all write endpoints (`POST /bookings`,
`PATCH /bookings/{id}`) beyond simple presence checks — added enum
validation for `jobType` and date-format validation for `scheduledFor`.
Tested every write endpoint (`POST`, `PATCH`, `DELETE` on `/bookings`) with
both valid and deliberately invalid input (missing fields, invalid enum
values, malformed dates, nonexistent ids). All status codes matched the
contract exactly: 201 on create, 200 on successful reschedule, 204 on
successful cancel, 400 on validation failure, 404 on operations against a
nonexistent booking. Confirmed via re-fetch that `DELETE` actually persists
the `cancelled` status rather than returning a false-success response.

