# Deprecation notice: QuickFundi API v1

**To:** Claire , Team 13 (HospitalQ)
**From:** Bessel , Team 12 (QuickFundi)
**Date:** 13 November 2026

## Summary

v1 of the QuickFundi API (the URLs with no version, such as `/workers`, and the `/v1/...` URLs) is deprecated. **v2 is live now** at `/v2/...`. **v1 will stop working on 19 November 2026.** Please move before then.

## What is changing

- `GET /workers` (the search list) is wrapped: `[ ... ]` becomes `{ "data": [ ... ], "count": N }`
- Nothing else changes: worker fields (`id`, `name`, `jobType`, `location`, `rating`, `ratePerHour`), the `jobType` and `location` filters, the single-worker response, all booking endpoints, status codes, error messages, and your API key.

## Why

Wrapping the list lets us add paging (for example `page` and `limit`) later without another breaking change.

## Before and after

**v1** `GET /workers?jobType=electrician`
```json
[
  { "id": "wk_1042", "name": "James Otieno", "jobType": "electrician",
    "location": "Nairobi, Upper Hill", "rating": 4.8, "ratePerHour": 800 }
]
```

**v2** `GET /v2/workers?jobType=electrician`
```json
{
  "data": [
    { "id": "wk_1042", "name": "James Otieno", "jobType": "electrician",
      "location": "Nairobi, Upper Hill", "rating": 4.8, "ratePerHour": 800 }
  ],
  "count": 1
}
```

## How to migrate

1. Change your base path from `/workers` to `/v2/workers` (same key, same `?jobType=` and `?location=` filters). Do the same for `/bookings`, which becomes `/v2/bookings`: it behaves identically, but the old URL stops on the same date.
   Base URL: `https://team12-webapp-production.up.railway.app`
2. Read the list from `body.data` instead of from the body itself. `body.count` is the number of workers returned.
3. Test it, then tell me, so I can see your calls in my logs.

## Timeline

- **Today (13 November 2026):** v2 is live. v1 still works and now sends `Deprecation`, `Sunset` and `Link` headers on every response.
- **14 November 2026:** v1 stops working.

## Questions

Message me any time. I will reply as soon as possible.
