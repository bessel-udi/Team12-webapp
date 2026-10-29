# INTEGRATION_LOG.md

**Team:** Team 12 (QuickFundi)
**Upstream partner :** LiteStock API
**Downstream partner :** HospitalQ
**Date:** 2026-10-28

## Summary

Feature: a "Materials in stock" panel on the worker profile page (`/worker/:id`).

How it works: the React page asks our own server (`GET /provider-inventory/:id`). Our server calls LiteStock `GET /api/inventory?provider_id=<id>` with the partner key from `.env` and returns only `name`, `quantity`, `unit` and `status`. The partner key never reaches browser code.

Status: LiteStock's server was not available during the lab, so everything below was tested against a stand-in server (`server/mock-partner.js`) built from their `openapi.yaml`. When we switch to the real partner we have to change `PARTNER_URL` and `PARTNER_API_KEY` in `.env`.


## Bug and surprise log

| # | What broke (symptom) | Root cause | Fix | Whose code, and who fixed it |
|---|---|---|---|---|
| 1 | Could not make the first call (Part B): the partner's server was not running or reachable. | Partner's server was down during the lab. | Built `mock-partner.js` from their `openapi.yaml` (same paths, snake_case field names, 400/404 error shape). Our app points at it through `PARTNER_URL`. | Partner's server (not ready). Stand-in built by us. |
| 2 | Opening our app in the browser returned `{"message":"Missing or invalid API key"}`. | Our own Week 9 `requireApiKey` middleware protects every route, and a browser sends no key. | Placed the new route above `app.use(requireApiKey)` so our own page can call it without a key. The partner key stays on the server. Confirmed `/workers` still returns 401 without a key. | Our code. Fixed by us. |
| 3 | `/provider-inventory/15` returned `Partner data unavailable`. The server log said `partner call failed: ERR_INVALID_URL`. | `PARTNER_URL` was undefined. The new settings had been saved in `.env.example`, and there was no `.env` in `server/` (dotenv reported `injected env (0)`), so `API_KEYS` was missing too. | Created `.env` with `API_KEYS`, `PARTNER_URL` and `PARTNER_API_KEY`. Put only placeholders back in `.env.example`. Confirmed `injected env (3)` and restarted. | Our configuration. Fixed by us. |
| 4 | Browser console: `No routes matched location "/workers/1"`. | Wrong address typed. The route is `/worker/:id`; `/workers` is the list page. | Used `/worker/1`. | Ours (typo). |

## Open question for the partner

Our worker IDs and LiteStock's `provider_id` values are separate numbering systems. For the demo the profile page uses provider `15`. 

## What we tested on purpose

| Test | Result |
|---|---|
| First call to the stand-in with `curl.exe -H "X-API-Key: test-key" http://localhost:4000/api/providers/15` | 200 with provider John Mwangi, matching the contract. |
| Profile page with the partner running | The "Materials in stock" panel showed the inventory returned by the partner. |
| Partner stopped (stand-in killed with Ctrl+C) | Panel showed "Inventory is unavailable right now. Please try again later." The rest of the page still worked. Our server stayed up and logged `partner call failed: ECONNREFUSED`. |
| Partner restarted | Data came back after a page reload, with no code change. |


## Part E: our downstream partner


## Collaboration

When we asked our Upstream partner for their base URL the link they provided us did not work.
