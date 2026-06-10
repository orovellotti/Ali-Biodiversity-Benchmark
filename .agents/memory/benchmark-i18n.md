---
name: benchmark-ui i18n
description: How French/English bilingual support works in benchmark-ui and the rules for adding new strings.
---

# benchmark-ui bilingual (FR/EN)

The UI is bilingual via a lightweight context at `src/lib/i18n.tsx`. There is no
keyed message catalog for chrome — translations are **co-located inline**.

- `useI18n()` returns `{ lang, setLang, tr, t, formatDateTime }`.
- `tr(fr, en)` — inline UI chrome. Wrap EVERY hardcoded UI string this way:
  `<h1>{tr("Résultats", "Results")}</h1>`, `aria-label={tr("Accueil","Home")}`.
- `t(key)` — language-aware lookup for **dynamic data labels** (topic/status/score/
  difficulty/phase/question-type keys coming from the API). The fr+en dictionary
  lives in `i18n.tsx` (`DATA_LABELS`). Add new API enum values there, not via `tr`.
- `formatDateTime` is locale-aware (en-GB / fr-FR).
- Lang persists in localStorage key `benchmark-lang`, default `fr`. Toggle is the
  FR/EN button in the header (`LanguageToggle` in `controls.tsx`).

**Why co-located `tr` instead of a keyed catalog:** one app, ~160 chrome strings,
translated once — inline pairs are far less error-prone than maintaining a parallel
key file, and keep the French/English next to each other for review.

**Rules when adding/editing strings:**
- Never hardcode a user-visible string; always `tr(...)`. Includes aria-label,
  title, placeholder, toast/validation messages, table headers, empty states.
- Dataset CONTENT (question/answer text from the API) stays French — do NOT `tr` it.
- Anything derived from `tr`/`t` inside a `useMemo` MUST list `tr` (or `lang`) in
  its dependency array, or labels go stale on language toggle. This bit the radar
  chart in `results-dashboard.tsx` (`radarData` memo) — caught in review.
- Module-level constants that need translation must be moved INSIDE the component
  (often `useMemo([tr])`); they can't call the hook at module scope.

The old `src/lib/format.ts` (fr-only `t`/`TRANSLATIONS`/`formatDateTime`) was
removed and fully superseded by `i18n.tsx`.

Platform brand is **"ALI Biodiversity Benchmark"** (header, `index.html` meta,
landing footer, `replit.md`).
