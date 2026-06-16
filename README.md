# ALI Biodiversity Benchmark

An independent benchmark that compares how reliably different artificial
intelligences (OpenAI, Anthropic, Mistral, plus *open-weight* models via
OpenRouter) handle the **106 questions** of the *Biodiversity Judgment Benchmark*.
On biodiversity and environmental-regulation topics, a wrong answer — or a made-up
rule — can be costly. This project measures, in a comparable and verifiable way,
how accurate the models are, how cautious they are, and how prone they are to
inventing information that sounds credible but is false.

The project brings together three parts:

| Part | Role | Location |
|---|---|---|
| **Web interface** | Control room (FR/EN): launch runs, watch progress, explore rankings, the Arena, and the question browser. | `artifacts/benchmark-ui` |
| **API server** | Drives the Python CLI, reads results from disk, exposes `/api`. | `artifacts/api-server` |
| **Python CLI** | The engine: queries the models, has the answers judged, produces the reports. | `biodiversity-benchmark/` |

## Quick start

> The apps run via Replit *workflows*, not via `pnpm dev` at the root. Use the
> preview pane or restart the workflows as needed.

- **Web interface + API**: the `artifacts/benchmark-ui: web` and
  `artifacts/api-server: API Server` workflows serve the app (preview at `/`).
- **Check the CLI without spending credits**:
  ```bash
  cd biodiversity-benchmark && python main.py --dry-run --limit 5
  ```
- **A real short test**:
  ```bash
  cd biodiversity-benchmark && python main.py --models openai,mistral --limit 10
  ```

Full CLI documentation (dataset, secrets, options, reading the results) is in
**[`biodiversity-benchmark/README.md`](biodiversity-benchmark/README.md)**.

## Evaluation methodology (in brief)

- **Comparative ranking.** For each question, a judge ranks all the answers
  together (anonymized and shuffled). The final ranking sorts by **mean rank**,
  ascending (lower = better); the score out of 100 is secondary.
- **Cross-provider judge panel** (default: `openai:gpt-4o` +
  `anthropic:claude-sonnet-4-5`), overridable via `BENCHMARK_JUDGES`.
- **Anti-self-evaluation**: a model is never scored by a judge from its own
  family.
- **`regulatory_hallucination_risk` is inverted**: 5 = low risk, 0 = high risk.
  The interface labels it so that a higher score always reads as "better".

## The "fair" 13-model leaderboard

The reference run compares **13 models** across all 106 questions, all judged
together by the same comparative panel — the only way to get a fair ranking
(models are only comparable when scored within the same ranking call).

Credit-saving principle: **a model is only re-run when necessary** (questions
changed, a new model added, or the judge changed). Already-generated answers are
read back from disk, never recomputed.

### Reproduce or extend the leaderboard

The `biodiversity-benchmark/fair13_chunk.py` driver generates and judges a
multi-model leaderboard in a **crash-safe, resumable** way:

- parallel generation (concurrency capped at 3), each answer written to disk
  immediately;
- a resume skips `(model, question)` pairs already completed — **no credit is
  ever spent twice**;
- evaluation is resumable at the per-question level;
- it reuses already-stored answers (`REUSE_SRC`) instead of regenerating them.

For long runs (≈ 2 h), it is launched in `--offset` batches via a persistent
Replit *workflow* that survives interruptions, then the batches are concatenated
into a single consolidated run that the interface shows as one leaderboard.

> ⚠️ **Quotas.** An API key on a free tier with a **zero quota** fails (HTTP 429):
> its answers come back empty and the model is excluded from the ranking. Make
> sure the keys used as **judges** have a paid quota.

## Architecture and preferences

The detailed architecture (OpenAPI contract, file-based persistence, Arena, EN
translation, credit safeguards, i18n…) and the operating preferences are
documented in **[`replit.md`](replit.md)** at the root.
