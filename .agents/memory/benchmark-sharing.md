---
name: Benchmark share UI
description: Where social-share lives in benchmark-ui and the one correctness rule for run-level share copy.
---

# Benchmark share UI

Social sharing (native Web Share + X/LinkedIn/Facebook/WhatsApp intent links + copy-link, with inline brand SVGs since lucide has none) is a **single reusable component**, `src/components/share-menu.tsx` (`ShareMenu` + exported brand icons). Both the Questions browser and the run results page consume it — do NOT re-duplicate the icons or the menu when adding share to a new surface; import and pass `{ url, text, title?, trigger?, align? }`.

The results page (run-detail) header and the Questions cards each compose their own bilingual `text` and deep-link `url`, then render `<ShareMenu>`.

**Rule — run share text must not claim a winner for unjudged runs.** Only include "top model / modèle le plus fiable" when `!run.noEval && !run.dryRun`. **Why:** dry-run and no-eval runs have no judged reliability ranking; `summaryByModel[0]` still exists but claiming it as "most reliable" in a LinkedIn post is misleading. **How to apply:** gate the `winner` value on the scored condition before building share copy.

The "Model ranking" on the results dashboard is a compact leaderboard `Table` (not a card grid) specifically so a completed run screenshots cleanly for LinkedIn. The overall-score column is hidden when `showVerdict` is false (no-eval/dry-run).
