import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { benchmarkDir } from "./paths";
import { listQuestions } from "./dataset";
import { listRuns } from "./runner";
import { getRunResults } from "./results";
import { logger } from "../logger";

/**
 * Server-side French -> English translation with a PERMANENT on-disk cache.
 *
 * The French dataset/answers are the source of truth; English is display-only.
 * Each unique source string is translated exactly once (via a cheap LLM) and
 * cached forever, keyed by a hash of the source text. Repeat views are free.
 *
 * Cost safety (the endpoint is public): only strings that already belong to the
 * benchmark corpus (dataset questions/expected answers + stored run
 * answers/verdicts) are ever sent to the LLM. Arbitrary/novel input is returned
 * untranslated, so the total spend is bounded to "translate the corpus once".
 * Translation work is also serialized so concurrent requests can't double-pay.
 */

export type TranslateTarget = "en";

const MAX_TEXTS = 600;
const MAX_TOTAL_CHARS = 300_000;
const CHUNK_SIZE = 20;
const MAX_CONCURRENCY = 4;
const KNOWN_TTL_MS = 30_000;

export class TranslateError extends Error {}
export class TranslateValidationError extends TranslateError {}

function model(): string {
  return process.env["BENCHMARK_TRANSLATE_MODEL"] || "gpt-4o-mini";
}

function cacheFile(target: TranslateTarget): string {
  const dir = path.join(benchmarkDir(), "translations");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${target}.json`);
}

function keyOf(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

// In-memory cache per target, loaded lazily from disk.
const caches = new Map<TranslateTarget, Map<string, string>>();
// Mutex: all translation work (LLM calls + cache writes) runs one batch at a
// time so concurrent requests dedup instead of paying twice for the same miss.
let translateLock: Promise<void> = Promise.resolve();
// Short-lived snapshot of the corpus hash-set (rebuilt lazily).
let knownCache: { set: Set<string>; at: number } | null = null;

function loadCache(target: TranslateTarget): Map<string, string> {
  const existing = caches.get(target);
  if (existing) return existing;
  const map = new Map<string, string>();
  try {
    const raw = fs.readFileSync(cacheFile(target), "utf-8");
    const obj = JSON.parse(raw) as Record<string, string>;
    for (const [k, v] of Object.entries(obj)) map.set(k, v);
  } catch {
    // No cache yet — start empty.
  }
  caches.set(target, map);
  return map;
}

async function writeCache(target: TranslateTarget): Promise<void> {
  const map = caches.get(target);
  if (!map) return;
  const obj: Record<string, string> = {};
  for (const [k, v] of map) obj[k] = v;
  const file = cacheFile(target);
  const tmp = `${file}.tmp`;
  await fs.promises.writeFile(tmp, JSON.stringify(obj), "utf-8");
  await fs.promises.rename(tmp, file);
}

function addKnown(set: Set<string>, text: string | null | undefined): void {
  if (typeof text === "string" && text.trim() !== "") set.add(keyOf(text));
}

/**
 * Hash-set of every source string the app may legitimately ask to translate:
 * dataset questions + expected answers, and stored run answers/verdicts.
 * Cached briefly so a translate request doesn't rescan all runs every call.
 */
function knownHashes(): Set<string> {
  if (knownCache && Date.now() - knownCache.at < KNOWN_TTL_MS) {
    return knownCache.set;
  }
  const set = new Set<string>();
  try {
    for (const q of listQuestions()) {
      addKnown(set, q.question);
      addKnown(set, q.expectedAnswerShort);
    }
  } catch (err) {
    logger.warn({ err }, "Corpus de traduction : lecture des questions échouée");
  }
  try {
    for (const run of listRuns()) {
      const res = getRunResults(run.id);
      if (!res) continue;
      for (const row of res.rows) {
        addKnown(set, row.question);
        addKnown(set, row.rawResponse);
        addKnown(set, row.verdict);
        addKnown(set, row.strengths);
        addKnown(set, row.weaknesses);
      }
    }
  } catch (err) {
    logger.warn({ err }, "Corpus de traduction : lecture des runs échouée");
  }
  knownCache = { set, at: Date.now() };
  return set;
}

async function callLLM(
  texts: string[],
  target: TranslateTarget,
): Promise<string[]> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    throw new TranslateError("OPENAI_API_KEY manquante pour la traduction.");
  }
  const targetLabel = target === "en" ? "English" : target;
  const system =
    `You are a professional translator specialised in biodiversity, ecology ` +
    `and environmental regulation. Translate each French string in the input ` +
    `array into ${targetLabel}. Preserve meaning, domain terminology, numbers, ` +
    `and the original formatting/line breaks. Do not add notes or commentary. ` +
    `Return strict JSON of the form {"translations": [...]} containing exactly ` +
    `${texts.length} items, in the same order as the input.`;
  const user = JSON.stringify({ input: texts });

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model(),
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new TranslateError(
      `Échec de l'API de traduction (${resp.status}): ${body.slice(0, 200)}`,
    );
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  let parsed: { translations?: unknown };
  try {
    parsed = JSON.parse(content) as { translations?: unknown };
  } catch {
    throw new TranslateError("Réponse de traduction illisible (JSON invalide).");
  }
  const out = parsed.translations;
  if (!Array.isArray(out) || out.length !== texts.length) {
    throw new TranslateError(
      "Réponse de traduction incohérente (nombre d'éléments inattendu).",
    );
  }
  return out.map((v, i) => (typeof v === "string" ? v : texts[i]!));
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await worker(items[idx]!);
    }
  });
  await Promise.all(runners);
}

/** Translate the given misses under the global mutex (serialized, deduped). */
async function translateMissesLocked(
  misses: string[],
  target: TranslateTarget,
  cache: Map<string, string>,
): Promise<void> {
  const prev = translateLock;
  let release!: () => void;
  translateLock = new Promise<void>((r) => {
    release = r;
  });
  try {
    await prev;
    // Re-check the cache: a concurrent request that ran just before us may have
    // already translated some/all of these, so we never pay twice.
    const stillMissing = misses.filter((t) => !cache.has(keyOf(t)));
    if (stillMissing.length === 0) return;
    const chunks: string[][] = [];
    for (let i = 0; i < stillMissing.length; i += CHUNK_SIZE) {
      chunks.push(stillMissing.slice(i, i + CHUNK_SIZE));
    }
    logger.info(
      { count: stillMissing.length, chunks: chunks.length, target },
      "Traduction de nouveaux textes",
    );
    await runWithConcurrency(chunks, MAX_CONCURRENCY, async (chunk) => {
      const translated = await callLLM(chunk, target);
      chunk.forEach((src, i) => cache.set(keyOf(src), translated[i]!));
    });
    await writeCache(target);
  } finally {
    release();
  }
}

/**
 * Translate an array of source strings, returning translations aligned to the
 * input order. Empty/whitespace strings and strings outside the benchmark
 * corpus pass through unchanged. Cache hits are free; misses are translated in
 * batches and cached permanently.
 */
export async function translateTexts(
  texts: string[],
  target: TranslateTarget = "en",
): Promise<string[]> {
  if (!Array.isArray(texts)) {
    throw new TranslateValidationError("`texts` doit être un tableau.");
  }
  if (texts.length > MAX_TEXTS) {
    throw new TranslateValidationError(
      `Trop de textes (${texts.length} > ${MAX_TEXTS}).`,
    );
  }
  const totalChars = texts.reduce((n, t) => n + (typeof t === "string" ? t.length : 0), 0);
  if (totalChars > MAX_TOTAL_CHARS) {
    throw new TranslateValidationError(
      `Texte trop volumineux (${totalChars} caractères).`,
    );
  }

  const cache = loadCache(target);
  const known = knownHashes();

  // Collect unique misses that are part of the benchmark corpus. Anything not
  // in the corpus is never translated (cost guard against a public endpoint).
  const misses: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    if (typeof text !== "string" || text.trim() === "") continue;
    const k = keyOf(text);
    if (cache.has(k) || seen.has(k) || !known.has(k)) continue;
    seen.add(k);
    misses.push(text);
  }

  if (misses.length > 0) {
    await translateMissesLocked(misses, target, cache);
  }

  return texts.map((text) => {
    if (typeof text !== "string" || text.trim() === "") return text ?? "";
    return cache.get(keyOf(text)) ?? text;
  });
}
