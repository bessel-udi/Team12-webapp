# BLIND TEST REPORT

## 1. General Information

- **System under test:** HospitalQ API
- **API version:** 1.0.0
- **Base URL:** `https://hospitalq-webapp.vercel.app`
- **Testing tools:** Windows PowerShell and `curl.exe`
- **Authentication status:** No valid API key was available to the testing group.

## 2. Objective

The objective of this test was to assess the availability of the deployed HospitalQ service, accessibility of its API documentation, and handling of requests made without valid API-key authentication. Tests were based on the available README and API documentation.

## 3. Test Results

| Test ID | Endpoint | Test Description | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| BT-01 | `GET /` | Check whether the deployed site is reachable | HTTP 200 and a response indicating the site is available | HTTP 200; HospitalQ HTML page returned | PASS |
| BT-02 | `GET /docs` | Check API documentation accessibility | HTTP 200 and documentation page returned | HTTP 200; Swagger UI HTML returned | PASS |
| BT-03 | `GET /openapi.yaml` | Check OpenAPI specification accessibility | HTTP 200 and OpenAPI YAML returned | HTTP 200; specification retrieved | PASS |
| BT-04 | `GET /api/departments` | Request departments without an API key | HTTP 401 Unauthorized | HTTP 401 Unauthorized | PASS |
| BT-05 | `GET /api/departments` | Request departments using an invalid API key | HTTP 401 Unauthorized | HTTP 401 Unauthorized | PASS |
| BT-06 | `GET /api/queue/invalid-test-id` | Request a queue without an API key | HTTP 401 Unauthorized | HTTP 401 Unauthorized | PASS |
| BT-07 | `GET /api/queue/invalid-test-id/stats` | Request queue statistics without an API key | HTTP 401 Unauthorized | HTTP 401 Unauthorized | PASS |
| BT-08 | `POST /api/auth/login` | Attempt login without an API key | HTTP 401 Unauthorized | HTTP 401 Unauthorized | PASS |
| BT-09 | `POST /api/queue` | Attempt queue creation without an API key | HTTP 401 Unauthorized | HTTP 401 Unauthorized | PASS |
| BT-10 | `GET /api/analytics/overview` | Request analytics without an API key | HTTP 401 Unauthorized | HTTP 401 Unauthorized | PASS |

## 4. Findings

### 4.1 Service Availability

The deployed root endpoint returned HTTP 200, indicating that the website was reachable during testing. The response contained the HospitalQ HTML page.

### 4.2 Documentation Availability

Both the `/docs` page and `/openapi.yaml` specification were accessible and returned HTTP 200. The documentation page was configured to load the OpenAPI specification using Swagger UI.

### 4.3 Authentication Enforcement

Requests made without an API key returned HTTP 401 Unauthorized. A request containing an invalid API key also returned HTTP 401 Unauthorized.

These results are consistent with the documented requirement that API requests must include a valid `X-API-Key` header.

### 4.4 Testing Limitations

The testing group did not have a valid API key. Consequently, successful authenticated requests could not be performed. The following behaviours remain unverified:

- Retrieving the department list using a valid API key.
- Retrieving queue information and queue statistics using a valid API key.
- Successful staff login and JWT generation.
- Queue-ticket creation using a valid API key and staff JWT.
- Accessing analytics using valid authentication.
- JWT validation and authorization behaviour with missing, invalid, or expired tokens.
- Rate-limiting behaviour when the documented request limit is exceeded.

## 5. Conclusion

The tests confirmed that the deployed HospitalQ website and API documentation were reachable during testing. All tested requests made without a valid API key returned HTTP 401 Unauthorized, consistent with the documented authentication requirement.

However, the successful operation of protected API endpoints could not be confirmed because the testing group did not have a valid API key. Further testing with authorized credentials is required to assess the functional behaviour of these endpoints and verify JWT authorization and rate limiting.

## 6. Recommendations

1. Provide the testing group with an authorized API key or an approved process for obtaining one.
2. Repeat the endpoint tests using valid credentials to verify successful responses.
3. Test staff authentication and JWT handling, including missing, invalid, and expired tokens.
4. Verify request validation, including invalid department IDs and missing required fields.
5. Test rate limiting and confirm that the documented HTTP 429 response and `Retry-After` header are returned when appropriate.

