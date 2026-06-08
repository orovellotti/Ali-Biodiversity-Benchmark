import fs from "node:fs";
import path from "node:path";
import type {
  GroupSummary,
  ModelSummary,
  ResultRow,
  RunResults,
} from "@workspace/api-zod";
import { runDir } from "./paths";
import { getRun } from "./runner";
import { modelSize } from "./config";

interface RawRow {
  question_id?: string;
  topic?: string | null;
  subtopic?: string | null;
  difficulty?: string | null;
  question_type?: string | null;
  country_scope?: string | null;
  question?: string | null;
  provider?: string;
  model?: string;
  raw_response?: string | null;
  latency_seconds?: number | null;
  error?: string | null;
  accuracy?: number | null;
  uncertainty_handling?: number | null;
  justification_quality?: number | null;
  source_awareness?: number | null;
  regulatory_hallucination_risk?: number | null;
  overall_score?: number | null;
  strengths?: string | null;
  weaknesses?: string | null;
  verdict?: string | null;
}

const SCORE_FIELDS = [
  "accuracy",
  "uncertaintyHandling",
  "justificationQuality",
  "sourceAwareness",
  "regulatoryHallucinationRisk",
  "overallScore",
] as const;

function nullableNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function nullableStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function toRow(raw: RawRow): ResultRow {
  return {
    questionId: raw.question_id ?? "",
    topic: nullableStr(raw.topic),
    subtopic: nullableStr(raw.subtopic),
    difficulty: nullableStr(raw.difficulty),
    questionType: nullableStr(raw.question_type),
    countryScope: nullableStr(raw.country_scope),
    question: nullableStr(raw.question),
    provider: raw.provider ?? "",
    model: raw.model ?? "",
    rawResponse: nullableStr(raw.raw_response),
    latencySeconds: nullableNum(raw.latency_seconds),
    error: raw.error ? String(raw.error) : null,
    accuracy: nullableNum(raw.accuracy),
    uncertaintyHandling: nullableNum(raw.uncertainty_handling),
    justificationQuality: nullableNum(raw.justification_quality),
    sourceAwareness: nullableNum(raw.source_awareness),
    regulatoryHallucinationRisk: nullableNum(raw.regulatory_hallucination_risk),
    overallScore: nullableNum(raw.overall_score),
    strengths: nullableStr(raw.strengths),
    weaknesses: nullableStr(raw.weaknesses),
    verdict: nullableStr(raw.verdict),
  };
}

function readRows(id: string): ResultRow[] {
  const file = path.join(runDir(id), "evaluated_results.jsonl");
  let content: string;
  try {
    content = fs.readFileSync(file, "utf-8");
  } catch {
    return [];
  }
  const rows: ResultRow[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      rows.push(toRow(JSON.parse(trimmed) as RawRow));
    } catch {
      // ignore malformed line
    }
  }
  return rows;
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((a, b) => a + b, 0);
  return Math.round((sum / values.length) * 100) / 100;
}

function collect(rows: ResultRow[], field: (typeof SCORE_FIELDS)[number]): number[] {
  return rows
    .map((r) => r[field])
    .filter((v): v is number => typeof v === "number");
}

function summarizeModels(rows: ResultRow[]): ModelSummary[] {
  const groups = new Map<string, ResultRow[]>();
  for (const r of rows) {
    const key = `${r.provider}::${r.model}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const out: ModelSummary[] = [];
  for (const group of groups.values()) {
    const first = group[0]!;
    const latencies = group
      .map((r) => r.latencySeconds)
      .filter((v): v is number => typeof v === "number");
    out.push({
      provider: first.provider,
      model: first.model,
      size: modelSize(first.model),
      nQuestions: group.length,
      nErrors: group.filter((r) => r.error).length,
      avgLatency: avg(latencies),
      accuracy: avg(collect(group, "accuracy")),
      uncertaintyHandling: avg(collect(group, "uncertaintyHandling")),
      justificationQuality: avg(collect(group, "justificationQuality")),
      sourceAwareness: avg(collect(group, "sourceAwareness")),
      regulatoryHallucinationRisk: avg(collect(group, "regulatoryHallucinationRisk")),
      overallScore: avg(collect(group, "overallScore")),
    });
  }
  out.sort((a, b) => (b.overallScore ?? -1) - (a.overallScore ?? -1));
  return out;
}

function summarizeByGroup(
  rows: ResultRow[],
  groupKey: (r: ResultRow) => string | null | undefined,
): GroupSummary[] {
  const groups = new Map<string, ResultRow[]>();
  for (const r of rows) {
    const g = groupKey(r);
    if (!g) continue;
    const key = `${g}::${r.provider}::${r.model}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(r);
  }
  const out: GroupSummary[] = [];
  for (const group of groups.values()) {
    const first = group[0]!;
    out.push({
      group: groupKey(first) ?? "",
      provider: first.provider,
      model: first.model,
      overallScore: avg(collect(group, "overallScore")),
      accuracy: avg(collect(group, "accuracy")),
      uncertaintyHandling: avg(collect(group, "uncertaintyHandling")),
      justificationQuality: avg(collect(group, "justificationQuality")),
      sourceAwareness: avg(collect(group, "sourceAwareness")),
      regulatoryHallucinationRisk: avg(collect(group, "regulatoryHallucinationRisk")),
    });
  }
  out.sort((a, b) => a.group.localeCompare(b.group));
  return out;
}

export function getRunResults(id: string): RunResults | null {
  const run = getRun(id);
  if (!run) return null;
  const rows = readRows(id);
  return {
    run,
    summaryByModel: summarizeModels(rows),
    summaryByTopic: summarizeByGroup(rows, (r) => r.topic),
    summaryByDifficulty: summarizeByGroup(rows, (r) => r.difficulty),
    rows,
  };
}
