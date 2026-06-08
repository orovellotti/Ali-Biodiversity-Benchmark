import type { BenchmarkConfig, Provider } from "@workspace/api-zod";
import {
  difficulties,
  questionTypes,
  totalQuestions,
} from "./dataset";

export const TOPICS = [
  "taxonomie",
  "statuts_reglementaires",
  "sequence_erc",
  "etude_impact",
  "restauration_ecologique",
  "especes_protegees",
  "services_ecosystemiques",
  "arbitrages_socio_ecologiques",
];

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

export function judgeModel(): string {
  return process.env["OPENAI_JUDGE_MODEL"] ?? "gpt-4o-mini";
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
    topics: TOPICS,
    difficulties: difficulties(),
    questionTypes: questionTypes(),
    judgeModel: judgeModel(),
    judgeAvailable: judgeAvailable(),
    totalQuestions: totalQuestions(),
  };
}
