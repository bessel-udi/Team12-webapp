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
| Routes without a key | **Found (Week 10):** `GET /provider-inventory/:id` is registered before `requireApiKey`. It has to be, so our own web page can call it without the partner's key ever reaching browser code. The cost is that anyone on the internet can call it, each call spends our LiteStock key's quota, and it was outside the keyed rate limiter. | Kept it open on purpose, but limited it: a separate **30 requests per minute per IP** limit, `trust proxy` set so the real client IP is used behind Railway's proxy, CORS restricted to our own frontend origins (`FRONTEND_ORIGINS`), the provider ID validated as a positive whole number, only five fields returned per item (`product_id`, `name`, `category`, `quantity`, `status`), the partner's response checked before it is passed on, and a generic `502` when the partner fails and no cached copy exists. Verified with curl (locally and on the deployed server): no key does not give 401 on this route; a bad ID gives 400; an allowed origin gets a CORS header and a foreign origin gets none; every other route still returns 401 without a key. |
| Keys in the wrong place | `.env` is listed in `.gitignore` and does not appear in `git status`. `.env.example` contains placeholders only (including `PARTNER_API_KEY`). The server logs only the number of keys loaded, never the keys. The README uses the `<your-api-key>` placeholder. The partner key is read from `PARTNER_API_KEY` (a Railway variable on the deployed server), is only sent in the `X-API-Key` header on the partner call, and is never logged: the partner log lines contain only status codes and failure reasons. | None needed |
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
- The inventory route keeps the last good response in memory for each provider ID it has served, with no size limit. Because anyone can call the route with any positive whole number (30 times per minute per IP), the cache could slowly grow. A production system would cap the number of entries or expire old ones.

## Staff access control (materials in stock)

**Change made:** materials were first shown to everyone on the worker page. Customers have no reason to see stock, so access is now limited to staff, and the server enforces it.

| Check | Finding | Fix / status |
|---|---|---|
| Who can see stock | The old read route `GET /provider-inventory/:id` was open to anyone. | Removed. It now requires a signed-in admin or fundi. Customers get `401`. An API key alone does not unlock it. |
| Authentication | Needed real identities, not one shared key. | Username and password. Passwords are stored as salted scrypt hashes. Sessions are signed tokens (HMAC-SHA256, secret in `AUTH_SECRET`) that expire after 8 hours. |
| Role checks | Admin and fundi need different powers. | Admin: everything, plus creating accounts and viewing activity. Fundi: view, take, and return only what they took themselves. Every request re-checks the account in the database, so removing a person or changing a role applies immediately. |
| Password guessing | Login could be brute-forced. | Login is limited to 8 attempts per minute per address. Error text is the same for a wrong password and an unknown username, and unknown usernames take the same time to check. |
| Key in the browser | Earlier finding: the team API key had to sit in the frontend to take items, where anyone could read it. | Resolved. The browser no longer holds any API key. |
| Who took an item | The name used to be typed into the page. | The name now comes from the sign-in, so nobody can take items under another person's name. |
| Input checks | Take and return accept numbers from the client. | `productId` and `quantity` must be whole numbers (quantity 1-100); amounts are checked against live stock inside a database transaction; if Team 11's data is unavailable, taking is refused (`503`). |
| Tests | | Automated tests cover: no token gives 401, a forged token gives 401, an API key alone gives 401, a fundi gets 403 on admin routes, wrong password and unknown user both give 401, passwords are never stored in plain text. |

**Remove from the earlier findings table:** the row describing `/provider-inventory/:id` as a deliberate open route. It no longer applies.

**Known limitations**
- Session tokens live in the browser's `sessionStorage`, so a cross-site-scripting flaw in the app could expose them.
- Tokens are stateless: signing out removes the token from the browser but the token stays valid until it expires. Deleting an account does stop it working at once.
- There is no password reset or change screen. An admin must delete the account and create a new one.
- The login attempt limiter is in memory, so it resets when the server restarts.
- Stock is Team 11's shared inventory (their API ignores the provider ID), so records are kept per product, not per provider.
- When an admin returns items on someone's behalf, the record shows the admin as the person who returned them.
