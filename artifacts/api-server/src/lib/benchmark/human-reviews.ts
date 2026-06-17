import { appendFileSync, readFileSync } from "node:fs";
import { humanReviewsFilePath } from "./paths";
import { listQuestions } from "./dataset";
import { answersForQuestion } from "./question-answers";

/**
 * Community human review & scoring. Reviewers read one random dataset question
 * with every model's already-stored answer (no live model calls — same source
 * as the arena and the questions browser) and score each answer on the SAME
 * five criteria as the LLM judge, each 0–5:
 *   accuracy, uncertainty, justification, sources, hallucination
 * (`hallucination` is inverted — 5 = no risk — so higher is always better,
 * consistent with the judge and the rest of the UI.)
 *
 * Like the arena and question votes, state is filesystem-based: scores are
 * appended to `reviews/scores.jsonl` and the leaderboard is derived by
 * replaying them. There is no DB. Reviewing is anonymous and public, but each
 * browser carries a stable random `reviewerId` (localStorage) so a reviewer can
 * re-score an answer without inflating the totals — on replay we keep only each
 * reviewer's latest score per question+model.
 */

export const REVIEW_CRITERIA = [
  "accuracy",
  "uncertainty",
  "justification",
  "sources",
  "hallucination",
] as const;

export type ReviewCriterion = (typeof REVIEW_CRITERIA)[number];

export type ReviewCriteriaScores = Record<ReviewCriterion, number>;

export interface ReviewAnswer {
  provider: string;
  model: string;
  response: string;
}

export interface ReviewQuestion {
  questionId: string;
  question: string;
  answers: ReviewAnswer[];
}

export interface ReviewAnswerScore extends ReviewCriteriaScores {
  provider: string;
  model: string;
}

export interface ReviewModelRanking extends ReviewCriteriaScores {
  provider: string;
  model: string;
  overall: number;
  nReviews: number;
}

export interface ReviewLeaderboard {
  totalReviews: number;
  rankings: ReviewModelRanking[];
}

interface ReviewRecord {
  ts: string;
  reviewerId: string;
  questionId: string;
  provider: string;
  model: string;
  scores: ReviewCriteriaScores;
}

export class HumanReviewError extends Error {}

let validIdsCache: Set<string> | null = null;

function validQuestionIds(): Set<string> {
  if (!validIdsCache) {
    validIdsCache = new Set(listQuestions().map((q) => q.id));
  }
  return validIdsCache;
}

/** Question text for a known id (empty string if somehow missing). */
function questionTextOf(questionId: string): string {
  return listQuestions().find((q) => q.id === questionId)?.question ?? "";
}

/**
 * Pick a random dataset question that has at least one stored model answer, and
 * return it with its answers (provider/model/response only — judge scores are
 * deliberately omitted so the human reviewer isn't anchored). Returns null when
 * no question anywhere has a usable stored answer yet.
 */
export function randomReviewQuestion(): ReviewQuestion | null {
  const ids = listQuestions().map((q) => q.id);
  // Fisher–Yates shuffle so we probe questions in random order.
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  for (const id of ids) {
    const { answers } = answersForQuestion(id);
    if (answers.length > 0) {
      return {
        questionId: id,
        question: questionTextOf(id),
        answers: answers.map((a) => ({
          provider: a.provider,
          model: a.model,
          response: a.response,
        })),
      };
    }
  }
  return null;
}

function isValidScore(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 5;
}

function readRecords(): ReviewRecord[] {
  let content: string;
  try {
    content = readFileSync(humanReviewsFilePath(), "utf-8");
  } catch {
    return [];
  }
  const out: ReviewRecord[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const r = JSON.parse(trimmed) as ReviewRecord;
      if (r?.reviewerId && r?.questionId && r?.provider && r?.model && r?.scores) {
        out.push(r);
      }
    } catch {
      // ignore malformed line
    }
  }
  return out;
}

/**
 * Record a reviewer's scores for one or more answers to a question, then return
 * the refreshed community leaderboard. Each answer scored is appended as its
 * own record.
 */
export function recordReview(
  reviewerId: string,
  questionId: string,
  scores: ReviewAnswerScore[],
): ReviewLeaderboard {
  if (!validQuestionIds().has(questionId)) {
    throw new HumanReviewError("Question inconnue.");
  }
  if (!Array.isArray(scores) || scores.length === 0) {
    throw new HumanReviewError("Aucune note fournie.");
  }
  // Only allow scoring models that actually have a stored answer for THIS
  // question. This is the abuse guard for the public endpoint: without it,
  // anyone could POST fabricated provider/model names and poison the community
  // leaderboard with models that never answered.
  const allowed = new Set(
    answersForQuestion(questionId).answers.map((a) => `${a.provider}::${a.model}`),
  );
  const seenInPayload = new Set<string>();
  const ts = new Date().toISOString();
  const lines: string[] = [];
  for (const s of scores) {
    if (!s?.provider || !s?.model) {
      throw new HumanReviewError("Réponse à noter invalide.");
    }
    const key = `${s.provider}::${s.model}`;
    if (!allowed.has(key)) {
      throw new HumanReviewError(
        "Réponse à noter inconnue pour cette question.",
      );
    }
    if (seenInPayload.has(key)) {
      throw new HumanReviewError("Réponse notée en double.");
    }
    seenInPayload.add(key);
    for (const c of REVIEW_CRITERIA) {
      if (!isValidScore(s[c])) {
        throw new HumanReviewError(
          `Note invalide pour « ${c} » (attendu un entier de 0 à 5).`,
        );
      }
    }
    const record: ReviewRecord = {
      ts,
      reviewerId,
      questionId,
      provider: s.provider,
      model: s.model,
      scores: {
        accuracy: s.accuracy,
        uncertainty: s.uncertainty,
        justification: s.justification,
        sources: s.sources,
        hallucination: s.hallucination,
      },
    };
    lines.push(JSON.stringify(record));
  }
  appendFileSync(humanReviewsFilePath(), lines.join("\n") + "\n", "utf-8");
  return getReviewLeaderboard();
}

/**
 * Replay all review records, keeping only each reviewer's latest score per
 * question+model, then aggregate per model: the mean of each criterion plus an
 * `overall` = mean of every kept record's own five-criteria average. Ranked by
 * overall descending (higher = better for all criteria, hallucination included
 * since it is inverted).
 */
export function getReviewLeaderboard(): ReviewLeaderboard {
  const latest = new Map<string, ReviewRecord>();
  for (const r of readRecords()) {
    latest.set(`${r.reviewerId}::${r.questionId}::${r.provider}::${r.model}`, r);
  }

  interface Acc {
    provider: string;
    model: string;
    sums: ReviewCriteriaScores;
    overallSum: number;
    n: number;
  }
  const byModel = new Map<string, Acc>();
  for (const r of latest.values()) {
    const key = `${r.provider}::${r.model}`;
    let acc = byModel.get(key);
    if (!acc) {
      acc = {
        provider: r.provider,
        model: r.model,
        sums: {
          accuracy: 0,
          uncertainty: 0,
          justification: 0,
          sources: 0,
          hallucination: 0,
        },
        overallSum: 0,
        n: 0,
      };
      byModel.set(key, acc);
    }
    let recOverall = 0;
    for (const c of REVIEW_CRITERIA) {
      acc.sums[c] += r.scores[c];
      recOverall += r.scores[c];
    }
    acc.overallSum += recOverall / REVIEW_CRITERIA.length;
    acc.n += 1;
  }

  const rankings: ReviewModelRanking[] = [...byModel.values()].map((acc) => {
    const means = {} as ReviewCriteriaScores;
    for (const c of REVIEW_CRITERIA) {
      means[c] = acc.sums[c] / acc.n;
    }
    return {
      provider: acc.provider,
      model: acc.model,
      ...means,
      overall: acc.overallSum / acc.n,
      nReviews: acc.n,
    };
  });
  rankings.sort((a, b) => b.overall - a.overall);

  return { totalReviews: latest.size, rankings };
}
