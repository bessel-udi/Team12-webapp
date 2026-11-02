# Week 11: Resilience Lab Notes

## Part A: Before adding resilience

### Test results

| Mode | Measured result | What happened |
|---|---|---|
| Normal | 247.94 ms | The partner returned the tasks successfully. |
| Slow | 10,132.71 ms | The partner took about 10.13 seconds to respond. |
| Flaky | 503, 503, then 200 | The first two requests failed; the third succeeded. |
| Error | 500 Internal Server Error | The partner returned an error consistently. |

### Observations

The normal response took approximately 0.25 seconds. In slow mode, the response took approximately 10.13 seconds, making the user wait much longer. In flaky mode, the partner failed twice before succeeding on the third request. In error mode, the partner returned a 500 response every time. These tests show why the integration needs a timeout, controlled retries, and a graceful fallback.

## Part B: Adding a timeout

A 1.5-second timeout was added to the partner API fetch request using `AbortSignal.timeout(1500)`.

### Test result

| Test | Result |
|---|---|
| Partner mode | Slow |
| Partner's normal delay | Approximately 10 seconds |
| Configured timeout | 1,500 ms |
| Actual response time | 1,656.38 ms |
| HTTP status | 502 Bad Gateway |

### Observation

The timeout successfully prevented the application from waiting for the partner's full 10-second response. The backend returned a 502 error after approximately 1.66 seconds, demonstrating that the timeout works.

## Part C: Adding retries

A retry mechanism was implemented in `server/resilientFetch.js`.

### Configuration

- Timeout: 1,500 ms
- Maximum retries: 2 additional attempts
- Initial delay: 200 ms
- Exponential backoff: 200 ms, then 400 ms
- Retries only GET requests for specified retryable failures.

### Test result

| Attempt | Partner response | Action |
|---|---|---|
| 1 | 503 | Retry after 200 ms |
| 2 | 503 | Retry after 400 ms |
| 3 | 200 | Request successful |

### Observation

The retry mechanism successfully recovered from temporary partner API failures. The third attempt returned a successful response without requiring manual intervention.

## Part D: Fallback using lastGood

An in-memory cache using a `Map` was implemented to store the last successful inventory response for each provider.

### Test 1: Successful request

The mock partner was set to normal mode (`ok`).

QuickFundi successfully retrieved the following inventory items:

- Cement
- Paint

The successful response was saved in `lastGood`.

The backend returned `stale: false`, confirming that the data was fresh.

### Test 2: Partner failure

The mock partner was switched to error mode (`error`), causing it to return HTTP 500.

QuickFundi retrieved the previously cached inventory instead of returning an error.

### Test 3: Slow partner and cached fallback

The mock partner was switched to slow mode (`slow`).

The backend attempted the request, performed retries, and eventually timed out.

QuickFundi returned the previously cached Cement and Paint inventory.

The backend response contained:

- `data`: Previously cached inventory.
- `stale`: `true`.
- `asOf`: Timestamp of the last successful retrieval.

### Frontend demonstration

The Worker Profile page continued displaying the previously retrieved inventory while the partner was unavailable.

The frontend displayed the warning:

"Showing previously saved inventory. Live data is temporarily unavailable."

This confirmed that the frontend could distinguish between fresh inventory and cached inventory.

### Test 4: Partner failure without cached data

The backend was restarted to clear its in-memory cache. The mock partner remained in slow mode.

The next inventory request failed after the configured retries because there was no previously saved inventory to return.

The backend returned HTTP 502 Bad Gateway with:

`{"message":"Partner data unavailable"}`

The frontend displayed:

"Inventory is unavailable right now. Please try again later."

### Observation

The fallback mechanism worked successfully. QuickFundi remained able to provide previously retrieved inventory data when the partner API was unavailable. When no cached data existed, the application displayed a friendly unavailable message instead of leaving the inventory section blank.

## Part E: Integration with the real partner API

The resilience logic was connected to Team 11's deployed LiteStock API.

### Configuration

The partner API base URL was configured in the backend environment file:

`PARTNER_URL=https://quickfundi-litestock-api.onrender.com`

The QuickFundi backend requests inventory from the partner endpoint:

`GET /api/inventory`

A mapping was implemented to convert the partner's response fields into the format expected by QuickFundi.

### Test 1: Successful live integration

The initial request timed out because the configured 1,500 ms timeout was too short for the deployed partner service.

The timeout was temporarily increased to 10,000 ms for the live API test.

The request then succeeded and returned seven inventory products.

| Product | Quantity | Status |
|---|---:|---|
| Beans (per Kg) | 83 | in_stock |
| Colgate | 19 | in_stock |
| Laptop | 9 | low_stock |
| Maize Flour 2kg | 25 | in_stock |
| Omo 2Kg | 9 | low_stock |
| Pepsodent | 30 | in_stock |
| Sunlight | 20 | in_stock |

The backend returned `stale: false`, confirming that the response contained fresh partner data.

The real partner URL was subsequently restored, and another request successfully retrieved the live inventory.

### Test 2: Real partner outage

Team 11 temporarily stopped their deployed LiteStock API to allow testing of QuickFundi's resilience against an actual partner outage.

While the partner API was offline, the following request was executed:

`GET /provider-inventory/15`

The backend could not retrieve fresh inventory and used the previously cached inventory instead.

The response contained all seven previously retrieved products:

- Beans (per Kg)
- Colgate
- Laptop
- Maize Flour 2kg
- Omo 2Kg
- Pepsodent
- Sunlight

The backend returned:

- `data`: Previously cached inventory.
- `stale`: `true`.
- `asOf`: Timestamp of the last successful retrieval.

This confirmed that QuickFundi continued providing inventory data despite the actual partner API being unavailable.

### Test 3: Real partner recovery

Team 11 restored their deployed API after the outage test.

The same QuickFundi endpoint was called again:

`GET /provider-inventory/15`

The request successfully retrieved fresh inventory from Team 11's API.

The backend returned:

- Seven inventory products.
- `stale: false`.
- An updated `asOf` timestamp.

This confirmed that QuickFundi automatically resumed retrieving fresh inventory after the partner API recovered.

### Observation

The integration successfully retrieved live inventory data from Team 11's deployed API. The response mapping allowed QuickFundi to display the partner's inventory using its own expected data structure.

The actual partner outage and recovery tests also confirmed that the caching and fallback mechanisms worked with the deployed partner service, not only the mock server.

## Part F: Resilience evaluation and user experience

### 1. Failure test summary

| Failure scenario | What the user saw | What the backend log showed |
|---|---|---|
| Partner responds slowly | Previously cached inventory remained visible with a stale-data warning. | Two retry attempts followed by a timeout failure. |
| Partner returns intermittent errors (flaky mode) | Inventory was eventually retrieved successfully after retries. | Two 503 responses followed by a successful 200 response. |
| Partner returns consistent errors (error mode) | Previously cached inventory was returned when available. | Repeated HTTP 500 responses and retry attempts before failure. |
| Partner unavailable with no cached data | The frontend displayed "Inventory is unavailable right now. Please try again later." | Retry attempts followed by a timeout failure and a 502 response. |
| Actual Team 11 partner is stopped | Previously cached seven products remained visible. | Partner request failed, retries were attempted, and cached data was returned with `stale: true`. |
| Actual Team 11 partner is restored | Fresh inventory was retrieved and displayed again. | Partner request succeeded and returned fresh data with `stale: false`. |

### 2. Timeout and retry configuration

The following configuration was used:

- Request timeout: 1,500 ms.
- Maximum retries: 2 additional attempts for GET requests.
- Initial retry delay: 200 ms.
- Exponential backoff: 200 ms followed by 400 ms.
- Retryable HTTP statuses: 429, 500, 502, 503 and 504.
- Write requests are not automatically retried.

The initial tests measured a normal partner response of approximately 248 ms and a slow response of approximately 10,133 ms. A 1,500 ms timeout was selected to prevent QuickFundi from waiting for the partner's full response when it becomes unusually slow.

With two retries, the maximum expected wait using the configured timeout and delays is approximately 5.1 seconds:

- First attempt: 1,500 ms
- Second attempt: 1,500 ms
- Third attempt: 1,500 ms
- First retry delay: 200 ms
- Second retry delay: 400 ms

Total: approximately 5,100 ms, excluding additional processing overhead.

The retry delays increase exponentially to give the partner service time to recover without repeatedly sending requests immediately.

### 3. User experience without resilience

Without resilience handling, a user opening the Worker Profile page could experience a long wait while QuickFundi attempts to retrieve inventory from the partner API. If the partner is slow or unavailable, the inventory section might remain loading before eventually displaying an error.

The user would not be able to see previously retrieved inventory, even if that information had been available during an earlier successful request. This could interrupt the user's ability to review a provider's available products and quantities.

The user might have to refresh the page or return later to check whether the partner service has recovered.

### 4. Circuit breaker

A circuit breaker could temporarily stop requests to a partner API after repeated failures, allowing the service time to recover before QuickFundi attempts another request. This would reduce repeated unsuccessful requests and help prevent a failing partner service from affecting the rest of the application.

## Conclusion

The resilience implementation introduced request timeouts, controlled retries with exponential backoff, and an in-memory last-good fallback.

Testing demonstrated that QuickFundi could retrieve fresh inventory when the partner API was available, retry temporary failures, and serve previously cached inventory when the partner API became unavailable.

The frontend also displayed a stale-data warning when cached inventory was being used and a friendly unavailable message when no cached data existed.

The integration with Team 11's deployed LiteStock API successfully retrieved seven real inventory products. The actual partner outage and recovery tests confirmed that QuickFundi could continue serving cached inventory during partner downtime and automatically retrieve fresh data once the partner service was restored.

The implementation and resilience tests were completed successfully. The `.env` file containing environment configuration and API keys must not be included in the repository.