import fs from "node:fs";
import { datasetPath } from "./paths";

interface Question {
  id: string;
  topic?: string;
  section?: string;
  subtopic?: string;
  difficulty?: string;
  question_type?: string;
  country_scope?: string;
  question?: string;
  expected_answer_short?: string;
  graph_context?: unknown;
}

/**
 * The grouping/topic dimension. Newer datasets use `section` instead of `topic`;
 * older ones use `topic`. Treat them as the same dimension.
 */
function topicOf(q: Question): string | undefined {
  return q.topic ?? q.section;
}

interface DatasetCache {
  questions: Question[];
  topics: string[];
  difficulties: string[];
  questionTypes: string[];
}

let cache: DatasetCache | null = null;

function load(): DatasetCache {
  if (cache) return cache;
  const raw = fs.readFileSync(datasetPath(), "utf-8");
  const data = JSON.parse(raw) as { questions?: Question[] };
  const questions = data.questions ?? [];
  const topics = [
    ...new Set(questions.map((q) => topicOf(q)).filter(Boolean)),
  ] as string[];
  const difficulties = [
    ...new Set(questions.map((q) => q.difficulty).filter(Boolean)),
  ] as string[];
  const questionTypes = [
    ...new Set(questions.map((q) => q.question_type).filter(Boolean)),
  ] as string[];
  cache = { questions, topics, difficulties, questionTypes };
  return cache;
}

export interface QuestionPreview {
  id: string;
  topic: string | null;
  subtopic: string | null;
  difficulty: string | null;
  questionType: string | null;
  countryScope: string | null;
  question: string;
  expectedAnswerShort: string | null;
}

export function listQuestions(): QuestionPreview[] {
  return load().questions.map((q) => ({
    id: q.id,
    topic: topicOf(q) ?? null,
    subtopic: q.subtopic ?? null,
    difficulty: q.difficulty ?? null,
    questionType: q.question_type ?? null,
    countryScope: q.country_scope ?? null,
    question: q.question ?? "",
    expectedAnswerShort: q.expected_answer_short ?? null,
  }));
}

export function totalQuestions(): number {
  return load().questions.length;
}

export function topics(): string[] {
  return load().topics;
}

export function difficulties(): string[] {
  return load().difficulties;
}

export function questionTypes(): string[] {
  return load().questionTypes;
}

/** Number of questions a run will cover given a topic filter and limit. */
export function questionCount(
  topic: string | null,
  limit: number | null,
): number {
  let qs = load().questions;
  if (topic) qs = qs.filter((q) => topicOf(q) === topic);
  if (limit != null) qs = qs.slice(0, limit);
  return qs.length;
}
