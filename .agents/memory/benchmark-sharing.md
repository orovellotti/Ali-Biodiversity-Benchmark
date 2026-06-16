---
name: Benchmark share UI
description: The one durable rule for run-level share copy, plus where the shared share component lives.
---

# Benchmark share UI

Social sharing is consolidated into a **single reusable component** (`ShareMenu`) so new share surfaces import it rather than re-duplicating the brand-icon SVGs (lucide has none). Both the Questions browser and the run results page consume it.

The results page (run-detail) header and the Questions cards each compose their own bilingual `text` and deep-link `url`, then render `<ShareMenu>`.

**Rule — run share text must not claim a winner for unjudged runs.** Only include "top model / modèle le plus fiable" when the run was actually judged (`!run.noEval && !run.dryRun`). **Why:** dry-run and no-eval runs still expose a ranked `summaryByModel[0]`, but it carries no judged reliability verdict — calling it "most reliable" in a public post is misleading. **How to apply:** gate the winner value on the scored condition before composing share copy; provide neutral count-only phrasing otherwise.

The "Model ranking" on the results dashboard is a compact leaderboard `Table` (not a card grid) specifically so a completed run screenshots cleanly for LinkedIn. The overall-score column is hidden when `showVerdict` is false (no-eval/dry-run).

**Share card (branded PNG).** `ShareMenu` takes an optional `onDownloadCard` handler; when set, it shows a "Download share card / Télécharger la carte" item. The run results page passes it (only when the run is completed AND has results). The card itself is drawn purely on `<canvas>` in `src/lib/share-card.ts` (`downloadShareCard`), NOT html-to-image/DOM capture. **Why canvas:** Tailwind `oklch`/CSS-var colors and web fonts don't survive DOM-to-image reliably; canvas is self-contained and renders identically FR/EN. The module is i18n-free — callers pass already-localized strings. It always draws in the light "papier de terrain" palette regardless of UI theme (constants mirror `:root` in index.css), awaits `document.fonts.ready` before drawing so Fraunces/Inter/JetBrains-Mono aren't fallbacks, and reuses the same "no winner for unjudged runs" gate (`showScore`/winner only when `!noEval && !dryRun`).
