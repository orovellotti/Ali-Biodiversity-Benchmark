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
  ⚠️ **Dry-run does NOT validate the model id against the provider API** — it skips the real call. A wrong/deprecated default model name passes dry-run + typecheck but then 404s on every question in a real run (the run still "completes" but that model shows nErrors == nQuestions and a null score). Always confirm the model id against the live model list before trusting a real run.
- Confirm the model id exists for THIS account: `curl -s https://api.anthropic.com/v1/models -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01"` (OpenAI: `GET https://api.openai.com/v1/models`). **Why:** this account is on the Claude **4.5** family (e.g. `claude-haiku-4-5-20251001`, `claude-sonnet-4-5-20250929`) — the older `claude-3-5-haiku-*` ids 404. Don't assume legacy Anthropic model names exist.
- `pnpm --filter @workspace/api-server run typecheck` + `--filter @workspace/benchmark-ui run typecheck`.
- Restart the api-server workflow (PROVIDER_DEFS is module-level), then `curl localhost:80/api/benchmark/config` to confirm the new id shows `available: true`.

**Cost note:** every extra model added to a run multiplies spend — it adds both
answer-generation calls AND judge-scoring calls (models × questions each). The
`BENCHMARK_MAX_REQUESTS_PER_RUN` ceiling counts both.

## Provider availability on THIS account (June 2026)

- **Gemini key has ZERO quota** (`generate_content_free_tier_requests, limit: 0`) → every gemini call 429s `RESOURCE_EXHAUSTED`. Cannot benchmark Gemini until the user enables paid billing on their Google AI project. Don't waste a run on gemini until that's fixed — verify with a single live call first.
- OpenAI, Anthropic (4.5 family), Mistral (`mistral-large-latest`) all work. Mistral scored highest in the reference run.

## OpenRouter provider family (one integration, many small open-weight models)

Added 5 small open-weight models (Llama 3.2 3B/1B, Qwen2.5 7B, Ministral 8B, Gemma 3 4B) via **Replit AI integration `openrouter`** — provisioned env-vars-only (`setupReplitAIIntegrations(openrouter)` → `AI_INTEGRATIONS_OPENROUTER_BASE_URL` + `AI_INTEGRATIONS_OPENROUTER_API_KEY`). Skip ALL the TS chat scaffolding it offers (DB tables/routes); the Python subprocess just inherits these two env vars via `env: process.env`.

- One `OpenRouterProvider` (OpenAI SDK pointed at the proxy base_url) + one named subclass per model id. All 5 share the SAME integration key — that's expected, not a leak.
- **Gotcha: availability needs BOTH env vars.** The Python provider init requires the key AND the base URL, but the TS `available` check originally only tested the key. Gate OpenRouter `available` on both (`providerAvailable` in config.ts) so the UI can't show "available" while Python fails to init.
- **PARAM_RULES ordering matters for dashed ids:** put the more specific id first — `llama-3.2-1b` MUST precede `llama-3.2` or 1B gets matched as 3B. SIZE_RULES classifies all of these as `small`.
- These models DO publish param counts (open-weight) so PARAM_RULES gives them a "· 8B/7B/4B/3B/1B" tag; proprietary models never get a number (don't fabricate).
- Reference-run result (20 questions): ministral-8b topped the WHOLE board at 96.6 (> mistral-large 96.25); llama-3.2-1b was the floor at 62.9. All 5 ran with 0 errors via the proxy.
