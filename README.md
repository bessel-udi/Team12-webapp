# QuickFundi API

QuickFundi connects clients with skilled fundis, including electricians, plumbers, and handymen. This API supports worker search, worker profiles and reviews, and maintenance bookings for Team 13 (HospitalQ).

## API Documentation

The OpenAPI 3.0 specification is in `openapi.yaml`. Swagger UI is provided in the `docs/` directory.

To view Swagger UI locally, start a local static web server from the repository root and open the `docs/` directory through that server. Do not open `docs/index.html` directly as a file, because the browser may block loading the API specification.

## Requirements

- Node.js and npm
- MySQL server
- A configured database containing the tables required by the API

## Run the API

From the repository root, open a terminal and run:

```bash
cd server
npm install
npm start
```

By default, the API listens at `https://team12-webapp-production.up.railway.app`.

Health check (requires an API key, see [Authentication](#authentication)):

```bash
curl.exe -i -H "X-API-Key: <your-api-key>" https://team12-webapp-production.up.railway.app/
```

Expected response: HTTP 200 and `QuickFundi API is running`.

## Database configuration

The backend reads these variables from `server/.env`:

```env
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=your_database_name
DB_PORT=3306
PORT=5000
API_KEYS=replace-with-partner-key,replace-with-team-key
```

Replace the example values with your local MySQL settings and your own generated API keys. See `server/.env.example` for a template. Do not commit real passwords, API keys, or other secrets: `.env` is listed in `.gitignore`.

The backend expects these tables and columns:

- `workers`: `id`, `name`, `job_type`, `location`, `rating`, `rate_per_hour`, `experience_years`
- `reviews`: `worker_id`, `author`, `comment`, `rating`
- `bookings`: `id`, `worker_id`, `job_type`, `location`, `scheduled_for`, `requested_by`, `status`, `created_at`

**Database setup note:** A SQL schema/seed file is not currently included in this repository. A working database with the required tables and compatible columns must be prepared before database-backed endpoints can be used.

## Authentication

Every endpoint, including the health check, requires a valid API key. Send it in the `X-API-Key` header on every request:

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

## Base URL

`https://team12-webapp-production.up.railway.app`

## Endpoints

All endpoints require the `X-API-Key` header.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/` | Check whether the API server is running |
| GET | `/workers` | Search/list workers; optionally filter by job type and location |
| GET | `/workers/{id}` | Retrieve a worker profile and reviews |
| POST | `/bookings` | Create a booking |
| GET | `/bookings/{id}` | Retrieve booking details and status |
| PATCH | `/bookings/{id}` | Reschedule a booking |
| DELETE | `/bookings/{id}` | Cancel a booking |

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

Authentication and rate-limit errors (401 and 429) use a `message` field only, as shown in the sections above.

Common status codes:

- `200 OK`: request succeeded
- `201 Created`: booking created
- `204 No Content`: booking cancelled
- `400 Bad Request`: invalid booking or reschedule input, or a request body that is not valid JSON
- `401 Unauthorized`: missing or invalid API key
- `404 Not Found`: worker, booking, or route does not exist
- `409 Conflict`: operation is not allowed for a completed booking
- `429 Too Many Requests`: rate limit of 100 requests per minute exceeded
- `500 Internal Server Error`: database or server-side operation failed

## Notes for testing

- Start the API before running the curl commands.
- Include a valid `X-API-Key` header on every request, or you will get 401.
- Ensure MySQL is running and the database is configured before testing database-backed endpoints.
- Use IDs that exist in your database; example IDs in this README are placeholders unless they have been seeded locally.
- The health-check endpoint does not require a database query, so it can help confirm that the server has started and that your key works.
- To run the automated tests: `cd server && npm test` (the database must be reachable).
