---
name: Benchmark paid re-run operations
description: How to run + merge a full benchmark re-run safely, and the Gemini zero-quota gotcha that drops it from answers and judging.
---

# Running and merging a full benchmark re-run

## Launching
- Launch runs via `POST /api/benchmark/runs` with `Authorization: Bearer $BENCHMARK_ADMIN_PASSWORD`. Body: `{models:[...], offset, limit, dryRun, noEval}`.
- Only ONE run may be active at a time (concurrency lock → 409), so paid batches must be launched **sequentially**: launch, poll `GET /runs/:id` until `status==="completed"`, then launch the next.
- Phases are `query` (answer generation, total = models×questions) then `evaluate` (judging, total = judges×questions). The reported `total` switches between phases.

## The Gemini zero-quota gotcha
- **A free-tier `GEMINI_API_KEY` has quota `limit: 0` for `gemini-2.0-flash`** → every call returns HTTP 429 `RESOURCE_EXHAUSTED`. Gemini then can neither **answer** (rows come back empty → `rankInQuestion=null`, excluded from leaderboard) nor **judge** (panel silently drops to the remaining judges).
- **Why it matters:** dead-judge/answer calls still retry with exponential backoff (waits up to ~58s each), massively inflating wall-clock per batch and raising the idle-suspend/interrupt risk — for zero results.
- **How to apply:** if a provider's key is quota-dead, exclude it from BOTH the models list AND the judge panel. Drop it from judging by setting env `BENCHMARK_JUDGES` (e.g. `openai:gpt-4o,anthropic:claude-sonnet-4-5-20250929`) and restart `artifacts/api-server: API Server` so `config.judgeCount` and the Python subprocess (`env: process.env`) both see the smaller panel.

## Merging offset batches into one leaderboard
The results dashboard is **per-run** — it does NOT auto-aggregate across runs. A dataset split into offset batches therefore shows as N separate runs. To present ONE leaderboard over the whole dataset, build a synthetic merged run on disk:
- Create `biodiversity-benchmark/runs/<newId>/` (runId regex is `^[A-Za-z0-9_-]+$`).
- Concatenate every batch's `evaluated_results.jsonl` and `raw_results.jsonl` into the new dir (offsets are disjoint, so no dedup needed; drop rows of any unusable provider like quota-dead gemini).
- Write `meta.json` with `status:"completed"`, the real `models`, `questionCount`, timestamps; and `status.json` `{phase:"done", completed, total}`.
- `results.ts readRows()` reads `evaluated_results.jsonl` and **recomputes** ranks/meanRank across all rows, so the merged run yields a correct full-dataset leaderboard with no code changes.
- **Why valid:** each offset batch already judged all models together per question, so per-question rankings are intact; meanRank is just re-averaged over the union of questions.
