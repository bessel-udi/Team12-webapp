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
PARTNER_URL=http://localhost:4000
PARTNER_API_KEY=replace-with-the-key-your-partner-gave-you
```

- `API_KEYS`: keys that consumers of this API must send (see [Authentication](#authentication)).
- `FRONTEND_ORIGINS`: comma-separated list of website origins allowed to call the internal inventory route from a browser (see [Internal route](#internal-route-provider-inventory-no-api-key)).
- `PARTNER_URL` and `PARTNER_API_KEY`: the address and key for our upstream partner, LiteStock. For local testing they can point at the stand-in server in `server/mock-partner.js`.

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

## Internal route: provider inventory (no API key)

`GET /provider-inventory/{providerId}` is used by QuickFundi's own website to show the materials a provider has in stock, taken from our upstream partner LiteStock. It is internal: it is not part of the contract for API consumers such as HospitalQ and is not listed in `openapi.yaml`.

It is deliberately open without an API key so that our partner's key never reaches the browser. The website calls this route, and our server adds the partner key when it calls LiteStock. To limit the risk of leaving it open:

- **Rate limit:** 30 requests per minute per IP address (429 with a `Retry-After` header when exceeded).
- **CORS:** browsers only allow the origins listed in `FRONTEND_ORIGINS`.
- **Validation:** `providerId` must be a positive whole number, otherwise 400.
- **Minimal output:** only `name`, `quantity`, `unit` and `status` are returned for each item.

```bash
curl.exe -i http://localhost:5000/provider-inventory/15
```

Example response:

```json
[
  { "name": "PVC Pipe", "quantity": 25, "unit": "pieces", "status": "in_stock" },
  { "name": "Pipe Sealant", "quantity": 0, "unit": "tubes", "status": "out_of_stock" }
]
```

Errors: `400` invalid provider ID, `404` provider not found in LiteStock, `429` rate limit exceeded, `502` the partner's API is unavailable or returned an unexpected response.

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
- `502 Bad Gateway`: the partner's API (LiteStock) is unavailable (inventory route only)

## Notes for testing

- Start the API before running the curl commands.
- Include a valid `X-API-Key` header on every request except the inventory route, or you will get 401.
- Ensure MySQL is running and the database is configured before testing database-backed endpoints.
- Use IDs that exist in your database; example IDs in this README are placeholders unless they have been seeded.
- The health-check endpoint does not require a database query, so it can help confirm that the server has started and that your key works.
- To test the inventory route without the real partner, run the stand-in with `node server/mock-partner.js` and use `PARTNER_URL=http://localhost:4000` and `PARTNER_API_KEY=test-key`.
- To run the automated tests: `cd server && npm test` (the database must be reachable).
