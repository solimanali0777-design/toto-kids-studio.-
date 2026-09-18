# Toto Kids Studio — Project State

Updated: 2026-09-19
Working branch: `soly/7.15-night-shift`
Integration base target: `dev/7.15-resilience`
Canonical production baseline: `7.14.1-alpha.1` (preserve; no deploy/cutover)
Development version: `7.15.0-alpha.1`

## Rule of work
When a task is blocked:
1. Record the blocker.
2. Preserve the last verified state.
3. Move to the next independent task.
4. Do not deploy, publish, spend money, rotate secrets, or make destructive external changes without explicit approval.
5. External paid media/providers are never required for release-readiness verification; use local/free fallbacks.

## Verified baseline / completed checkpoints
- Durable work continuity and bounded self-repair.
- Cost/capability-aware routing and runtime zero-spend routing.
- Educational quality/originality and clean-export release gating.
- Zero-spend image/music/video fallbacks.
- Release-state consistency checks.
- Malformed-provider-response guards.
- Lip-sync Studio path with timing provenance, Mouth Rig geometry and FFmpeg filter rendering.
- Core resilience tests/workflow.

## Night-shift checkpoint
- PR #2 inspected at head `62d186435184e99f58aac9059abd95d8dd7e0836`.
- `Secret Scan` run #42: success.
- `Core Resilience Check` run #44: success.
- Connector did not report Web Build or Docker apibuild smoke runs for that head; do not infer they passed.
- Requested branch `soly/7.15-night-shift` did not exist and was created from the PR #2 head.
- Requested base `dev/7.15-resilience` did not exist and was created from the same head to preserve state.
- PR #2 currently remains Draft with head `dev/7.15-focus-resilience`; GitHub rejected retargeting it to `dev/7.15-resilience` because both refs currently contain identical commits. No merge/deploy/publish occurred.
- `SOURCE_OF_TRUTH.md` and `RELEASE_STATE.json` were not present at the inspected head, despite being named as expected inputs. Treat restoration/creation from verified repository evidence as the next release-readiness task; do not fabricate their contents.

## Next actions
1. Re-inspect PR #2 and all CI on its newest head, especially Core Resilience, Web Build, Secret Scan and Docker apibuild smoke.
2. Locate authoritative historical/canonical sources for `SOURCE_OF_TRUTH.md` and `RELEASE_STATE.json`; restore only from verified evidence.
3. Once `soly/7.15-night-shift` has an independent safe commit and the desired base topology is valid, align PR #2 without merging.
4. Continue independent release-readiness work under mandatory zero-spend rules.

## Safety boundary
No deployment, production cutover, merge, publish, paid media generation, billing enablement, credit purchase, or secret rotation is authorized in this branch.
