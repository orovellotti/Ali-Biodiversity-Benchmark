---
name: Benchmark credit safeguards
description: Why launching a benchmark run is gated, and the non-obvious rule that cost estimates must include judge calls.
---

# Credit safeguards on launching a benchmark run

Launching a run can drain LLM API credits, so `createRun` is gated by two server-side guards (a concurrency lock → 409, and a hard request ceiling → 400). The UI mirrors both. Full mechanics live in `replit.md` ("Credit safeguards on launching a run").

## The non-obvious rule: estimates must count judge calls, not just answers

**Rule:** Any "estimated API requests" / cost figure for a real run must count BOTH answer-generation calls (`models × questions`) AND judge-scoring calls (another `models × questions` when `!noEval && judgeAvailable()`). Counting answers only undercounts real billable spend by ~2x.

**Why:** The whole point of the safeguard is protecting credits. An evaluated run makes one judge call per answer, so a config that looks "under cap" on answers alone can cost double and blow the intended budget. This was the one gap a code review caught.

**How to apply:** Keep the server cap (`runner.ts`) and the UI estimate (`home.tsx`) in lockstep — if you change how one counts requests, change the other, or the disable/warn state will disagree with the server's 400. Dry-run is free and skips the ceiling entirely.

## Scope caveat

The concurrency lock is single-process only (filesystem `listRuns()`, synchronous, no DB). Fine for the current single-instance deployment. If this ever goes multi-instance, it needs a cross-process lock (atomic lockfile or centralized lock).
