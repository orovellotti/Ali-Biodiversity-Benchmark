import { appendFileSync, readFileSync } from "node:fs";
import { questionVotesFilePath } from "./paths";
import { listQuestions } from "./dataset";

/**
 * Community up/down voting on the dataset questions. Like the arena, state is
 * filesystem-based: votes are appended to `questions/votes.jsonl` and the
 * tallies are derived by replaying them. There is no DB.
 *
 * Voting is anonymous and public, but each browser carries a stable random
 * `voterId` (kept in localStorage) so a voter can change or clear their vote on
 * a question without inflating the totals. On replay we keep only each voter's
 * latest choice per question.
 */

export type QuestionVoteValue = "up" | "down" | "none";

export interface QuestionVoteCount {
  questionId: string;
  up: number;
  down: number;
  score: number;
}

export interface QuestionVotes {
  votes: QuestionVoteCount[];
}

interface VoteRecord {
  ts: string;
  voterId: string;
  questionId: string;
  vote: QuestionVoteValue;
}

export class QuestionVoteError extends Error {}

let validIdsCache: Set<string> | null = null;

/** Only allow votes on questions that actually exist in the dataset. */
function validQuestionIds(): Set<string> {
  if (!validIdsCache) {
    validIdsCache = new Set(listQuestions().map((q) => q.id));
  }
  return validIdsCache;
}

function readVotes(): VoteRecord[] {
  let content: string;
  try {
    content = readFileSync(questionVotesFilePath(), "utf-8");
  } catch {
    return [];
  }
  const out: VoteRecord[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const v = JSON.parse(trimmed) as VoteRecord;
      if (v?.voterId && v?.questionId && v?.vote) out.push(v);
    } catch {
      // ignore malformed line
    }
  }
  return out;
}

/**
 * Replay votes keeping only each voter's most recent choice per question, then
 * aggregate into up/down/score tallies. A latest choice of "none" means the
 * voter cleared their vote, so it contributes nothing.
 */
function tally(votes: VoteRecord[]): Map<string, QuestionVoteCount> {
  const latest = new Map<string, { questionId: string; vote: QuestionVoteValue }>();
  for (const v of votes) {
    latest.set(`${v.voterId}::${v.questionId}`, {
      questionId: v.questionId,
      vote: v.vote,
    });
  }
  const counts = new Map<string, QuestionVoteCount>();
  for (const { questionId, vote } of latest.values()) {
    if (vote === "none") continue;
    let c = counts.get(questionId);
    if (!c) {
      c = { questionId, up: 0, down: 0, score: 0 };
      counts.set(questionId, c);
    }
    if (vote === "up") c.up += 1;
    else c.down += 1;
    c.score = c.up - c.down;
  }
  return counts;
}

export function listQuestionVotes(): QuestionVotes {
  const counts = tally(readVotes());
  return { votes: [...counts.values()] };
}

/**
 * Record (or change/clear) one voter's up/down vote on a question, then return
 * the refreshed tally for that question.
 */
export function recordQuestionVote(
  questionId: string,
  voterId: string,
  vote: QuestionVoteValue,
): QuestionVoteCount {
  if (!validQuestionIds().has(questionId)) {
    throw new QuestionVoteError("Question inconnue.");
  }
  if (vote !== "up" && vote !== "down" && vote !== "none") {
    throw new QuestionVoteError("Vote invalide.");
  }

  const record: VoteRecord = {
    ts: new Date().toISOString(),
    voterId,
    questionId,
    vote,
  };
  appendFileSync(
    questionVotesFilePath(),
    JSON.stringify(record) + "\n",
    "utf-8",
  );

  const counts = tally(readVotes());
  return counts.get(questionId) ?? { questionId, up: 0, down: 0, score: 0 };
}
