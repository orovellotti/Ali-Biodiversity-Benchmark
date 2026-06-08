---
name: Biodiversity benchmark web app
description: How the React/Express web front end wraps the Python benchmark CLI
---

# Biodiversity benchmark web app

A web UI (artifact `benchmark-ui` at `/`) + shared Express `api-server` wrap the
standalone Python CLI in `biodiversity-benchmark/`. UI/content is French (dataset
and CLI are French).

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
- The actual model name per provider is chosen by the PYTHON CLI (`config.py`
  DEFAULT_MODELS), NOT the server. The server's `lib/benchmark/config.ts`
  defaultModel is display-only. Keep the two in sync, but fixing a bad model
  means editing `config.py`.
- Gemini model names go stale fast: `gemini-1.5-flash` now returns 404 (model not
  found for v1beta generateContent). Verify against the live ListModels endpoint
  (`/v1beta/models?key=...`) before setting a default; `gemini-2.0-flash` works.
- Provider rate-limits make a real 50-question × 4-model run slow (~24s/req in the
  query phase, ~45 min, then a faster judge phase). Set expectations accordingly.
