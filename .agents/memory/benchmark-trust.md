---
name: Benchmark trust features
description: "Can I trust this model?" layer on the results dashboard — trust tiers, Trust Index, use-case verdicts, hallucination-vs-performance quadrant. Real-data-only constraints.
---

# Trust features (results dashboard)

Turns raw judge scores into the question a non-expert ecologist actually asks: "can I trust this model for my work?". Pure logic lives in `src/lib/trust.ts` (i18n-free, mirrors `share-card.ts`); the UI renders localized labels.

## Hard constraint: real data only, no fabricated domains
**Why:** the user's design feedback (French) imagined ecological-domain scores (Taxonomy / ERC / ESRS E4). Those do NOT exist. The dataset topics are **reasoning-type** buckets (moral_dilemmas, factual_expert, factual_easy, implicit_knowledge_graph_reasoning, bias_and_dilemmas, factual_trap) — not ecological domains. Only the 5 judge criteria + overallScore are real. Never invent per-domain subscores. Use-case verdicts map the 5 real criteria onto concrete ecology *tasks* (species info, draft report, flag uncertainty, cite sources, regulatory sign-off) — that is interpretation of real metrics, not fabrication.

## Trust model (all 0–5 except overallScore 0–100)
- Anti-hallucination (`regulatoryHallucinationRisk`, INVERTED: 5 = invents nothing) is weighted/gated highest — caution matters more than raw power for regulatory ecology work.
- `trustTier`: trusted (h≥4 & overall≥80), review (h≥3 & overall≥60), expert otherwise.
- `trustIndex` 0–10: 0.45·antiHallu + 0.35·overall + 0.20·accuracy (accuracy falls back to overall when missing).
- `trafficStatus`: green ≥4, amber ≥2.5, red <2.5.
- `TrustInputs` fields are `?: number | null` so `ModelSummary` (optional fields) satisfies it directly.

## Gotchas
- A pure helper named with a `use` prefix (`useCaseVerdicts`) trips the react-hooks linter (treated as a hook called conditionally/in callbacks). Renamed to `evaluateUseCases`. **Rule:** never prefix non-hook helpers with `use`.
- All trust UI is gated on `showVerdict` (`!run.noEval && !run.dryRun && summaryByModel.length>0`) so dry/no-eval runs never show misleading trust output.
