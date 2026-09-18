# Toto Kids Studio — Project State

Updated: 2026-09-18
Working branch: `dev/7.15-focus-resilience`
Canonical baseline: `7.14.1-alpha.1`
Development version: `7.15.0-alpha.1`

## Rule of work

When a task is blocked:
1. Record the blocker.
2. Preserve the last verified state.
3. Move to the next independent task.
4. Do not deploy, publish, spend money, rotate secrets, or make destructive external changes without explicit approval.
5. Return to blocked items after other productive work is exhausted.

## Verified baseline

- Canonical source restored to GitHub.
- Main baseline commit: `b0daff956f3a4100041caca71fdcc2b7751d5a4e`.
- Existing architecture already includes:
  - word-timed lip-sync / viseme planning,
  - vision QA adapter,
  - AES-256-GCM OAuth vault,
  - tool contracts,
  - budget and approval guards,
  - circuit breaker behavior,
  - durable Supabase-backed storage support,
  - standalone Railway web UI,
  - YouTube public + analytics connectors,
  - AI/media compatibility routes.

## Current development package — 7.15 focus/resilience

### Implemented on branch
- [x] Durable work continuity engine.
- [x] Bounded self-repair guard.
- [x] Cost/capability-aware model router.
- [x] Educational quality/originality policy gate.
- [x] Node tests for all four modules.
- [x] GitHub Actions core resilience workflow.
- [x] Self-repair integrated into the central Gateway execution path for safe L0/L1 idempotent work.
- [x] Soly Focus Control UI connected to durable work sessions.
- [x] Strict web TypeScript check added before build.
- [x] Compatibility API TypeScript compile added to CI.

## Next actions

1. Finish the strengthened CI run (web typecheck + compatibility API compile) and fix any failure.
2. Review PR #2 end-to-end for regression, privacy and secret exposure.
3. Integrate model routing into real text/vision provider selection without enabling paid calls automatically.
4. Connect education-policy validation to clean export as a release gate.
5. Add malformed-provider-response chaos coverage.
6. Audit current public/private repository exposure and secret history before any new production deployment.
7. Merge through PR only after all checks are green. Deployment remains a separate explicit action.

## Reference priorities from the latest development review

- Improve production-grade lip sync, not just estimated timing.
- Dynamic model routing with budget awareness.
- Automated visual QA before export.
- Durable semantic memory for channel/content learnings.
- Harden credential isolation.
- Chaos testing for recovery paths.
- Enforce educational value and originality for children's content.
- Repurpose strong moments to vertical short-form outputs.

## Blockers / external limits

- Paid image/video generation must not be exercised automatically.
- External provider quota can fail independently of application correctness.
- A background assistant cannot literally keep executing while the chat session is inactive; continuity must therefore be preserved in code/state so work can resume deterministically.


## 7.15 verification log

- Core Resilience Check passed after the first resilience/UI integration.
- Web Build Check passed after Soly Focus Control was added.
- Additional strict checks were then added for web TypeScript and AppDeploy compatibility API TypeScript; latest runs must be green before merge.
- No deployment, publish, paid media generation, secret rotation, or production setting change is part of this development branch.
