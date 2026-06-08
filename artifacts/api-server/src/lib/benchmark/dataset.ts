import fs from "node:fs";
import { datasetPath } from "./paths";

interface Question {
  id: string;
  topic?: string;
  difficulty?: string;
  question_type?: string;
}

interface DatasetCache {
  questions: Question[];
  difficulties: string[];
  questionTypes: string[];
}

let cache: DatasetCache | null = null;

function load(): DatasetCache {
  if (cache) return cache;
  const raw = fs.readFileSync(datasetPath(), "utf-8");
  const data = JSON.parse(raw) as { questions?: Question[] };
  const questions = data.questions ?? [];
  const difficulties = [
    ...new Set(questions.map((q) => q.difficulty).filter(Boolean)),
  ] as string[];
  const questionTypes = [
    ...new Set(questions.map((q) => q.question_type).filter(Boolean)),
  ] as string[];
  cache = { questions, difficulties, questionTypes };
  return cache;
}

export function totalQuestions(): number {
  return load().questions.length;
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
  if (topic) qs = qs.filter((q) => q.topic === topic);
  if (limit != null) qs = qs.slice(0, limit);
  return qs.length;
}
