---
name: benchmark run batching & dev-idle fragility
description: Why full benchmark runs fail in dev and how offset batching fixes it
---

# Long benchmark runs don't survive a dev workspace idle pause

**Observed:** A full run (4 models × 100 questions + judge ≈ 800 sequential API
calls, ~2h wall-clock) froze mid-run with zero output for ~1h, then the dev
api-server restarted and reconciled the run to "interrupted". Anthropic
(claude-sonnet) was throttling hard right before the freeze (latency climbed
14s→29s/req). The Python CLI already has per-request timeouts (120s, 3 retries),
so it was NOT a missing-timeout bug.

**Why:** A development workspace pauses background work when there's no activity.
A multi-hour background subprocess gets frozen during the idle window, and the
resume restarts the workflow — killing the orphaned run. So the real constraint
is wall-clock duration, not the code.

**How to apply:** Size each run to finish within one active session (~30 min).
Use the `offset` parameter (added to RunInput/Run, CLI `--offset`) to launch
non-overlapping batches: questions 0–25, 25–50, 50–75, 75–100. Each batch is a
separate run in the history (runs are isolated per-id; there's no append/merge).
Ordering in `filter_questions` / `questionCount` is topic → offset → limit, and
the credit-ceiling estimate uses the same `questionCount(topic, limit, offset)`.
Keep the workspace tab active while a batch runs. For a long full run, prefer
fewer models, `noEval`, or dropping the slow provider rather than one giant run.

# Running a big multi-model run unattended (crash-safe pattern)

When a run is too big to finish in one active session (e.g. a fair N-model
re-rank over the whole dataset), don't rely on staying active. What worked:

**Background processes get reaped at tool-call boundaries.** `nohup`/`setsid`/
detached subprocesses launched from a tool call are killed when the turn ends —
they do NOT survive across turns. The reliable way to run a long job that
outlives turns is a **persistent Replit workflow** (configure command =
`bash run_all.sh`, outputType console, autoStart). It keeps running across
turns; poll its progress by inspecting the on-disk output files (or
`getWorkflowStatus`). Remove the workflow when done.

**Parallel answer generation segfaults above ~workers=4.** A ThreadPoolExecutor
fanning out provider calls crashed (bare segfault, no traceback, NOT OOM — only
~4/15GB used) after ~80–90 calls at workers=5/6. workers=3 ran clean to
completion. Keep gen concurrency ≤3.

**Make the driver append-and-skip resumable** so workflow restarts (from crashes
or idle) never re-pay: append each good answer to `raw_results.jsonl` instantly,
skip already-good `(provider, question_id)` on rerun, dedup at end. Do eval at
**question granularity** — append per question, skip fully-scored questions,
dedup — so an interrupted eval never re-bills judge calls for done questions.
Wrap each chunk in a retry loop. Comparative eval is the bottleneck (~30s/
question = 2 sequential judge calls ranking all models), far slower than gen.
Reusing prior answers: filter reused rows through the same `_is_good()` gate,
or a bad cached row silently leaves a competitor missing from the "fair" set.
