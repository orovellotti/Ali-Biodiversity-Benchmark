---
name: Benchmark paid re-run operations
description: How to run + merge a full benchmark re-run safely, and the Gemini zero-quota gotcha that drops it from answers and judging.
---

# Running and merging a full benchmark re-run

## Ranking engine mechanics (why rank ≠ a per-row score)
- Scoring is **comparative**: the evaluator makes **one ranking-judge call per (question, judge)** that ranks **all models' answers to that question together** in a single prompt (`evaluator.evaluate_run` + `RankingJudge`). It is NOT a per-model independent score later sorted. → **`rank_in_question` cannot be recomputed from `overall_score` at merge time**; it only exists because models were judged head-to-head in the same call.
- Consequence for cost: judge calls = `judges × questions` (NOT `× models`) — adding models to a run does not multiply judge cost, only generation cost (`models × questions`).
- **Anti-self-eval:** a judge is excluded from scoring any model of its **same provider family** (e.g. the openai judge does not rank the openai model). So a model's effective judge panel can be smaller than the full panel; keep ≥2 judges of different families so every model is judged by ≥1.
- A genuinely fair all-models leaderboard therefore requires generating every model's answers on the same question set and running `evaluate_run` over all of them at once (one comparative ranking per question) — see the cross-context caveat below.

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
- `results.ts summarizeModels()` does **NOT** recompute ranks — it **averages the stored `rank_in_question`** into `meanRank` (primary sort, asc), with `overallScore` as the secondary tiebreaker; rows with null `rank_in_question` get `meanRank=null` and sort **after** all ranked models (then by score). So the merged leaderboard is only as fair as the stored ranks.
- **Why valid for same-context batches:** disjoint offset batches that all judged the SAME model set per question share one rank scale (1..N), so re-averaging meanRank over their union is sound.
- **Cross-context merge caveat (the "merge ALL models" trap):** `rank_in_question` is scale-dependent on how many models competed per question. Merging runs with different fields (e.g. a 3-model full-dataset run + a 13-model 20-question run) is NOT rank-comparable: the smaller-field models get low meanRank, the others either get a different-scale rank or (if their run predates the rank methodology) `null` rank and fall below — even when their raw `overallScore` is higher. A truly fair all-models leaderboard over the whole dataset requires a **re-judge of every model together on the same questions** (costs credits). Synthetic merged run `…-merged-all` demonstrates this two-tier outcome (big-3 ranked @106q; 10 open-weight/baseline models scored @20q, unranked).
