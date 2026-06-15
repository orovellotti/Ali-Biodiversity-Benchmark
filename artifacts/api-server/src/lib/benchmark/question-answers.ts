import { listQuestions } from "./dataset";
import { readRows } from "./results";
import { listRuns } from "./runner";

/**
 * Per-question model answers for the public Questions browser. Reuses the
 * already-stored run results (no live model calls) — the same source the arena
 * draws from. For each model we keep the most recent usable answer across every
 * run and expose its judge score so reviewers can read what each model said and
 * how it was rated. Empty/errored/`[DRY-RUN]` answers are excluded.
 */

export interface QuestionAnswer {
  provider: string;
  model: string;
  response: string;
  overallScore: number | null;
  rankInQuestion: number | null;
  verdict: string | null;
}

export interface QuestionAnswers {
  questionId: string;
  answers: QuestionAnswer[];
}

/** Only allow lookups for questions that actually exist in the dataset. */
export function isKnownQuestion(questionId: string): boolean {
  return listQuestions().some((q) => q.id === questionId);
}

export function answersForQuestion(questionId: string): QuestionAnswers {
  // keyed by `${provider}::${model}` so each model appears at most once
  const seen = new Map<string, QuestionAnswer>();
  for (const run of listRuns()) {
    let rows;
    try {
      rows = readRows(run.id);
    } catch {
      continue;
    }
    for (const row of rows) {
      if (row.questionId !== questionId) continue;
      const response = (row.rawResponse ?? "").trim();
      if (!response || row.error) continue;
      if (response.startsWith("[DRY-RUN]")) continue;
      if (!row.provider || !row.model) continue;
      const key = `${row.provider}::${row.model}`;
      // listRuns() is newest-first, so the first answer we see wins.
      if (seen.has(key)) continue;
      seen.set(key, {
        provider: row.provider,
        model: row.model,
        response,
        overallScore: row.overallScore ?? null,
        rankInQuestion: row.rankInQuestion ?? null,
        verdict: row.verdict ?? null,
      });
    }
  }
  // Sort by comparative rank (lower = better) when available, falling back to
  // the overall score; unranked/unscored answers sink to the bottom.
  const answers = [...seen.values()].sort((a, b) => {
    if (a.rankInQuestion != null && b.rankInQuestion != null) {
      if (a.rankInQuestion !== b.rankInQuestion) {
        return a.rankInQuestion - b.rankInQuestion;
      }
    } else if (a.rankInQuestion != null) {
      return -1;
    } else if (b.rankInQuestion != null) {
      return 1;
    }
    return (b.overallScore ?? -1) - (a.overallScore ?? -1);
  });
  return { questionId, answers };
}
