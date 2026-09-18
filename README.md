# Toto Kids Studio 7.15 Alpha — Canonical Source + Resilience Development

This repository contains the canonical **Railway deployment source** restored from Toto Kids Studio / Soly Gateway 7.14.1, plus the reviewed 7.15 resilience development.

> Repository visibility note: GitHub currently reports this repository as **public**. No runtime secret, API key, OAuth token, private key, or credential value may be committed here.

- Canonical production baseline: `7.14.1-alpha.1`
- Current development version: `7.15.0-alpha.1`
- Clean Recovery v2 SHA256: `4a905092d2c27845a6a40dc02bd292574b051ae1506370c629d66b4ff66494af`
- Verified live Railway backend archive SHA256: `d3768c93c144832f58f208a8d0bac42d03ed3f0e18bd0194d5020c82508b910e`
- Verified live Railway runtime archive SHA256: `9f050337b2095eb7e8108d9475da39788829ada0f92435c489eac7469386125c`
- Verification before canonicalization: tests `132/132`, engine tests `5/5`, gateway Node syntax passed.
- Verified GitHub-source production candidate: `soly-gateway-source-7-14-1` (`https://soly-gateway-source-7-14-1-production.up.railway.app`).
- Last clean-source validation deployment: `49f1cc2d-28be-4bc0-b8d2-7f6fa7890dc6` from commit `751db63211deac8a4544eb48cbb9f6c0f3b20b1d` — `SUCCESS`, internal `/health` passed, external GitHub Actions smoke passed, version `7.14.1-alpha.1`.
- Traffic cutover completed: the compatibility endpoint `soly-gateway-7-14-production.up.railway.app` now proxies to the canonical GitHub-source service `soly-gateway-source-7-14-1`.
- AppDeploy remains the temporary legacy media bridge during cutover.

## Canonical deployment scope

The source used to reproduce the Railway gateway is readable and reviewable:

- `package.json`
- `Dockerfile`
- `railway.toml`
- `backend/`
- the exact four transitive runtime modules under `src/services/` required by the gateway

The full 243-file Studio workspace is preserved separately in the verified CLEAN RECOVERY v2 package. Historical archives, temporary connector checks, deploy-trigger files and the old Base64 bootstrap bundle are intentionally excluded from this deployment repository.

## 7.15 development safety

The 7.15 branch adds durable work continuity, bounded self-repair for safe idempotent tasks, educational/originality checks, cost-aware model routing infrastructure, vertical short-form planning, stronger CI, and the Soly Focus Control UI.

Self-repair is deliberately bounded: it must not auto-retry paid work, external writes, permission failures, privacy blocks, schema errors, or secret-vault failures.

## Deployment safety

The linked Railway source service is manual-deploy-only. GitHub maintenance is **not** permission to deploy. Secrets and runtime credentials must never be committed.

## Post-cutover validation

- Compatibility proxy deployment: `ded0adc5-19a1-477a-bcde-3bc7df6c8414` — `SUCCESS`.
- Canonical source deployment after public-base alignment: `553b89b8-9beb-4469-826c-f6c1404e706b` — `SUCCESS`.
- Railway `/health` succeeded on both layers.
- External smoke through the preserved public endpoint returned HTTP `200` for `/health`, HTTP `200` for `/v1/oauth/status`, and HTTP `204` for `OPTIONS /v1/tools/execute`.
- `SOLY_PUBLIC_BASE_URL` on the canonical service points to the preserved compatibility endpoint so OAuth callbacks keep the established public base URL.
- The compatibility service is retained as a lightweight proxy / rollback boundary; the application runtime now executes on the GitHub-source service.

## Shared-variable migration

- Canonical runtime variables were detached from the compatibility proxy and moved to Railway environment-level Shared Variables.
- The canonical service now references `shared.*` values for runtime configuration and the vault key.
- A fresh canonical deployment after clearing the legacy proxy variables completed successfully: `9c76b8ae-3397-4db5-88ca-96b1e4ec2059`.
- Legacy compatibility proxy deployment after cleanup completed successfully: `513fd31c-37a3-4d53-9c00-f99b247dda3a`.
- All legacy `SOLY_BOOTSTRAP_*` and `SOLY_RUNTIME_*` payload values, plus duplicated runtime/secret values on the proxy, were cleared. The Railway OAuth connector cannot delete variable keys, so the old keys may remain visible as empty entries in the dashboard; their payload contents are removed.
- The compatibility proxy retains only the active routing variables `SOLY_CANONICAL_UPSTREAM` and `SOLY_CUTOVER_REVISION` with meaningful values.
- External verification after cleanup passed for both public endpoints, OAuth status, and the preserved AppDeploy CORS origin.
