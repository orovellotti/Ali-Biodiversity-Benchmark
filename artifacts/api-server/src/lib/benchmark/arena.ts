import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { arenaVotesFilePath } from "./paths";
import { readRows } from "./results";
import { listRuns } from "./runner";

/**
 * Community "arena": Chatbot-Arena-style blind duels built entirely from
 * already-generated benchmark answers (no live model calls). Two distinct
 * models' answers to the same dataset question are shown anonymously; the user
 * votes; the models are revealed and a cumulative Elo leaderboard is updated.
 *
 * State is filesystem-based (matching the rest of the benchmark app): votes are
 * appended to `arena/votes.jsonl` and the leaderboard is derived by replaying
 * them. There is no DB.
 */

export interface ArenaModelRef {
  provider: string;
  model: string;
}

export interface ArenaDuel {
  duelToken: string;
  questionId: string;
  question: string | null;
  topic: string | null;
  difficulty: string | null;
  optionA: { response: string };
  optionB: { response: string };
}

export interface ArenaRanking {
  provider: string;
  model: string;
  rating: number;
  games: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number | null;
}

export interface ArenaLeaderboard {
  totalVotes: number;
  rankings: ArenaRanking[];
}

export interface ArenaVoteResult {
  modelA: ArenaModelRef;
  modelB: ArenaModelRef;
  winner: "A" | "B" | "tie";
  ratingChangeA: number;
  ratingChangeB: number;
  leaderboard: ArenaLeaderboard;
}

const INITIAL_RATING = 1000;
const K_FACTOR = 24;

function modelKey(m: ArenaModelRef): string {
  return `${m.provider}::${m.model}`;
}

// Duel tokens are HMAC-signed so a public voter cannot forge the revealed
// identities or fabricate fake matchups. Prefer the configured SESSION_SECRET;
// if it is missing, fall back to a random per-process secret (non-deterministic,
// never hardcoded) so tokens still can't be forged offline. Tokens then only
// stay valid for the lifetime of the server process, which is acceptable.
const PROCESS_FALLBACK_SECRET = randomBytes(32).toString("hex");

function tokenSecret(): string {
  return process.env["SESSION_SECRET"] || PROCESS_FALLBACK_SECRET;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

interface DuelTokenPayload {
  q: string;
  a: ArenaModelRef;
  b: ArenaModelRef;
  t: number;
}

function signDuelToken(payload: DuelTokenPayload): string {
  const body = b64url(Buffer.from(JSON.stringify(payload), "utf-8"));
  const sig = b64url(
    createHmac("sha256", tokenSecret()).update(body).digest(),
  );
  return `${body}.${sig}`;
}

/** Verify and decode a duel token; returns null if tampered or malformed. */
function verifyDuelToken(token: string): DuelTokenPayload | null {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = b64url(
    createHmac("sha256", tokenSecret()).update(body).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(body, "base64url").toString("utf-8"),
    ) as DuelTokenPayload;
    if (
      typeof parsed.q !== "string" ||
      !parsed.a?.provider ||
      !parsed.a?.model ||
      !parsed.b?.provider ||
      !parsed.b?.model
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

interface AnswerEntry extends ArenaModelRef {
  response: string;
}

interface QuestionEntry {
  questionId: string;
  question: string | null;
  topic: string | null;
  difficulty: string | null;
  /** keyed by `${provider}::${model}` so each model appears at most once */
  answers: Map<string, AnswerEntry>;
}

/**
 * Build a per-question index of usable answers across every run. An answer is
 * usable when it has non-empty text and no recorded error. If the same model
 * answered a question in multiple runs, the most recently scanned one wins.
 */
function buildIndex(): Map<string, QuestionEntry> {
  const index = new Map<string, QuestionEntry>();
  for (const run of listRuns()) {
    let rows;
    try {
      rows = readRows(run.id);
    } catch {
      continue;
    }
    for (const row of rows) {
      const qid = row.questionId;
      if (!qid) continue;
      const response = (row.rawResponse ?? "").trim();
      if (!response || row.error) continue;
      // Dry-run rows carry a placeholder instead of a real model answer — they
      // are useless for a blind comparison, so exclude them from the arena.
      if (response.startsWith("[DRY-RUN]")) continue;
      if (!row.provider || !row.model) continue;
      let entry = index.get(qid);
      if (!entry) {
        entry = {
          questionId: qid,
          question: row.question ?? null,
          topic: row.topic ?? null,
          difficulty: row.difficulty ?? null,
          answers: new Map(),
        };
        index.set(qid, entry);
      }
      const key = `${row.provider}::${row.model}`;
      // listRuns() is newest-first, so the first answer we see for a given
      // model+question is the most recent — keep it and ignore older duplicates.
      if (!entry.answers.has(key)) {
        entry.answers.set(key, {
          provider: row.provider,
          model: row.model,
          response,
        });
      }
    }
  }
  return index;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

/**
 * Build a blind duel from a random question that has answers from at least two
 * distinct models. Returns null when no such question exists yet.
 */
export function buildDuel(): ArenaDuel | null {
  const index = buildIndex();
  const eligible = [...index.values()].filter((e) => e.answers.size >= 2);
  if (eligible.length === 0) return null;

  const question = pickRandom(eligible);
  const entries = [...question.answers.values()];
  // pick two distinct answers
  const i = Math.floor(Math.random() * entries.length);
  let j = Math.floor(Math.random() * (entries.length - 1));
  if (j >= i) j += 1;
  const a = entries[i]!;
  const b = entries[j]!;

  const token = signDuelToken({
    q: question.questionId,
    a: { provider: a.provider, model: a.model },
    b: { provider: b.provider, model: b.model },
    t: Date.now(),
  });

  return {
    duelToken: token,
    questionId: question.questionId,
    question: question.question,
    topic: question.topic,
    difficulty: question.difficulty,
    optionA: { response: a.response },
    optionB: { response: b.response },
  };
}

interface VoteRecord {
  ts: string;
  questionId: string;
  a: ArenaModelRef;
  b: ArenaModelRef;
  winner: "A" | "B" | "tie";
}

function readVotes(): VoteRecord[] {
  let content: string;
  try {
    content = readFileSync(arenaVotesFilePath(), "utf-8");
  } catch {
    return [];
  }
  const out: VoteRecord[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const v = JSON.parse(trimmed) as VoteRecord;
      if (v?.a?.model && v?.b?.model && v.winner) out.push(v);
    } catch {
      // ignore malformed line
    }
  }
  return out;
}

interface EloState {
  ratings: Map<string, number>;
  refs: Map<string, ArenaModelRef>;
  stats: Map<string, { wins: number; losses: number; ties: number }>;
  lastDeltaA: number;
  lastDeltaB: number;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Replay every vote in order to derive current Elo ratings and per-model stats. */
function replay(votes: VoteRecord[]): EloState {
  const ratings = new Map<string, number>();
  const refs = new Map<string, ArenaModelRef>();
  const stats = new Map<string, { wins: number; losses: number; ties: number }>();
  let lastDeltaA = 0;
  let lastDeltaB = 0;

  const ensure = (m: ArenaModelRef): string => {
    const key = modelKey(m);
    if (!ratings.has(key)) ratings.set(key, INITIAL_RATING);
    if (!refs.has(key)) refs.set(key, { provider: m.provider, model: m.model });
    if (!stats.has(key)) stats.set(key, { wins: 0, losses: 0, ties: 0 });
    return key;
  };

  for (const vote of votes) {
    const ka = ensure(vote.a);
    const kb = ensure(vote.b);
    const ra = ratings.get(ka)!;
    const rb = ratings.get(kb)!;
    const ea = 1 / (1 + 10 ** ((rb - ra) / 400));
    const eb = 1 - ea;
    const sa = vote.winner === "A" ? 1 : vote.winner === "tie" ? 0.5 : 0;
    const sb = 1 - sa;
    const da = K_FACTOR * (sa - ea);
    const db = K_FACTOR * (sb - eb);
    ratings.set(ka, ra + da);
    ratings.set(kb, rb + db);

    const statA = stats.get(ka)!;
    const statB = stats.get(kb)!;
    if (vote.winner === "A") {
      statA.wins += 1;
      statB.losses += 1;
    } else if (vote.winner === "B") {
      statB.wins += 1;
      statA.losses += 1;
    } else {
      statA.ties += 1;
      statB.ties += 1;
    }

    lastDeltaA = da;
    lastDeltaB = db;
  }

  return { ratings, refs, stats, lastDeltaA, lastDeltaB };
}

function toLeaderboard(state: EloState, totalVotes: number): ArenaLeaderboard {
  const rankings: ArenaRanking[] = [];
  for (const [key, rating] of state.ratings) {
    const ref = state.refs.get(key)!;
    const s = state.stats.get(key)!;
    const games = s.wins + s.losses + s.ties;
    rankings.push({
      provider: ref.provider,
      model: ref.model,
      rating: Math.round(rating),
      games,
      wins: s.wins,
      losses: s.losses,
      ties: s.ties,
      winRate: games > 0 ? round1((s.wins / games) * 100) : null,
    });
  }
  rankings.sort((x, y) => y.rating - x.rating);
  return { totalVotes, rankings };
}

export function getLeaderboard(): ArenaLeaderboard {
  const votes = readVotes();
  return toLeaderboard(replay(votes), votes.length);
}

export class ArenaVoteError extends Error {}

/**
 * Record a blind vote: verify the duel token (so the revealed identities can't
 * be forged or peeked), append the vote, then return the revealed models, the
 * Elo deltas this vote produced, and the refreshed leaderboard.
 */
export function recordVote(
  duelToken: string,
  winner: "A" | "B" | "tie",
): ArenaVoteResult {
  const payload = verifyDuelToken(duelToken);
  if (!payload) {
    throw new ArenaVoteError("Jeton de duel invalide ou expiré.");
  }
  if (winner !== "A" && winner !== "B" && winner !== "tie") {
    throw new ArenaVoteError("Vote invalide.");
  }

  const record: VoteRecord = {
    ts: new Date().toISOString(),
    questionId: payload.q,
    a: payload.a,
    b: payload.b,
    winner,
  };
  appendFileSync(arenaVotesFilePath(), JSON.stringify(record) + "\n", "utf-8");

  const votes = readVotes();
  const state = replay(votes);
  return {
    modelA: payload.a,
    modelB: payload.b,
    winner,
    ratingChangeA: round1(state.lastDeltaA),
    ratingChangeB: round1(state.lastDeltaB),
    leaderboard: toLeaderboard(state, votes.length),
  };
}
