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
