---
name: Adding a benchmark model/provider
description: The full list of places to touch when adding an LLM provider (or a cheap "small" variant) to the biodiversity benchmark.
---

# Adding a model to the benchmark

The benchmark runs answers through the **Python CLI engine**, while the
**TS api-server** mirrors the provider list for the UI/validation. A new provider
id must be added in BOTH or it will be rejected or invisible.

## Easiest case: a "small" variant reusing an existing provider's key

The cheapest add is a smaller/weaker model from a provider you already have a key
for (e.g. `openai-small` = gpt-3.5, `anthropic-small` = Claude Haiku). Subclass the
existing provider and only override `name` + the default model. The parent's
`_get_client`/`is_available` hardcode the base provider's key, so the subclass
reuses the same key automatically.

## The 6 places to touch (mirror the `openai-small` pattern exactly)

1. `biodiversity-benchmark/providers/<x>_provider.py` — add a subclass with a new `name`.
2. `biodiversity-benchmark/providers/__init__.py` — import it + add to `PROVIDER_CLASSES`.
3. `biodiversity-benchmark/config.py` — add to `PROVIDER_API_KEYS` (drives `ALL_PROVIDERS`) AND `DEFAULT_MODELS` (BaseProvider reads the default from here).
4. `biodiversity-benchmark/main.py` — update the `--models` help string.
5. `artifacts/api-server/src/lib/benchmark/config.ts` — add a `PROVIDER_DEF`. `VALID_PROVIDERS` (used by runner.ts to validate run input) is derived from this, so no enum/codegen change is needed.
6. `artifacts/benchmark-ui/src/pages/home.tsx` — if it's a "baseline/weaker" model, add its id to the condition that renders the baseline note.

## What you do NOT need to touch

- `SIZE_RULES`/`PARAM_RULES` in config.ts are substring-matched on the model name — check the substring already exists (e.g. "haiku"->small) rather than adding the provider id.
- The OpenAPI spec models `providers` as a generic object array (no enum), so no Orval codegen run is required.
- Results aggregation, arena answer index, Elo leaderboard, and CSV export are all keyed by the model string dynamically — they handle any new provider id with no change.

## Verify

- `cd biodiversity-benchmark && python main.py --dry-run --models <id> --limit 2` (free, no API calls).
- `pnpm --filter @workspace/api-server run typecheck` + `--filter @workspace/benchmark-ui run typecheck`.
- Restart the api-server workflow (PROVIDER_DEFS is module-level), then `curl localhost:80/api/benchmark/config` to confirm the new id shows `available: true`.

**Cost note:** every extra model added to a run multiplies spend — it adds both
answer-generation calls AND judge-scoring calls (models × questions each). The
`BENCHMARK_MAX_REQUESTS_PER_RUN` ceiling counts both.
