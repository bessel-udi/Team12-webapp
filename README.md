# QuickFundi API

QuickFundi connects clients with skilled fundis, including electricians, plumbers, and handymen. This API supports worker search, worker profiles and reviews, and maintenance bookings for Team 13 (HospitalQ).

## API Documentation

The OpenAPI 3.0 specification is in `openapi.yaml`. Swagger UI is provided in the `docs/` directory.

To view Swagger UI locally, start a local static web server from the repository root and open the `docs/` directory through that server. Do not open `docs/index.html` directly as a file, because the browser may block loading the API specification.

## Requirements

- Node.js and npm
- MySQL server
- A configured database containing the tables required by the API (see [Database setup](#database-setup))

## Run the API

From the repository root, open a terminal and run:

```bash
cd server
npm install
npm start
```

Locally the API listens on `http://localhost:5000` (the `PORT` value in `server/.env`). The deployed API is at `https://team12-webapp-production.up.railway.app`.

Health check (requires an API key, see [Authentication](#authentication)):

```bash
curl.exe -i -H "X-API-Key: <your-api-key>" http://localhost:5000/
```

Expected response: HTTP 200 and `QuickFundi API is running`.

## Environment configuration

The backend reads these variables from `server/.env`:

```env
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=your_database_name
DB_PORT=3306
PORT=5000
API_KEYS=replace-with-partner-key,replace-with-team-key
FRONTEND_ORIGINS=http://localhost:5173
PARTNER_URL=https://quickfundi-litestock-api.onrender.com
PARTNER_API_KEY=replace-with-the-key-your-partner-gave-you
```

- `API_KEYS`: keys that consumers of this API must send (see [Authentication](#authentication)).
- `FRONTEND_ORIGINS`: comma-separated list of website origins allowed to call the internal inventory route from a browser (see [Internal route](#internal-route-provider-inventory-no-api-key)).
- `PARTNER_URL` and `PARTNER_API_KEY`: the address and key for our upstream partner, LiteStock (`https://quickfundi-litestock-api.onrender.com`). The key is the one LiteStock issued to us. On the deployed server these are set as Railway variables.

Replace the example values with your own settings. See `server/.env.example` for a template. Do not commit real passwords, API keys, or other secrets: `.env` is listed in `.gitignore`.

## Database setup

The backend expects these tables and columns:

- `workers`: `id`, `name`, `job_type`, `location`, `rating`, `rate_per_hour`, `experience_years`
- `reviews`: `worker_id`, `author`, `comment`, `rating`
- `bookings`: `id`, `worker_id`, `job_type`, `location`, `scheduled_for`, `requested_by`, `status`, `created_at`

The repository includes `schema.sql` (creates the tables and 3 sample workers with reviews) and `seed.sql` (adds 5 more workers, 8 reviews and 6 bookings). On a fresh database:

```bash
mysql -u root -p -e "CREATE DATABASE your_database_name;"
mysql -u root -p your_database_name < schema.sql
mysql -u root -p your_database_name < seed.sql
```

Run each file once. Running them again adds the reviews a second time, and `schema.sql` fails on its duplicate worker ids.

## Authentication

Every endpoint requires a valid API key, with one exception: the internal inventory route described [below](#internal-route-provider-inventory-no-api-key). Send the key in the `X-API-Key` header on every request:

```bash
curl.exe -i -H "X-API-Key: <your-api-key>" https://team12-webapp-production.up.railway.app/workers
```

Keys are issued privately, one per consumer, so a single key can be revoked without affecting anyone else. Never commit a key or share it in a public channel. In examples, `<your-api-key>` is a placeholder; replace it with your own key.

**Generating keys (server owner):**

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

Put the keys in `server/.env` as a comma-separated list: `API_KEYS=key1,key2`. Restart the server after changing them.

A request with a missing or invalid key returns **401 Unauthorized** and never reaches the endpoint:

```json
{
  "message": "Missing or invalid API key"
}
```

## Rate limiting

Each API key may make **100 requests per minute**. Going over the limit returns **429 Too Many Requests** with a `Retry-After` header (in seconds) and a JSON body:

```json
{
  "message": "Too many requests",
  "retryAfter": 42
}
```

Wait `retryAfter` seconds before sending more requests. The limit is counted in server memory, so it resets if the server restarts.

## Staff accounts and materials (admin / fundi)

Materials in stock are **not shown to customers**. Only signed-in staff can see or change them, and the server enforces this (it is not just hidden on the page).

| Role | See materials | Take | Return | Create staff, see activity |
|---|---|---|---|---|
| Customer (no account) | No | No | No | No |
| Fundi | Yes | Yes | Only items they took themselves | No |
| Admin | Yes | Yes | Anyone's (to correct mistakes) | Yes |

Staff sign in with a username and password. The server records **who** took each item from the sign-in, not from anything typed into the page.

### First-time setup

Add these to `server/.env` (see `server/.env.example`):

```env
AUTH_SECRET=<random 64-character value>
ADMIN_USERNAME=<your admin username>
ADMIN_PASSWORD=<at least 8 characters>
ADMIN_NAME=<display name>
```

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

On the first start the server prints `Created first admin account`. Remove `ADMIN_PASSWORD` from the file afterwards: the account stays in the database. Keep `AUTH_SECRET`. The admin can then add fundi accounts from the staff panel on any worker page (**Staff sign in** link).

### Endpoints

| Method | Endpoint | Who | Purpose |
|---|---|---|---|
| POST | `/staff/login` | anyone (8 attempts/minute) | Sign in, returns a session token (valid 8 hours) |
| POST | `/staff` | admin | Create a fundi or admin account |
| GET | `/staff/activity` | admin | Latest 30 takes and returns |
| GET | `/provider-inventory/{id}` | admin, fundi | Materials in stock |
| POST | `/provider-inventory/{id}/take` | admin, fundi | Take materials |
| POST | `/provider-inventory/{id}/return` | admin, fundi | Return materials |

```bash
curl.exe -i -X POST "http://localhost:5000/staff/login" -H "Content-Type: application/json" -d "{\"username\":\"james\",\"password\":\"<your-password>\"}"

curl.exe -i "http://localhost:5000/provider-inventory/15" -H "Authorization: Bearer <your-token>"

curl.exe -i -X POST "http://localhost:5000/provider-inventory/15/take" -H "Authorization: Bearer <your-token>" -H "Content-Type: application/json" -d "{\"productId\":18,\"quantity\":2}"
```

Responses: `401 {"message":"Please sign in"}` (no or expired token), `403` (signed in but not allowed, for example a fundi calling an admin route), `409` (not enough stock, or returning more than you hold), `503` (live stock unavailable, so nothing can be taken). Quantities must be whole numbers from 1 to 100.

How the numbers work: Team 11's stock is read-only for us, so this app keeps its own record of what staff have taken. **Available** = Team 11's count minus what staff currently hold, and the low-stock level is 10.


## Internal route: provider inventory (no API key)

`GET /provider-inventory/{providerId}` is used by QuickFundi's own website to show the materials a provider has in stock, taken from our upstream partner LiteStock. It is internal: it is not part of the contract for API consumers such as HospitalQ and is not listed in `openapi.yaml`.

It is deliberately open without an API key so that our partner's key never reaches the browser. The website calls this route, and our server adds the partner key when it calls LiteStock. To limit the risk of leaving it open:

- **Rate limit:** 30 requests per minute per IP address (429 with a `Retry-After` header when exceeded).
- **CORS:** browsers only allow the origins listed in `FRONTEND_ORIGINS`.
- **Validation:** `providerId` must be a positive whole number, otherwise 400.
- **Minimal output:** only `product_id`, `name`, `category`, `quantity` and `status` are returned for each item. The partner's response is checked before it is passed on, and `stock_quantity` is mapped to `quantity`.
- **Resilience:** each call to LiteStock has a 5 second timeout and up to 3 attempts. If every attempt fails, the last successful response for that provider is returned with `"stale": true`. If none exists yet, the route returns 502.

```bash
curl.exe -i http://localhost:5000/provider-inventory/15
```

Example response (trimmed to two items):

```json
{
  "data": [
    { "product_id": 20, "name": "Beans (per Kg)", "category": "Grains", "quantity": 83, "status": "in_stock" },
    { "product_id": 18, "name": "Laptop", "category": "Electronics", "quantity": 9, "status": "low_stock" }
  ],
  "stale": false,
  "asOf": "2026-11-05T12:35:25.803Z"
}
```

- `data`: the inventory items.
- `stale`: `false` for fresh data from LiteStock, `true` when LiteStock could not be reached and the last successful copy is returned.
- `asOf`: when that data was fetched from LiteStock.

Errors: `400` invalid provider ID, `404` provider not found in LiteStock, `429` rate limit exceeded, `502` LiteStock is unavailable (or returned an unexpected response) and no earlier copy exists. LiteStock runs on a free hosting plan that sleeps when idle, so the first request after a quiet period can fail with 502; the next request normally succeeds.

## Base URL

`https://team12-webapp-production.up.railway.app`

## Endpoints

All endpoints require the `X-API-Key` header, except the internal inventory route.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Check whether the API server is running |
| GET | `/workers` | Search/list workers; optionally filter by job type and location |
| GET | `/workers/{id}` | Retrieve a worker profile and reviews |
| POST | `/bookings` | Create a booking |
| GET | `/bookings/{id}` | Retrieve booking details and status |
| PATCH | `/bookings/{id}` | Reschedule a booking |
| DELETE | `/bookings/{id}` | Cancel a booking |
| GET | `/provider-inventory/{providerId}` | Materials in stock for a provider (internal, no key) |

### 1. Search workers

```bash
curl.exe -i -H "X-API-Key: <your-api-key>" "https://team12-webapp-production.up.railway.app/workers?jobType=electrician&location=Upper%20Hill"
```

Both `jobType` and `location` are optional filters, and each must be a single value. Valid job types used by the booking route are `electrician`, `plumber`, and `handyman`.

A successful response is a JSON array of worker summaries, with fields such as `id`, `name`, `jobType`, `location`, `rating`, and `ratePerHour`.

### 2. Retrieve a worker profile

```bash
curl.exe -i -H "X-API-Key: <your-api-key>" "https://team12-webapp-production.up.railway.app/workers/wk_1042"
```

A successful response includes worker details, `experienceYears`, and a `reviews` array. If the worker does not exist, the route returns HTTP 404 with a `WORKER_NOT_FOUND` error.

Replace `wk_1042` with an ID that exists in your database.

### 3. Create a booking

```bash
curl.exe -i -X POST "https://team12-webapp-production.up.railway.app/bookings" -H "X-API-Key: <your-api-key>" -H "Content-Type: application/json" -d "{\"workerId\":\"wk_1042\",\"jobType\":\"electrician\",\"location\":\"Nairobi Hospital, Ward 4\",\"scheduledFor\":\"2026-11-15T09:00:00Z\",\"requestedBy\":\"HospitalQ Facilities Desk\"}"
```

Required JSON fields, all of which must be strings:

- `workerId`
- `jobType`
- `location`
- `scheduledFor`
- `requestedBy`

A successful request returns HTTP 201 and the created booking details, including its generated ID (a random value such as `bk_9f2a41c7d3b8e605`) and status. Use a worker ID that exists in your database.

### 4. Check a booking

```bash
curl.exe -i -H "X-API-Key: <your-api-key>" "https://team12-webapp-production.up.railway.app/bookings/bk_9f2a41c7d3b8e605"
```

Replace `bk_9f2a41c7d3b8e605` with the ID returned when you create a booking. A successful response returns the booking details and status.

### 5. Reschedule a booking

```bash
curl.exe -i -X PATCH "https://team12-webapp-production.up.railway.app/bookings/bk_9f2a41c7d3b8e605" -H "X-API-Key: <your-api-key>" -H "Content-Type: application/json" -d "{\"scheduledFor\":\"2026-11-16T09:00:00Z\"}"
```

The request body must contain a valid `scheduledFor` date/time. A successful request returns HTTP 200 and the updated booking. A missing or invalid date returns HTTP 400; a missing booking returns HTTP 404; a completed booking returns HTTP 409.

### 6. Cancel a booking

```bash
curl.exe -i -X DELETE "https://team12-webapp-production.up.railway.app/bookings/bk_9f2a41c7d3b8e605" -H "X-API-Key: <your-api-key>"
```

A successful cancellation returns HTTP 204 with no response body. A missing booking returns HTTP 404. A completed booking returns HTTP 409.

Use an existing booking ID when testing these endpoints.

## Error responses

Errors returned by the routes use a JSON object with `code` and `message` fields. Examples include:

```json
{
  "code": "BOOKING_NOT_FOUND",
  "message": "No booking found with id bk_9f2a41c7d3b8e605"
}
```

Authentication, rate-limit and internal-route errors (401, 429 and the inventory route's errors) use a `message` field only, as shown in the sections above.

Common status codes:

- `200 OK`: request succeeded
- `201 Created`: booking created
- `204 No Content`: booking cancelled
- `400 Bad Request`: invalid booking or reschedule input, or a request body that is not valid JSON
- `401 Unauthorized`: missing or invalid API key
- `404 Not Found`: worker, booking, or route does not exist
- `409 Conflict`: operation is not allowed for a completed booking
- `429 Too Many Requests`: rate limit exceeded (100 per minute per key, or 30 per minute per IP on the inventory route)
- `500 Internal Server Error`: database or server-side operation failed
- `502 Bad Gateway`: the partner's API (LiteStock) is unavailable and no earlier copy of its data exists (inventory route only)

## Notes for testing

- Start the API before running the curl commands.
- Include a valid `X-API-Key` header on every request except the inventory route, or you will get 401.
- Ensure MySQL is running and the database is configured before testing database-backed endpoints.
- Use IDs that exist in your database; example IDs in this README are placeholders unless they have been seeded.
- The health-check endpoint does not require a database query, so it can help confirm that the server has started and that your key works.
- To test the inventory route, set `PARTNER_URL` and `PARTNER_API_KEY` to the real LiteStock values. Their service may take up to a minute to wake up if it has been idle, so call it once before a demo.
- The stand-in in `server/mock-partner.js` can be used when LiteStock is down, but it must return the same shape as the real API: an `inventory` array whose items have `name`, `category`, `stock_quantity` and `status`.
- To run the automated tests: `cd server && npm test` (the database must be reachable).


## Monitoring: `GET /stats`

Returns running totals since the server started. It needs an API key, like every other endpoint.

```
curl -s -H "X-API-Key: <your-api-key>" http://localhost:5000/stats
```

Example response (trimmed):

```json
{
  "uptimeSeconds": 485,
  "total": 260,
  "clientErrors": 109,
  "serverErrors": 98,
  "errorRatePercent": 37.7,
  "avgMs": 163.2,
  "routes": {
    "GET /provider-inventory/:id": { "count": 29, "clientErrors": 0, "serverErrors": 1, "avgMs": 1447.6, "maxMs": 15646.8 }
  }
}
```

The numbers live in memory and reset when the server restarts. `errorRatePercent` counts 5xx errors only. The `(no route)` row holds requests rejected before reaching a route (401, 429, and 404 for unknown paths).
