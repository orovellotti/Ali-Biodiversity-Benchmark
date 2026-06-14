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
  // Small open-source models via OpenRouter (Replit AI integration — key
  // provisioned automatically, billed to credits).
  { id: "llama-3.2-3b", envKey: "AI_INTEGRATIONS_OPENROUTER_API_KEY", defaultModel: process.env["LLAMA32_3B_MODEL"] ?? "meta-llama/llama-3.2-3b-instruct" },
  { id: "llama-3.2-1b", envKey: "AI_INTEGRATIONS_OPENROUTER_API_KEY", defaultModel: process.env["LLAMA32_1B_MODEL"] ?? "meta-llama/llama-3.2-1b-instruct" },
  { id: "qwen-2.5-7b", envKey: "AI_INTEGRATIONS_OPENROUTER_API_KEY", defaultModel: process.env["QWEN25_7B_MODEL"] ?? "qwen/qwen-2.5-7b-instruct" },
  { id: "ministral-8b", envKey: "AI_INTEGRATIONS_OPENROUTER_API_KEY", defaultModel: process.env["MINISTRAL_8B_MODEL"] ?? "mistralai/ministral-8b-2512" },
  { id: "gemma-3-4b", envKey: "AI_INTEGRATIONS_OPENROUTER_API_KEY", defaultModel: process.env["GEMMA3_4B_MODEL"] ?? "google/gemma-3-4b-it" },
  // Larger open-source models via OpenRouter (mid / large tiers).
  { id: "llama-3.3-70b", envKey: "AI_INTEGRATIONS_OPENROUTER_API_KEY", defaultModel: process.env["LLAMA33_70B_MODEL"] ?? "meta-llama/llama-3.3-70b-instruct" },
  { id: "mistral-small-24b", envKey: "AI_INTEGRATIONS_OPENROUTER_API_KEY", defaultModel: process.env["MISTRAL_SMALL_24B_MODEL"] ?? "mistralai/mistral-small-24b-instruct-2501" },
  { id: "gemma-2-27b", envKey: "AI_INTEGRATIONS_OPENROUTER_API_KEY", defaultModel: process.env["GEMMA2_27B_MODEL"] ?? "google/gemma-2-27b-it" },
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
  { match: "mistral-small-24b", size: "medium" },
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
  // OpenRouter dashed naming (e.g. meta-llama/llama-3.2-3b-instruct).
  { match: "llama-3.2", size: "small" },
  { match: "qwen-2.5-7b", size: "small" },
  { match: "qwen3-8b", size: "small" },
  { match: "gemma-3-4b", size: "small" },
  { match: "llama-3.3", size: "large" },
  { match: "gemma-2-27b", size: "medium" },
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
  // OpenRouter dashed naming (most-specific-first: 1b before the 3.2 default).
  { match: "llama-3.2-1b", params: "1B" },
  { match: "llama-3.2", params: "3B" },
  { match: "qwen-2.5-7b", params: "7B" },
  { match: "qwen3-8b", params: "8B" },
  { match: "gemma-3-4b", params: "4B" },
  { match: "llama-3.3", params: "70B" },
  { match: "mistral-small-24b", params: "24B" },
  { match: "gemma-2-27b", params: "27B" },
];

export function modelParams(model: string | null | undefined): string | null {
  if (!model) return null;
  const m = model.toLowerCase();
  for (const rule of PARAM_RULES) {
    if (m.includes(rule.match)) return rule.params;
  }
  return null;
}

// Open-source / open-weight models: those served via OpenRouter (the Replit AI
// integration) plus the local Ollama runner. Proprietary API models
// (OpenAI / Anthropic / Gemini / Mistral's hosted "-latest") are NOT open
// source. Keyed by provider id so the classification stays explicit and is the
// single source of truth shared by the dashboard "open source" tag.
const OPEN_SOURCE_PROVIDERS = new Set<string>([
  "ollama",
  "llama-3.2-3b",
  "llama-3.2-1b",
  "qwen-2.5-7b",
  "ministral-8b",
  "gemma-3-4b",
  "llama-3.3-70b",
  "mistral-small-24b",
  "gemma-2-27b",
]);

export function isOpenSource(providerId: string | null | undefined): boolean {
  if (!providerId) return false;
  return OPEN_SOURCE_PROVIDERS.has(providerId);
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

function providerAvailable(envKey: string | null): boolean {
  if (envKey == null) return false;
  if (!process.env[envKey]) return false;
  // OpenRouter (via Replit AI integration) needs BOTH the key and the base URL;
  // the Python subprocess fails to initialise the provider if either is missing.
  if (envKey === "AI_INTEGRATIONS_OPENROUTER_API_KEY") {
    return Boolean(process.env["AI_INTEGRATIONS_OPENROUTER_BASE_URL"]);
  }
  return true;
}

function providers(): Provider[] {
  return PROVIDER_DEFS.map((p) => ({
    id: p.id,
    defaultModel: p.defaultModel,
    requiresKey: p.envKey != null,
    // Ollama is local and not verifiable here; keyed providers depend on env.
    available: providerAvailable(p.envKey),
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
