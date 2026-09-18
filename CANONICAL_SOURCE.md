# Canonical Railway Source Manifest

Canonicalized: 2026-09-18
Version: `7.14.1-alpha.1`
Branch: `main`

## Provenance

- CLEAN RECOVERY v2 SHA256: `4a905092d2c27845a6a40dc02bd292574b051ae1506370c629d66b4ff66494af`
- Verified live Railway backend archive SHA256: `d3768c93c144832f58f208a8d0bac42d03ed3f0e18bd0194d5020c82508b910e`
- Verified live Railway runtime archive SHA256: `9f050337b2095eb7e8108d9475da39788829ada0f92435c489eac7469386125c`

## Byte-for-byte clean-recovery closure

The following Git blobs were compared against files extracted from CLEAN RECOVERY v2:

```
9a591c43f61779c4518a16456f3afcfc55f6d187  package.json
f20816b859a626ead9d63dcadb860372bc22c807  Dockerfile
6c60530781f04c3f24b4655e84fba118b8abd840  railway.toml
2e38143a2cb6e09397aaa539395186b900cf1475  backend/README.md
6a624682835db9fb86eee6b6bc414e54af4dda10  backend/accountAdapters.mjs
47b67bb25d722a481066a611c729fe53c0827060  backend/frameRenderer.mjs
4fdf0921c1ee4721658d89edd739f8248ae6e329  backend/lipSyncPlanner.mjs
5c9118deb4aa3bd183bb77f4b09a27e93676a77d  backend/oauthBroker.mjs
6c9ac5345b3c70b54a5fa92d7e6350e5019a2f28  backend/oauthVault.mjs
dbadffe8b426f5ed61d653e9c002ee474ffaa543  backend/solyGatewayCore.js
a70e4d8c0fe2e66457c60c7b4467a480db34d615  backend/solyGatewayServer.mjs
f4a8964d1360d9c4cdfe76326f1a995ceea05c15  backend/toolContracts.js
96720b9aeaff9516fb00fcc31c68a4edc39ca9d6  backend/visionQaAdapter.mjs
92b5c25d6d67fa3fc6af74ed66b819dda398a574  backend/workspaceStorage.mjs
84488437967c503cfca6a8d6340e03ceffee178d  src/services/composerTimeline.js
0b66e033cdc003a50d9ed4e3d3a5f1db6524910e  src/services/frameRenderer.js
fc8b23a80d4692eed06a83a25f59cce2deab49af  src/services/lipSyncTimeline.js
acfaf24bfd5c52d23a09431e75f8b0b33587f057  src/services/timelineEditor.js
```

These are the complete local modules in the Railway gateway's transitive import closure. The full Studio workspace remains in CLEAN RECOVERY v2 and is not duplicated into the deployment repo.

## Safety

The source-linked Railway service remains manual-only. No deployment is implied by canonicalization.

## Validated Railway source deployment

- Service: `soly-gateway-source-7-14-1`
- Public endpoint: `https://soly-gateway-source-7-14-1-production.up.railway.app`
- Deployment: `49f1cc2d-28be-4bc0-b8d2-7f6fa7890dc6`
- Source commit: `751db63211deac8a4544eb48cbb9f6c0f3b20b1d`
- Result: `SUCCESS`
- Railway healthcheck: `/health` succeeded
- External GitHub Actions smoke: succeeded; response matched `ok=true`, `service=soly-gateway`, `version=7.14.1-alpha.1`
- Runtime configuration is sourced from Railway environment-level Shared Variables; the canonical service no longer depends on the compatibility proxy for secret or runtime values.
- Automatic GitHub deployment remains disabled via manual-only watch pattern.
- `soly-gateway-7-14` remains available as the rollback / legacy traffic service until final cutover.

## Traffic cutover completed

- Cutover date: `2026-09-18`
- Canonical runtime service: `soly-gateway-source-7-14-1`
- Canonical source: GitHub `main`
- Preserved public compatibility endpoint: `https://soly-gateway-7-14-production.up.railway.app`
- Compatibility service now forwards traffic to `https://soly-gateway-source-7-14-1-production.up.railway.app`
- Proxy deployment: `ded0adc5-19a1-477a-bcde-3bc7df6c8414` — `SUCCESS`
- Canonical post-cutover deployment: `553b89b8-9beb-4469-826c-f6c1404e706b` — `SUCCESS`
- External post-cutover smoke: `SUCCESS` for legacy `/health`, canonical `/health`, legacy `/v1/oauth/status`, and legacy `OPTIONS /v1/tools/execute`
- Railway HTTP logs confirmed `200`, `200`, and `204` respectively through the preserved public endpoint.
- Automatic source deploy remains disabled via the manual-only watch pattern.

## Shared variables and legacy payload cleanup

- Migration completed: `2026-09-18`
- Shared runtime variables: `GOOGLE_PLAY_PRODUCTION_PUBLISH`, `NODE_ENV`, `SOLY_ALLOWED_ORIGIN`, `SOLY_DATA_DIR`, `SOLY_JOB_STORE_PATH`, `SOLY_STORAGE_DURABILITY`, `SOLY_TOKEN_VAULT_KEY`, `SOLY_TOKEN_VAULT_PATH`.
- `SOLY_TOKEN_VAULT_KEY` was rotated during migration. This was safe because runtime inspection confirmed Google and Microsoft OAuth were both disconnected and storage was ephemeral (`/tmp/soly-data`).
- Canonical proof deployment after clearing proxy-side values: `9c76b8ae-3397-4db5-88ca-96b1e4ec2059` — `SUCCESS`, `/health` succeeded, version `7.14.1-alpha.1`.
- Compatibility proxy cleanup deployment: `513fd31c-37a3-4d53-9c00-f99b247dda3a` — `SUCCESS`.
- Legacy Base64/runtime payload values were cleared from every `SOLY_BOOTSTRAP_*` and `SOLY_RUNTIME_*` key on the proxy, along with duplicated runtime configuration and vault values.
- Because the current Railway OAuth connector exposes variable set/update but not variable-key deletion, cleared legacy keys may remain visible as empty variable names. No Base64/runtime payload remains in those entries.
- Post-cleanup external verification succeeded on both the preserved compatibility endpoint and the canonical source endpoint; CORS remained `https://app-q1yi0z.v2.appdeploy.ai`.

## AppDeploy browser-origin E2E

- Browser-origin test completed successfully from `https://app-q1yi0z.v2.appdeploy.ai` to the preserved Railway compatibility endpoint.
- Real headless Chromium loaded the AppDeploy page, then executed a CORS `fetch` from the AppDeploy origin to `/health` on the Railway gateway.
- Result: HTTP `200`, service `soly-gateway`, version `7.14.1-alpha.1`.
- The compatibility proxy is intentionally retained as the rollback boundary until durable persistence migration is complete.

## Durable Supabase persistence

- Supabase project: `Toto Kids Studio Durable` (`khtqcadbfvmivqdswdkq`, `eu-west-1`).
- Durable store uses private `soly_kv` and `soly_blob_meta` tables plus private Storage bucket `soly-durable`.
- Access is mediated by the `soly-durable-store` Edge Function with a gateway-only shared key; anon/authenticated table access is revoked and RLS is enabled.
- Railway canonical service now uses `SOLY_DURABLE_ENDPOINT` and `SOLY_DURABLE_KEY` from Shared Variables.
- Jobs persist in Supabase KV; encrypted OAuth vault wrappers persist remotely; workspace assets and metadata persist in the private bucket/KV layer.
- Canonical deployment enabling durable persistence: `dbc9cfed-2af5-46ec-b2ba-494ebaa8cc0e` — `SUCCESS`.
- Restart proof deployment: `b8f135be-36e3-410b-8bac-c258a58c0c68` — `SUCCESS`, `/health` succeeded.
- Persistence proof: a job was written through the preserved public proxy, confirmed in Supabase, Railway was redeployed, then the same job was read successfully after restart. The proof job was removed afterward.
- AppDeploy browser-origin E2E remains verified; the compatibility proxy is intentionally retained as rollback while the durable layer settles.

## Standalone Railway web UI

- The AppDeploy React/Vite frontend was migrated into `web/` in the canonical GitHub repository.
- `@appdeploy/client` was removed from the standalone frontend; API calls now use the hosting origin.
- The canonical Railway Docker image builds the web app in a dedicated build stage and serves `web-dist` from the same Soly Gateway process.
- Standalone web deployment: `9221fa12-9dcd-4fa8-a6b3-7699fd2d815f` — `SUCCESS`.
- Preserved public URL now serves the standalone UI: `https://soly-gateway-7-14-production.up.railway.app/`.
- External smoke verified `/`, generated JS/CSS assets, and `/api/_healthcheck` successfully.
- GitHub Pages was not used because Pages for this private repository requires a paid/private-Pages entitlement; the repository remains private.
- AppDeploy can now be treated as a legacy/backup frontend while remaining AI media routes are migrated to the canonical Railway backend.

## AppDeploy AI route migration

- `GEMINI_API_KEY` is configured directly on the canonical Railway service `soly-gateway-source-7-14-1`.
- The AppDeploy API surface was migrated into `backend/appdeployCompatApi.mts`, compiled during the Docker build, and routed by the canonical Soly Gateway.
- AppDeploy SDK dependencies are replaced by `backend/appdeployShim.mjs`; generated media storage is backed by the Supabase durable store and served through `/api/media/*`.
- Migrated compatibility routes include capabilities, Director, TTS, Voice Lab, Quality Check, Dialogue, Transcribe, Lyrics Check, Music, Image, Video start/status, Dialect Variants, Safety Review, Metadata Pack, Postmortem, and Episode Plan.
- Text AI routing uses `gemini-3.5-flash-lite` by default for low-latency text tasks; TTS capability confirmed on `gemini-3.1-flash-tts-preview`.
- Canonical AI migration deployment `d8967b68-35d4-4bb6-a32e-d4d722c24b2e` completed `SUCCESS` and passed `/health`.
- API smoke through the preserved public URL confirmed: Google AI configured, 50 models visible, Director returned HTTP 200, TTS returned real PCM audio (~105 KB base64), and validation paths for Image, Video, and Transcribe returned expected 400 responses for empty payloads.
- Browser E2E confirmed the standalone Railway UI can click Director, receive director notes, click TTS, render an audio element, and read the standalone health endpoint successfully.
- Expensive Image/Video media generation was intentionally not invoked during migration smoke; their routes and input validation are wired, but a paid media generation call should be tested only when desired.
- AppDeploy is no longer required for the primary standalone UI, Director, or TTS path. It remains a legacy backup until all paid media-generation routes have been intentionally exercised.

## Media generation final validation

Date: 2026-09-18.

- Canonical Railway deployment `c659e57d-b65c-4997-acd5-4fda2b3caa02` from commit `176a86a1857d9e08967f3d9852b141c4279b4552` completed `SUCCESS` and passed `/health`.
- Hatchable backup version 3 is live and public at `https://toto-kids-studio.hatchable.site`; its deploy dry-run completed with zero errors and zero warnings.
- Transcription was exercised with real synthesized speech and returned the expected Egyptian Arabic text successfully.
- Gemini image request payload was updated to raw REST enum values for aspect ratio and image size; the resulting request is accepted structurally and now reaches provider quota enforcement.
- Lyria requests now explicitly ask for `AUDIO` + `TEXT`, using the provider default MP3 output.
- Veo Lite payload was corrected for current REST validation: numeric `durationSeconds` and no unsupported `numberOfVideos` field.
- Live media test outcome: Image returns HTTP 429 with a clear media quota message; Music falls back to text planning; Video falls back to an Animatic Plan. The application stays operational and does not crash when paid media generation is unavailable.
- Direct Gemini API probes confirm the active API key currently has zero/free-tier media generation quota for image/Lyria and cannot produce paid media until Google API billing/quota is enabled.
- This is an external account quota limitation, not a build, routing, Railway, Hatchable, Supabase, or frontend failure.
