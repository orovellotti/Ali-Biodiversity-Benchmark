---
name: Active benchmark dataset file
description: Which JSON file the live benchmark actually reads, vs the misleadingly-named 800 file.
---

The live benchmark reads **`biodiversity-benchmark/biodiversity_benchmark_100_v4.json`** — referenced by `datasetPath()` in the api-server (`paths.ts`) and as the `--input` default in `main.py`. The much larger `biodiversity_judgment_benchmark_800_questions.json` in the same folder is **NOT** loaded by the running app or the CLI default; editing it has no effect on the web app.

**Why this matters:** `replit.md` repeatedly calls it "the 800-question biodiversity judgment dataset", which is misleading — that wording describes a dataset the app doesn't use. To add/modify questions that actually show up, edit `biodiversity_benchmark_100_v4.json`.

**Active dataset schema (per question):** `id, section, difficulty, question_type, question, expected_answer_short, evaluation_criteria`. Grouping dimension is `section` (TS `topicOf = q.topic ?? q.section`; there is no `topic` field — don't add one, it would fragment grouping). `metadata` has `total` + a `structure` dict of per-section counts — update both when adding questions. The judge (`config.py`) consumes `expected_answer_short` (falls back to "(non fournie)") and `evaluation_criteria`, so new questions must include both or scoring degrades. Known difficulties include `expert`; known question_types include `expert_domain_knowledge`.

**How to apply:** append questions to `questions[]`, set `metadata.total = len(questions)` and `metadata.structure[<section>] += n`, then restart `artifacts/api-server: API Server` so `/api/benchmark/config` `totalQuestions` refreshes.
