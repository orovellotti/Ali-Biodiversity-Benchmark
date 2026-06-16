---
name: benchmark-ui design system
description: The "Carnet de terrain" visual concept governing the benchmark-ui artifact — keep new UI consistent with it.
---

# benchmark-ui — "Carnet de terrain" design system

The benchmark-ui artifact (French control room for the biodiversity LLM benchmark) follows one creative concept: **naturalist field-notebook × precision instrument panel**. Any new UI in this artifact must extend this language, not invent a new one.

- **Type**: Fraunces (display serif, via `.font-display`), Inter (UI), JetBrains Mono (data readouts, eyebrow labels via `.eyebrow`).
- **Palette**: warm paper light background + deep botanical green primary + nocturne-forest dark mode. Tokens in `src/index.css`.
- **Ochre accent** (`--ochre` token, `text-ochre`/`bg-ochre/…` utilities) is reserved for the INVERTED hallucination-risk treatment (5 = no risk) AND, by extension, the **amber/"review required" trust tier** (justified: the trust tier is anti-hallucination-driven, so ochre = caution stays semantically consistent). The trust traffic-light uses green `#2f6b4f` / ochre `#c98a2b` / terracotta `#c2603b`. `--accent` is intentionally kept green for shadcn hover states — do not repurpose it.
- **Motifs**: numbered sections (§01…), mono small-caps eyebrow labels, hairline rules, specimen-label cards, `.paper-grid` dotted texture.
- Charts use a hardcoded field-naturalist hex palette (`CHART_COLORS` in results-dashboard), separate from the CSS chart vars.

**Why:** the user asked for a single coherent concept ("Surprends-moi", full creative license); piecemeal additions in a different style break the whole.

**How to apply:** reuse `SiteHeader`, the `.eyebrow`/`.font-display`/`.paper-grid` utilities, and the ochre-for-inverted-risk rule. Light-mode `--ochre` is deliberately dark (~32% L) so `text-ochre` on tinted backgrounds meets WCAG contrast — don't lighten it back.
