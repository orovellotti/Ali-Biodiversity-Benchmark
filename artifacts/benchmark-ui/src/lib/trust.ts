// Trust model for the benchmark results.
//
// The benchmark answers "which model scored best?" — this module turns the raw
// scores into the question an ecologist actually asks: "can I trust this model
// for my work?". It is intentionally i18n-free: callers pass numbers and render
// their own localized labels (mirrors share-card.ts).
//
// All criteria are on a 0–5 scale EXCEPT overallScore (0–100). Per the project
// convention, `regulatoryHallucinationRisk` is INVERTED — a HIGH value means the
// model invents few facts (safer). For ecology/regulatory work, this caution
// dimension matters more than raw performance, so it is weighted highest in the
// trust index and gates the trust tier.

export type TrustTier = "trusted" | "review" | "expert";
export type TrafficStatus = "green" | "amber" | "red";

export interface TrustInputs {
  overallScore?: number | null;
  accuracy?: number | null;
  uncertaintyHandling?: number | null;
  justificationQuality?: number | null;
  sourceAwareness?: number | null;
  /** Inverted: 5 = invents nothing (safest), 0 = high hallucination risk. */
  regulatoryHallucinationRisk?: number | null;
}

/** Traffic light for a single 0–5 criterion. */
export function trafficStatus(value: number | null): TrafficStatus | null {
  if (value == null) return null;
  if (value >= 4) return "green";
  if (value >= 2.5) return "amber";
  return "red";
}

/**
 * Overall trust tier. Gated primarily by anti-hallucination safety (the most
 * important caution criterion for ecology) and secondarily by overall score:
 *  - trusted: safe (≥4/5 anti-hallucination) AND strong overall (≥80/100)
 *  - review:  reasonably safe (≥3/5) AND decent overall (≥60/100)
 *  - expert:  otherwise — needs expert validation before use
 */
export function trustTier(i: TrustInputs): TrustTier | null {
  const h = i.regulatoryHallucinationRisk;
  const o = i.overallScore;
  if (h == null || o == null) return null;
  if (h >= 4 && o >= 80) return "trusted";
  if (h >= 3 && o >= 60) return "review";
  return "expert";
}

/**
 * Composite Trust Index on a 0–10 scale, one decimal. Anti-hallucination is
 * weighted highest (0.45), then overall score (0.35), then accuracy (0.20).
 * Accuracy falls back to overall score when missing so the index stays defined.
 */
export function trustIndex(i: TrustInputs): number | null {
  const h = i.regulatoryHallucinationRisk;
  const o = i.overallScore;
  if (h == null || o == null) return null;
  const normH = h / 5;
  const normO = o / 100;
  const normA = i.accuracy != null ? i.accuracy / 5 : normO;
  const raw = (0.45 * normH + 0.35 * normO + 0.2 * normA) * 10;
  return Math.round(raw * 10) / 10;
}

/** A concrete ecology task and whether this model can be trusted for it. */
export interface UseCaseVerdict {
  key:
    | "species_info"
    | "draft_reports"
    | "flag_uncertainty"
    | "cite_sources"
    | "regulatory_signoff";
  ok: boolean;
}

/**
 * Maps the scoring dimensions onto concrete ecology tasks. A task is
 * "recommended" only when the dimensions it depends on are strong enough.
 * Regulatory sign-off and source citation demand the strict (≥4) bar; the
 * rest accept a usable (≥3) bar.
 */
export function evaluateUseCases(i: TrustInputs): UseCaseVerdict[] {
  const strong = (v: number | null | undefined) => v != null && v >= 4;
  const usable = (v: number | null | undefined) => v != null && v >= 3;
  return [
    {
      key: "species_info",
      ok: usable(i.accuracy) && usable(i.regulatoryHallucinationRisk),
    },
    {
      key: "draft_reports",
      ok: usable(i.justificationQuality) && usable(i.accuracy),
    },
    { key: "flag_uncertainty", ok: usable(i.uncertaintyHandling) },
    { key: "cite_sources", ok: strong(i.sourceAwareness) },
    {
      key: "regulatory_signoff",
      ok: strong(i.regulatoryHallucinationRisk) && strong(i.accuracy),
    },
  ];
}
