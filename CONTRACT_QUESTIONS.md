# CONTRACT_QUESTIONS.md

Questions on the openapi.yaml received from Team 11 (LiteStock):

1. Scope mismatch: The contract's `info.description` states this API is
   for a "Strathmore University Lost & Found platform", yet its meant to be for QuickFundi and every endpoint
   (`/users`, `/users/{userId}/verification`, `/users/{userId}/role`,
   `/users/{userId}/contact`) is about user identity and verification. This
   doesn't match what we discussed in our Week 2 needs conversation, where
   Team 11 was described as an inventory/sales tracking system for tracking workers' tools and materials.

2. `role` enum mismatch between endpoints: `POST /users` only accepts
   `role: [student, security]` in the request body, but the shared `User`
   schema (returned by `GET /users/{userId}`) and `GET /users/{userId}/role`
   both include `administrator` as a valid role. Is there a separate
   process for creating administrator accounts, or should `POST /users`
   also accept `role: administrator`?

3. `phone` field is inconsistent across schemas: `POST /users` accepts
   an optional `phone` field in the request body, and
   `GET /users/{userId}/contact` returns a `phone` field — but the shared
   `User` schema (used by the `POST /users` response and by
   `GET /users/{userId}`) has no `phone` property at all. Is `phone`
   actually persisted when a user is created, and if so, why doesn't it
   appear in the main `User` object — only via the separate `/contact`
   endpoint?
