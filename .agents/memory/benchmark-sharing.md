---
name: Benchmark share UI
description: The one durable rule for run-level share copy, plus where the shared share component lives.
---

# Benchmark share UI

Social sharing is consolidated into a **single reusable component** (`ShareMenu`) so new share surfaces import it rather than re-duplicating the brand-icon SVGs (lucide has none). Both the Questions browser and the run results page consume it.

**Rule — run share text must not claim a winner for unjudged runs.** Only include "top model / modèle le plus fiable" when the run was actually judged (`!run.noEval && !run.dryRun`). **Why:** dry-run and no-eval runs still expose a ranked `summaryByModel[0]`, but it carries no judged reliability verdict — calling it "most reliable" in a public post is misleading. **How to apply:** gate the winner value on the scored condition before composing share copy; provide neutral count-only phrasing otherwise.
