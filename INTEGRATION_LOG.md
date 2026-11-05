# INTEGRATION_LOG.md

**Team:** Team 12 (QuickFundi)
**Upstream partner:** Team 11, LiteStock API (`https://quickfundi-litestock-api.onrender.com`)
**Downstream partner:** Team 13, HospitalQ
**Date:** first written 2026-10-28, updated 2026-11-05

## Summary

Feature: a "Materials in stock" panel on the worker profile page (`/worker/:id`).

How it works: the React page asks our own server (`GET /provider-inventory/:id`). Our server calls LiteStock `GET /api/inventory` with the partner key from the environment, checks the response shape, and returns `{ data, stale, asOf }`. Each item in `data` has `product_id`, `name`, `category`, `quantity` and `status`. The partner key never reaches browser code. Each partner call has a 5 second timeout and up to 3 attempts, and the last successful response is kept in memory and returned with `stale: true` if LiteStock cannot be reached.

Status: integrated against LiteStock's real API. Verified on our own machine and on our deployed server (Railway): the route returns LiteStock's 7 inventory items with `stale: false`. Until 2026-11-04 everything was tested against a stand-in server (`server/mock-partner.js`) because their server was not reachable.

## Bug and surprise log

| # | What broke (symptom) | Root cause | Fix | Whose code, and who fixed it |
|---|---|---|---|---|
| 1 | Could not make the first call (Part B): the partner's server was not running or reachable. | Partner's server was down during the lab, and the link they first gave us did not work. | Built `mock-partner.js` from their `openapi.yaml` (same paths, 400/404 error shape). Our app pointed at it through `PARTNER_URL`. On 2026-11-04 they gave us a working URL and we switched to it. | Partner's server (not ready). Stand-in built by us. |
| 2 | Opening our app in the browser returned `{"message":"Missing or invalid API key"}`. | Our own Week 9 `requireApiKey` middleware protects every route, and a browser sends no key. | Placed the new route above `app.use(requireApiKey)` so our own page can call it without a key. The partner key stays on the server. Confirmed `/workers` still returns 401 without a key. | Our code. Fixed by us. |
| 3 | `/provider-inventory/15` returned `Partner data unavailable`. The server log said `partner call failed: ERR_INVALID_URL`. | `PARTNER_URL` was undefined. The new settings had been saved in `.env.example`, and there was no `.env` in `server/` (dotenv reported `injected env (0)`), so `API_KEYS` was missing too. | Created `.env` with `API_KEYS`, `PARTNER_URL` and `PARTNER_API_KEY`. Put only placeholders back in `.env.example`. Confirmed `injected env (3)` and restarted. | Our configuration. Fixed by us. |
| 4 | Browser console: `No routes matched location "/workers/1"`. | Wrong address typed. The route is `/worker/:id`; `/workers` is the list page. | Used `/worker/1`. | Ours (typo). |
| 5 | With the real partner URL set, our route returned 502 and the log said `Partner returned: 401`. | Our route sent no key. When the retry helper was added, the call passed an empty `{}` as the fetch options and `PARTNER_API_KEY` was never read. A direct `curl` with the key, and a Node call using the values from `.env`, both returned 200, which showed the key and URL were fine. | Read `PARTNER_API_KEY` and send it in the `X-API-Key` header on the partner call. | Our code (introduced while merging the retry changes). Fixed by us. |
| 6 | Found while reading the route before running it: the response would be sent twice. | Two versions of the response code had been merged, so the route called `res.json` twice, which fails with "headers already sent". | Removed the first call and kept the version that also saves the cached copy. | Our code. Fixed by us. |
| 7 | The real partner's response did not match what our route expected. | LiteStock returns `{ count, inventory: [...] }` where each item has `product_id`, `name`, `category`, `stock_quantity` and `status`. There is no `unit`, and the quantity is called `stock_quantity`, not `quantity`. Our stand-in used different field names, so this never showed up. Without a mapping, the quantity would have silently been missing from the panel. | Added a shape check (502 if a field is missing or the wrong type) and mapped `stock_quantity` to `quantity`. The panel no longer shows a unit. | Our stand-in assumed field names the real API does not use. Fixed by us. |
| 8 | With the key fixed, the route still returned 502. The log showed `attempt 1 failed`, `attempt 2 failed`, then `Partner call failed: timeout`. | The timeout was 1500 ms, but the partner takes about 1.4 seconds to answer from our machine (measured 1.42 s with curl), so all three attempts missed it. | Raised `timeoutMs` from 1500 to 5000. After that the route returned 200 with the full inventory. | Our configuration. Fixed by us. |
| 9 | Starting the server printed `Could not start server: EADDRINUSE` and nodemon reported a crash. | An older copy of our own server was still running and holding port 5000. Earlier versions of our startup code printed "Server running" even when the port was taken, which hid this. | The startup code now reports the error and exits. Stopped all old Node processes and started once. | Our code. Fixed by us. |
| 10 | The first call to the deployed server returned `502 Partner data unavailable`. A call a few minutes later returned 200 with live data. | Most likely LiteStock's service sleeping on its free hosting plan: the first request times out while it wakes up, and a freshly deployed server has no cached copy to fall back on. We did not capture the log line, so this is not confirmed. | Wake the partner (one call) before a demo. The cached copy covers later failures. | Partner's hosting limit plus our empty cache. Worked around by us. |

## Open questions for the partner

1. **Provider ids.** Our worker ids (`wk_1042`) and LiteStock's `provider_id` values are separate numbering systems, and the profile page currently uses provider `15`. Our route also does not send `provider_id` to LiteStock, so every provider id returns the same seven products. We need to ask Team 11 whether `provider_id` filters their data and which ids exist, and then store a mapping on our `workers` table.
2. **What the data is.** The items LiteStock returns are shop goods (beans, Colgate, a laptop), not repair materials. We need to confirm that this is the data our panel is meant to show.

## What we tested on purpose

| Test | Result |
|---|---|
| Direct call to the real partner with our key (`curl`, 2026-11-04) | 200, 7 inventory items, about 1.4 seconds. |
| Our route before the key fix | The partner returned 401, because no key was sent (bug 5). |
| Our route on our own machine after the fixes | 200 with `data` (7 items), `stale: false` and `asOf`. `stock_quantity` appears as `quantity`. |
| Our deployed route (Railway), first call after a quiet period | 502 (bug 10). |
| Our deployed route a few minutes later | 200 with the same 7 items, `stale: false`. |
| Against the stand-in (2026-10-28): partner stopped | The panel showed a friendly "inventory is unavailable" message and the rest of the page still worked. Our server stayed up and logged `partner call failed: ECONNREFUSED`. |
| Against the stand-in: partner restarted | Data came back after a page reload, with no code change. |

Not yet tested against the real partner: a wrong key, an unknown provider id, and the `stale: true` path.

## Part E: our downstream partner

Team 13 (HospitalQ) calls our API, which requires an `X-API-Key` header and allows 100 requests per minute per key.

[Write here what actually happened with Team 13: when they received their key, what they called, and any 401, 404 or 429 responses or bug reports. Delete this line when done.]

## Collaboration

When we asked our upstream partner for their base URL, the link they first gave us did not work. They later gave us the working URL, which is how we moved from the stand-in to their real API.
