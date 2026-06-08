# Biodiversity Judgment Benchmark

A Python CLI (`biodiversity-benchmark/`) that benchmarks multiple LLMs (OpenAI, Anthropic, Mistral, Gemini, Ollama) against the 800-question biodiversity judgment dataset, scores answers with an OpenAI LLM-as-judge, and produces comparative CSV + Markdown reports.

## Biodiversity Benchmark (Python CLI)

- Lives in `biodiversity-benchmark/` — standalone, independent of the pnpm/TS workspace below.
- Run a quick check (no API calls): `cd biodiversity-benchmark && python main.py --dry-run --limit 5`
- Full run: `python main.py --models openai,anthropic,mistral,gemini --limit 50`
- Requires `OPENAI_API_KEY` (also used by the judge); other provider keys optional.
- Outputs land in `biodiversity-benchmark/outputs/` (raw_results.jsonl, evaluated_results.jsonl, comparison.csv, summary_by_model.csv, summary_by_topic.csv, report.md).
- See `biodiversity-benchmark/README.md` for full usage.

---

_The sections below describe the pnpm/TypeScript workspace scaffold that ships with the repo (not currently used by the benchmark CLI)._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml` → run codegen to regenerate hooks/Zod (`@workspace/api-client-react`, `@workspace/api-zod`).
- Benchmark backend: `artifacts/api-server/src/lib/benchmark/*` (paths, dataset, config, runner, results) + `src/routes/benchmark.ts` (mounted under `/api`).
- Web front end (French): `artifacts/benchmark-ui` (React/Vite, previewPath `/`). Pages in `src/pages/{home,run-detail,results-dashboard}.tsx`; French label helpers in `src/lib/format.ts`.
- Python CLI (unchanged engine): `biodiversity-benchmark/main.py`.

## Architecture decisions

- The web app drives the existing Python CLI as a subprocess; it does not reimplement scoring. The CLI writes live progress to a `--progress-file` (status.json) consumed by the API.
- Per-run state = server-written `meta.json` + python-written `status.json`, merged by the runner. `runs/` is gitignored; runs left active across a server restart are reconciled to "interrupted".
- Live progress is polled ~2s from the UI (local subprocess — the data-viz 5-min refresh floor deliberately does not apply).
- `runId` is strictly validated (regex + path-containment) before any filesystem op to prevent path traversal; run inputs (models/topic/limit) are validated server-side (400 on bad input).
- `regulatory_hallucination_risk` is an inverted score (5 = no risk); the UI labels it so higher always reads as better.

## Product

A French-language control room for benchmarking LLMs (OpenAI, Anthropic, Mistral, Gemini) against the 800-question biodiversity judgment dataset. Users configure & launch runs (pick models/topic/limit, dry-run, skip-eval), watch live progress, and explore results: model rankings, comparative charts by topic/difficulty, and a filterable per-question drill-down with raw answers and judge verdicts. CSV export per table/chart and PDF print of the results page.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
