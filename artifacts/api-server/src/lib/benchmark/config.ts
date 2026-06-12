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
  { id: "anthropic-small", envKey: "ANTHROPIC_API_KEY", defaultModel: process.env["ANTHROPIC_SMALL_MODEL"] ?? "claude-haiku-4-5-20251001" },
  { id: "ollama", envKey: null, defaultModel: process.env["OLLAMA_MODEL"] ?? "llama3.1" },
];

export const VALID_PROVIDERS = PROVIDER_DEFS.map((p) => p.id);

// Approximate size class for a model. Exact parameter counts are not published
// by most providers, so these are qualitative tiers. Values are i18n keys
// (small / medium / large) translated in the UI. Matched by substring on the
// model name.
const SIZE_RULES: { match: string; size: "small" | "medium" | "large" }[] = [
  { match: "gpt-3.5", size: "small" },
  { match: "gpt-4o-mini", size: "small" },
  { match: "gpt-4o", size: "large" },
  { match: "o1-mini", size: "small" },
  { match: "flash", size: "small" },
  { match: "haiku", size: "small" },
  { match: "sonnet", size: "large" },
  { match: "opus", size: "large" },
  { match: "mistral-small", size: "small" },
  { match: "ministral", size: "small" },
  { match: "mistral-large", size: "large" },
  { match: "gemini-2.0-pro", size: "large" },
  { match: "gemini-1.5-pro", size: "large" },
  { match: "mistral-7b", size: "small" },
  { match: "mixtral", size: "large" },
  { match: "llama3.1", size: "medium" },
  { match: "llama3.2", size: "small" },
  { match: "llama3.3", size: "large" },
];

export function modelSize(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  for (const rule of SIZE_RULES) {
    if (m.includes(rule.match)) return rule.size;
  }
  return null;
}

// Officially published parameter counts. Only open-weight models disclose these;
// proprietary API models (OpenAI/Anthropic/Gemini, Mistral's hosted "-latest")
// do NOT publish counts, so they return null (the UI then shows only the tier).
// Ordered most-specific-first so larger tagged variants win over the family
// default. Matched by substring on the model name.
const PARAM_RULES: { match: string; params: string }[] = [
  { match: "llama-3.1-405b", params: "405B" },
  { match: "llama3.1:405b", params: "405B" },
  { match: "llama-3.1-70b", params: "70B" },
  { match: "llama3.1:70b", params: "70B" },
  { match: "llama3.1", params: "8B" },
  { match: "llama3.3", params: "70B" },
  { match: "llama3.2:1b", params: "1B" },
  { match: "llama3.2", params: "3B" },
  { match: "ministral-8b", params: "8B" },
  { match: "ministral-3b", params: "3B" },
  { match: "mixtral-8x22b", params: "141B" },
  { match: "mixtral-8x7b", params: "47B" },
  { match: "mistral-7b", params: "7B" },
];

export function modelParams(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  for (const rule of PARAM_RULES) {
    if (m.includes(rule.match)) return rule.params;
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
