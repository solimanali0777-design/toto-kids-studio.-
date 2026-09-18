# Soly Gateway — server-side target

This folder is the production contract for the next deployment stage. Secrets must stay server-side.

Required endpoints:
- GET /health
- POST /v1/tools/execute
- POST /v1/jobs
- GET /v1/jobs/:id
- POST /v1/jobs/:id/approve

Gateway responsibilities: strict schemas, project scope, allowed targets, cost guard, rate limit, circuit breaker, audit log, OAuth/token handling, idempotency and provider adapters.
