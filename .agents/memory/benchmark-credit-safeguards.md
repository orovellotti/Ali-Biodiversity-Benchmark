---
name: Benchmark credit safeguards
description: Why launching a benchmark run is gated, and the non-obvious rule that cost estimates must include judge calls.
---

# Credit safeguards on launching a benchmark run

Launching a run can drain LLM API credits, so `createRun` is gated by two server-side guards (a concurrency lock → 409, and a hard request ceiling → 400). The UI mirrors both. Full mechanics live in `replit.md` ("Credit safeguards on launching a run").

## The non-obvious rule: estimates must count judge calls, with the RIGHT multiplier

**Rule:** Any "estimated API requests" / cost figure for a real run must count BOTH answer-generation calls AND judge calls. The multipliers differ:
- Answer calls = `models × questions`.
- Judge calls = `judges × questions` (the COMPARATIVE judge ranks ALL models' answers for a question in ONE call, so it scales with the judge-panel size, NOT the model count). This replaced the older absolute judge that billed one call per answer (`models × questions`).

**Why:** The whole point of the safeguard is protecting credits. Counting answers only undercounts billable spend; counting judges with the wrong multiplier (per-answer instead of per-judge) overcounts under the comparative scheme. Either way the cap disagrees with reality.

**How to apply:** Keep the server cap (`runner.ts`), the UI estimate (`home.tsx`), and `config.judgeCount` in lockstep. `judgeCount`/`judgeAvailable` MUST derive judge env keys from `PROVIDER_DEFS` (single source of truth), not a hardcoded subset — otherwise a `BENCHMARK_JUDGES` override naming providers like `openai-small` or OpenRouter ids resolves to a null key, reports 0 judges, and the guard undercounts paid judge calls. Parse `BENCHMARK_JUDGES` by splitting on the FIRST colon (mirrors Python `str.partition(":")`) so colon-bearing model names (e.g. `ollama:llama3.1:70b`) survive. Dry-run is free and skips the ceiling entirely.

## Scope caveat

The concurrency lock is single-process only (filesystem `listRuns()`, synchronous, no DB). Fine for the current single-instance deployment. If this ever goes multi-instance, it needs a cross-process lock (atomic lockfile or centralized lock).
