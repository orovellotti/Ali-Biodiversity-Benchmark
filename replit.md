# ALI Biodiversity Benchmark

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
- Optional env: `BENCHMARK_MAX_REQUESTS_PER_RUN` (positive int, default 400) — hard ceiling on real API requests a single run may trigger; protects against draining credits.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract (source of truth): `lib/api-spec/openapi.yaml` → run codegen to regenerate hooks/Zod (`@workspace/api-client-react`, `@workspace/api-zod`).
- Benchmark backend: `artifacts/api-server/src/lib/benchmark/*` (paths, dataset, config, runner, results, arena) + `src/routes/benchmark.ts` (mounted under `/api`).
- Arena backend: `artifacts/api-server/src/lib/benchmark/arena.ts` (answer index across runs, HMAC-signed duel tokens, append-only votes, Elo replay leaderboard); votes at `biodiversity-benchmark/arena/votes.jsonl`.
- Web front end (French): `artifacts/benchmark-ui` (React/Vite, previewPath `/`). Pages in `src/pages/{home,run-detail,results-dashboard,arena}.tsx`; French label helpers in `src/lib/format.ts`.
- Python CLI (unchanged engine): `biodiversity-benchmark/main.py`.

## Architecture decisions

- The web app drives the existing Python CLI as a subprocess; it does not reimplement scoring. The CLI writes live progress to a `--progress-file` (status.json) consumed by the API.
- Per-run state = server-written `meta.json` + python-written `status.json`, merged by the runner. `runs/` is gitignored; runs left active across a server restart are reconciled to "interrupted".
- Live progress is polled ~2s from the UI (local subprocess — the data-viz 5-min refresh floor deliberately does not apply).
- `runId` is strictly validated (regex + path-containment) before any filesystem op to prevent path traversal; run inputs (models/topic/limit) are validated server-side (400 on bad input).
- `regulatory_hallucination_risk` is an inverted score (5 = no risk); the UI labels it so higher always reads as better.
- The UI is bilingual FR/EN via a lightweight context in `src/lib/i18n.tsx`: `useI18n()` returns `tr(fr, en)` for inline chrome, a language-aware `t(key)` for dynamic data labels (topics/status/scores/phases), and a locale-aware `formatDateTime`. Language persists in localStorage (`benchmark-lang`, default `fr`); switch via the FR/EN toggle in the header. Dataset content (questions/answers) stays French.
- Arena (`/arena`): Chatbot-Arena-style blind duels that **reuse already-generated run answers** — no live LLM calls. A duel pairs two distinct models' stored answers to the same dataset question. The reveal is forge-proof via an HMAC-signed duel token (prefers `SESSION_SECRET`, else a random per-process secret — never hardcoded); the vote endpoint is intentionally **public** ("communautaire"). Votes are append-only JSONL replayed through Elo (init 1000, K=24) to compute the leaderboard. The answer index keeps the newest answer per model+question and excludes empty/errored/`[DRY-RUN]` responses.
- Credit safeguards on launching a run (`runner.ts` `createRun`): two server-side guards protect against draining API credits. (1) **Concurrency lock** — only one run may be `running`/`queued` at a time; a second launch throws `ConcurrentRunError` → HTTP 409. (2) **Hard request ceiling** — for real (non-dry-run) launches, estimated requests must not exceed `maxRequestsPerRun()` (env `BENCHMARK_MAX_REQUESTS_PER_RUN`, default 400) or it throws `ValidationError` → HTTP 400. The estimate counts BOTH answer-generation calls (`models × questions`) AND judge-scoring calls (another `models × questions` when `!noEval && judgeAvailable()`), since both bill. Dry-run is free and skips the ceiling. The cap is exposed via `BenchmarkConfig.maxRequestsPerRun`. The UI (`home.tsx`) mirrors the same estimate (incl. judge calls) to disable + warn when over cap, polls `useListRuns` (5s) to block + notify when a run is active, requires an `AlertDialog` confirmation showing models/questions/estimated requests before every launch, and surfaces server 400/409 messages via `apiErrorMessage`. Concurrency guard is single-process only (filesystem-based, sync, no DB) — fine for this single-instance deployment.
- Question voting (Questions page `/questions`): public up/down voting on dataset questions ("communautaire", same philosophy as the Arena vote — anonymous, no auth). Backend `question-votes.ts` is append-only JSONL (`biodiversity-benchmark/questions/votes.jsonl`) replayed to the latest vote per `voterId`+`questionId`; `vote: "none"` clears a voter's vote; `questionId` is validated against the dataset (400 on unknown). Endpoints `GET /benchmark/questions/votes` + `POST /benchmark/questions/vote` are public. The UI uses an anonymous localStorage `voterId` (`benchmark-voter-id`) and persists the user's own votes in `benchmark-question-votes`; counts come from `useListQuestionVotes`, votes via `useSubmitQuestionVote` with toggle-to-clear + query invalidation. Up = primary/green, down = destructive/red, per the design system (ochre stays reserved for inverted hallucination risk).

## Product

A French-language control room for benchmarking LLMs (OpenAI, Anthropic, Mistral, Gemini) against the 800-question biodiversity judgment dataset. Users configure & launch runs (pick models/topic/limit, dry-run, skip-eval), watch live progress, and explore results: model rankings, comparative charts by topic/difficulty, and a filterable per-question drill-down with raw answers and judge verdicts. CSV export per table/chart and PDF print of the results page. An **Arena** (`/arena`) offers Chatbot-Arena-style blind duels over already-generated answers: blind vote → reveal models + per-vote Elo deltas, plus a cumulative community Elo leaderboard. The Questions browser (`/questions`) lets the community up/down vote each dataset question to surface the most/least relevant ones.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
