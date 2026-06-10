import type { BenchmarkConfig, Provider } from "@workspace/api-zod";
import {
  difficulties,
  questionTypes,
  topics,
  totalQuestions,
} from "./dataset";

interface ProviderDef {
  id: string;
  envKey: string | null;
  defaultModel: string;
}

const PROVIDER_DEFS: ProviderDef[] = [
  { id: "openai", envKey: "OPENAI_API_KEY", defaultModel: process.env["OPENAI_MODEL"] ?? "gpt-4o-mini" },
  { id: "anthropic", envKey: "ANTHROPIC_API_KEY", defaultModel: process.env["ANTHROPIC_MODEL"] ?? "claude-sonnet-4-5-20250929" },
  { id: "mistral", envKey: "MISTRAL_API_KEY", defaultModel: process.env["MISTRAL_MODEL"] ?? "mistral-large-latest" },
  { id: "gemini", envKey: "GEMINI_API_KEY", defaultModel: process.env["GEMINI_MODEL"] ?? "gemini-2.0-flash" },
  { id: "openai-small", envKey: "OPENAI_API_KEY", defaultModel: process.env["OPENAI_SMALL_MODEL"] ?? "gpt-3.5-turbo" },
  { id: "ollama", envKey: null, defaultModel: process.env["OLLAMA_MODEL"] ?? "llama3.1" },
];

export const VALID_PROVIDERS = PROVIDER_DEFS.map((p) => p.id);

// Approximate size class for a model. Exact parameter counts are not published
// by most providers, so these are qualitative tiers (Petit / Moyen / Grand)
// based on each model's positioning. Matched by substring on the model name.
const SIZE_RULES: { match: string; size: string }[] = [
  { match: "gpt-3.5", size: "Petit" },
  { match: "gpt-4o-mini", size: "Petit" },
  { match: "gpt-4o", size: "Grand" },
  { match: "o1-mini", size: "Petit" },
  { match: "flash", size: "Petit" },
  { match: "haiku", size: "Petit" },
  { match: "sonnet", size: "Grand" },
  { match: "opus", size: "Grand" },
  { match: "mistral-small", size: "Petit" },
  { match: "ministral", size: "Petit" },
  { match: "mistral-large", size: "Grand" },
  { match: "gemini-2.0-pro", size: "Grand" },
  { match: "gemini-1.5-pro", size: "Grand" },
  { match: "llama3.1", size: "Moyen" },
];

export function modelSize(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  for (const rule of SIZE_RULES) {
    if (m.includes(rule.match)) return rule.size;
  }
  return null;
}

export function judgeModel(): string {
  return process.env["OPENAI_JUDGE_MODEL"] ?? "gpt-4o-mini";
}

/**
 * Server-enforced ceiling on model requests (models × questions) for a single
 * non-simulation run. Bounds the worst-case API spend so a careless launch
 * can't drain all credits. Configurable via BENCHMARK_MAX_REQUESTS_PER_RUN
 * (positive integer); defaults to a conservative 400.
 */
export function maxRequestsPerRun(): number {
  const raw = process.env["BENCHMARK_MAX_REQUESTS_PER_RUN"];
  const parsed = raw != null ? Number.parseInt(raw, 10) : NaN;
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 400;
}

export function judgeAvailable(): boolean {
  return Boolean(process.env["OPENAI_API_KEY"]);
}

function providers(): Provider[] {
  return PROVIDER_DEFS.map((p) => ({
    id: p.id,
    defaultModel: p.defaultModel,
    requiresKey: p.envKey != null,
    // Ollama is local and not verifiable here; keyed providers depend on env.
    available: p.envKey == null ? false : Boolean(process.env[p.envKey]),
  }));
}

export function getBenchmarkConfig(): BenchmarkConfig {
  return {
    providers: providers(),
    topics: topics(),
    difficulties: difficulties(),
    questionTypes: questionTypes(),
    judgeModel: judgeModel(),
    judgeAvailable: judgeAvailable(),
    totalQuestions: totalQuestions(),
    maxRequestsPerRun: maxRequestsPerRun(),
  };
}
