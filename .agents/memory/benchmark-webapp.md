---
name: Biodiversity benchmark web app
description: How the React/Express web front end wraps the Python benchmark CLI
---

# Biodiversity benchmark web app

A web UI (artifact `benchmark-ui` at `/`) + shared Express `api-server` wrap the
standalone Python CLI in `biodiversity-benchmark/`. UI/content is French (dataset
and CLI are French).

## Routes (wouter)
- `/` = explanatory landing page ("la démarche"), `/console` = the run config +
  history console, `/runs/:id` = run detail. The console used to live at `/`; if
  adding internal links to the console, point to `/console` (not `/`).
- Buttons that navigate must use `<Button asChild><Link/></Button>` (or `<a>`),
  never `<Link><Button/></Button>` — the latter nests interactive elements.

## How runs work
- The api-server spawns `python3 main.py` (cwd = `biodiversity-benchmark/`) with
  `--output-dir runs/<id> --progress-file runs/<id>/status.json` and the chosen flags.
- The CLI writes a machine-readable progress JSON via `--progress-file` (phases:
  query, evaluate, report, done — each with completed/total). This flag was added
  specifically for the web UI.
- Per-run `meta.json` (server-written) holds status/models/etc.; `status.json`
  (python-written) holds live phase/progress. The Run API merges the two.
- `runs/` is gitignored. On server start, runs left "running"/"queued" are marked
  "interrupted" (in-memory child Map is lost across restarts).

**Why:** the CLI is a local subprocess, so the live run is polled ~2s from the
frontend. The data-visualization skill's 5-minute refresh floor is for paid
warehouses and does NOT apply here — do not add staleTime:5min / auto-refresh
dropdowns to this app.

## Scoring quirk
`regulatory_hallucination_risk` is INVERTED: 5 = no hallucination risk (best),
0 = high risk. All other scores are 0-5 except `overall_score` (0-100). Charts
must label it so higher always reads as better.

## Gotchas
- OpenAPI YAML: a `description:` value starting with `""` or containing ` | ` is
  parsed as a YAML block scalar and breaks orval ("Failed to resolve input").
  Quote such descriptions or avoid `|`.
- Orval array-response collision: defining a top-level component schema that is an
  array (e.g. `ListXResponse: {type: array, items: ...}`) makes orval emit BOTH a
  zod const and a generated type with the same name, and `@workspace/api-zod`
  re-exports both → TS2308 "already exported a member". Fix: inline the array in the
  response (`type: array; items: $ref` directly under the 200 schema) like
  `/benchmark/runs` does; keep only the item as a named component schema.
- The actual model name per provider is chosen by the PYTHON CLI (`config.py`
  DEFAULT_MODELS), NOT the server. The server's `lib/benchmark/config.ts`
  defaultModel is display-only. Keep the two in sync, but fixing a bad model
  means editing `config.py`.
- Adding a new provider/model id touches FIVE places: (1) `config.py`
  PROVIDER_API_KEYS + DEFAULT_MODELS, (2) a provider class under
  `providers/` + register in `providers/__init__.py` PROVIDER_CLASSES,
  (3) `--models` help text in `main.py`, (4) server `config.ts` PROVIDER_DEFS
  (drives UI + VALID_PROVIDERS run validation), (5) optional UI label/note.
  OpenAI-compatible variants can subclass OpenAIProvider and just set a new
  `name` (the base looks up its key via `config.get_api_key(self.name)`).
- Gemini model names go stale fast: `gemini-1.5-flash` now returns 404 (model not
  found for v1beta generateContent). Verify against the live ListModels endpoint
  (`/v1beta/models?key=...`) before setting a default; `gemini-2.0-flash` works.
- Provider rate-limits make a real 50-question × 4-model run slow (~24s/req in the
  query phase, ~45 min, then a faster judge phase). Set expectations accordingly.
- Model "size" in ModelSummary is HEURISTIC, not real param counts (vendors don't
  publish them). `modelSize()` in server `config.ts` substring-matches the model
  name → qualitative French tier (Petit/Moyen/Grand), null if unknown. Computed at
  RESULTS READ TIME (results.ts summarizeModels), so historical runs get it free.
  Rule ORDER matters: more-specific substrings (gpt-4o-mini) must come before
  broader ones (gpt-4o) or minis get mislabeled Grand.

## Dataset taxonomy & swaps (V2 Discriminant)
The active dataset is a single JSON file (`{metadata, questions}`) chosen by
`datasetPath()` (TS) and the `--input` default in `main.py`. Swapping datasets =
change BOTH of those to the new filename.

- **topic vs section:** newer datasets (e.g. "V3 Discriminant" 100q (5 sections incl. moral_dilemmas)) have no
  `topic` field — they use `section`. Both layers treat the grouping dimension as
  `topic ?? section`: TS `topicOf(q)` in `dataset.ts` (topics/difficulties/
  questionTypes derived dynamically from the file — no hardcoded list; `config.ts`
  exposes `topics()`, `runner.ts` validates against it). Python `topic_of(q)` in
  `main.py`, and the record's `topic` field is WRITTEN as `topic_of(q)` so the UI
  filters and `summaryByTopic` (which key off row-level `topic`) keep working.
- **Taxonomy coupling trap:** any per-`question_type` analysis must match a SET
  covering all datasets, not a single literal. `report.py` had hardcoded
  `question_type == "arbitrage"`; V2 uses `tradeoff_and_bias_detection` →
  introduced `ARBITRAGE_QUESTION_TYPES`. On a dataset swap, grep `report.py` and
  `format.ts` for old taxonomy literals before assuming it works.
- **Knowledge-graph questions:** KG items carry `graph_context.triples`.
  `config.py.build_user_prompt(q)` takes the FULL question dict and injects the
  formatted triples + "répondre uniquement à partir du graphe" instruction;
  `build_judge_prompt` also embeds the graph for fidelity scoring.
  `format_graph_context` is defensive (non-dict / malformed → "").
