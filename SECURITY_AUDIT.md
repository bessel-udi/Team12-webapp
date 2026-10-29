# Security Audit: QuickFundi API (Week 9, updated in Week 10)

Scope: every endpoint in `index.js`, `routes/workers.js` and `routes/bookings.js`, including success and error responses, plus the `/provider-inventory/:id` route added in Week 10.

## 1. What I checked

| # | Check | How I checked it |
|---|-------|------------------|
| 1 | Sensitive fields in responses | Read every `res.json(...)` call and every SELECT; called `GET /workers` and inspected the real response |
| 2 | Other people's data via ID changes | Reviewed how `GET/PATCH/DELETE /bookings/:id` look up records |
| 3 | Error messages | Triggered a malformed JSON body, an unknown route and bad input, and read the raw responses |
| 4 | Write endpoints and extra fields | Read what `POST /bookings` and `PATCH /bookings/:id` take from `req.body` |
| 5 | Keys in the wrong place | Checked `.gitignore`, `.env.example`, startup logging, the README and git history |
| 6 | Routes reachable without a key | Read `index.js` top to bottom for routes registered before `requireApiKey`, then called each route with curl and no key |

## 2. Findings and fixes

| Check | Finding | Fix / status |
|-------|---------|--------------|
| Sensitive fields | No problems. All queries use explicit column lists (no `SELECT *`, no raw rows). `requestedBy` is stored but never returned. `GET /workers/:id` returns review `author` names, which is part of the public worker profile. | None needed |
| Other people's data | **Limitation:** bookings are not tied to a specific API key, so any valid key can read, reschedule or cancel any booking if it knows the ID. | Booking IDs were `bk_<timestamp>` (easy to guess). Changed to `bk_<16 random hex chars>` using `crypto.randomBytes`. Per-key ownership is out of scope and is a known limitation. |
| Error messages | **Found:** sending malformed JSON returned an HTML page with a full stack trace, exposing local file paths and `node_modules` paths. This happens inside `express.json()`, before any route's `try/catch`. | Added a global error handler: malformed JSON now returns `400 {"code":"INVALID_JSON"}`; everything else returns a generic `500`. Added a JSON 404 handler for unknown routes. Re-tested: no stack trace. |
| Error messages | **Found:** the `X-Powered-By: Express` header advertised the framework. | `app.disable('x-powered-by')` |
| Error messages | Existing 500 responses in the routes were already generic (details only go to `console.error`). 404 messages echo the requested ID back, which I judged low risk since the response is JSON. | None needed |
| Write endpoints | `POST /bookings` destructures only five named fields, and `PATCH` reads only `scheduledFor`. Extra fields such as `id` or `status` cannot be written. | None needed |
| Write endpoints | **Found:** the code uses `db.query`, which expands arrays and objects into SQL fragments, so a non-string value (for example `"workerId": {"a":1}`) could cause odd SQL errors. | Added string type checks to `POST /bookings` and to the `GET /workers` filters; these now return a clean `400`. |
| Routes without a key | **Found (Week 10):** `GET /provider-inventory/:id` is registered before `requireApiKey`. It has to be, so our own web page can call it without the partner's key ever reaching browser code. The cost is that anyone on the internet can call it, each call spends our LiteStock key's quota, and it was outside the keyed rate limiter. | Kept it open on purpose, but limited it: a separate **30 requests per minute per IP** limit, `trust proxy` set so the real client IP is used behind Railway's proxy, CORS restricted to our own frontend origins (`FRONTEND_ORIGINS`), the provider ID validated as a positive whole number, only four fields returned per item, and a generic `502` when the partner fails. Verified with curl (locally and on the deployed server): no key does not give 401 on this route; a bad ID gives 400; an allowed origin gets a CORS header and a foreign origin gets none; every other route still returns 401 without a key. |
| Keys in the wrong place | `.env` is listed in `.gitignore` and does not appear in `git status`. `.env.example` contains placeholders only (including `PARTNER_API_KEY`). The server logs only the number of keys loaded, never the keys. The README uses the `<your-api-key>` placeholder. | None needed |
| Keys in the wrong place | **Found:** a real API key appeared in command-line output that was shared outside the team. I treated it as leaked. | Generated a new key, replaced the old one in the `API_KEYS` variable on Railway and in the local `.env`, gave the new key to its consumer privately, and confirmed the old key now returns `401` and the new key returns `200`. |
| Keys in the wrong place | CORS on the keyed API is open to all origins (`cors()` with no options). The API key still protects the data, but any website could call the API from a browser if it had a key. | Noted; acceptable for this course project. Would restrict origins in production. |

## 3. Authentication

- Every route requires a valid `X-API-Key` header, including `/`, with **one deliberate exception**: `GET /provider-inventory/:id` (see section 2). Missing or wrong keys get `401`.
- There is one key per consumer (ring partner and our own team), stored in the `API_KEYS` environment variable, never in source code.
- Verified with three requests: no key gives 401, wrong key gives 401, valid key gives 200.

## 4. Rate limits

**Keyed routes: 100 requests per minute per API key.**

Why this number: a normal client of this API (looking up workers and creating or changing a few bookings) makes a handful of requests per minute. 100 per minute leaves plenty of room for legitimate bursts, such as a page that loads several lists at once, while still stopping a runaway loop or scraping within seconds.

**Open inventory route: 30 requests per minute per IP address.**

Why this number: the route has no key to count against, so it is limited by IP. One page view makes one call, so a person would rarely exceed a few per minute. 30 is lower than the keyed limit because the route is open, and each call uses up our upstream partner's quota.

Demonstration: with the keyed limit temporarily set to 3, five rapid requests returned `200 200 200 429 429`. The 429 response includes a `Retry-After` header and the JSON body `{"message":"Too many requests","retryAfter":<seconds>}`. The limit was then set back to 100. For the open route, 35 rapid requests returned 30 successful responses followed by 5 responses with status 429.

Evidence (terminal output):

```
PASTE YOUR REAL TERMINAL OUTPUT HERE
```

Limitations: both limiters are in memory, so they reset when the server restarts and would not work correctly across several server copies. A production system would use a shared store such as Redis.

## 5. Remaining known limitations

- No per-consumer ownership of bookings (see section 2).
- In-memory rate limiting only.
- Open CORS policy on the keyed API.
- The open inventory route can still be called by anyone, up to 30 times per minute from each IP. CORS only restricts other websites in browsers, not scripts or curl. Many different IPs could still use up the partner quota. The alternative of putting the partner key in browser code would be worse, and a production system would put a login in front of this route.
