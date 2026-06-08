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

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
