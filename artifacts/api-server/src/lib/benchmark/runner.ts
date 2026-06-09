import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Run, RunInput } from "@workspace/api-zod";
import { logger } from "../logger";
import { benchmarkDir, runDir, runsDir } from "./paths";
import { questionCount, totalQuestions, topics } from "./dataset";
import { judgeModel, VALID_PROVIDERS } from "./config";

interface RunMeta {
  id: string;
  status: string;
  models: string[];
  limit: number | null;
  topic: string | null;
  dryRun: boolean;
  noEval: boolean;
  questionCount: number | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  judgeModel: string | null;
}

interface ProgressFile {
  phase?: string;
  completed?: number;
  total?: number;
}

const children = new Map<string, ChildProcess>();

function metaPath(id: string): string {
  return path.join(runDir(id), "meta.json");
}

function statusPath(id: string): string {
  return path.join(runDir(id), "status.json");
}

function readMeta(id: string): RunMeta | null {
  try {
    return JSON.parse(fs.readFileSync(metaPath(id), "utf-8")) as RunMeta;
  } catch {
    return null;
  }
}

function writeMeta(meta: RunMeta): void {
  fs.mkdirSync(runDir(meta.id), { recursive: true });
  const tmp = `${metaPath(meta.id)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(meta, null, 2), "utf-8");
  fs.renameSync(tmp, metaPath(meta.id));
}

function readProgress(id: string): ProgressFile {
  try {
    return JSON.parse(fs.readFileSync(statusPath(id), "utf-8")) as ProgressFile;
  } catch {
    return {};
  }
}

function toRun(meta: RunMeta): Run {
  const progress = readProgress(meta.id);
  const total = progress.total ?? meta.questionCount ?? 0;
  const completed = progress.completed ?? 0;
  return {
    id: meta.id,
    status: meta.status,
    phase: progress.phase ?? "",
    models: meta.models,
    limit: meta.limit,
    topic: meta.topic,
    dryRun: meta.dryRun,
    noEval: meta.noEval,
    completed,
    total,
    questionCount: meta.questionCount,
    createdAt: meta.createdAt,
    startedAt: meta.startedAt,
    finishedAt: meta.finishedAt,
    error: meta.error,
    judgeModel: meta.judgeModel,
  };
}

function newId(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const rand = Math.random().toString(36).slice(2, 7);
  return `${stamp}-${rand}`;
}

/** Reconcile any runs left in "running" state after a server restart. */
export function reconcileOnStartup(): void {
  let entries: string[];
  try {
    entries = fs.readdirSync(runsDir());
  } catch {
    return;
  }
  for (const id of entries) {
    const meta = readMeta(id);
    if (meta && (meta.status === "running" || meta.status === "queued")) {
      meta.status = "interrupted";
      meta.error = meta.error ?? "Interrompu par un redémarrage du serveur.";
      meta.finishedAt = meta.finishedAt ?? new Date().toISOString();
      writeMeta(meta);
    }
  }
}

export function listRuns(): Run[] {
  let entries: string[];
  try {
    entries = fs.readdirSync(runsDir());
  } catch {
    return [];
  }
  const runs = entries
    .map((id) => readMeta(id))
    .filter((m): m is RunMeta => m != null)
    .map(toRun);
  runs.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  return runs;
}

export function getRun(id: string): Run | null {
  const meta = readMeta(id);
  return meta ? toRun(meta) : null;
}

export function deleteRun(id: string): boolean {
  const meta = readMeta(id);
  if (!meta) return false;
  const child = children.get(id);
  if (child) {
    child.kill("SIGTERM");
    children.delete(id);
  }
  fs.rmSync(runDir(id), { recursive: true, force: true });
  return true;
}

export function createRun(input: RunInput): Run {
  const models = input.models
    .map((m) => m.trim().toLowerCase())
    .filter(Boolean);
  const invalid = models.filter((m) => !VALID_PROVIDERS.includes(m));
  if (models.length === 0) {
    throw new ValidationError("Au moins un modèle doit être sélectionné.");
  }
  if (invalid.length > 0) {
    throw new ValidationError(`Fournisseur(s) inconnu(s) : ${invalid.join(", ")}`);
  }

  const limit = input.limit ?? null;
  const topic = input.topic ?? null;
  if (limit != null) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new ValidationError("La limite doit être un entier positif.");
    }
    if (limit > totalQuestions()) {
      throw new ValidationError(
        `La limite ne peut pas dépasser ${totalQuestions()} questions.`,
      );
    }
  }
  if (topic != null && !topics().includes(topic)) {
    throw new ValidationError(`Topic inconnu : ${topic}`);
  }
  const dryRun = input.dryRun ?? false;
  const noEval = input.noEval ?? false;
  const id = newId();

  const meta: RunMeta = {
    id,
    status: "running",
    models,
    limit,
    topic,
    dryRun,
    noEval,
    questionCount: questionCount(topic, limit),
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: null,
    error: null,
    judgeModel: dryRun || noEval ? null : judgeModel(),
  };
  writeMeta(meta);

  const outputDir = runDir(id);
  const args = [
    "main.py",
    "--models",
    models.join(","),
    "--output-dir",
    outputDir,
    "--progress-file",
    statusPath(id),
  ];
  if (limit != null) args.push("--limit", String(limit));
  if (topic) args.push("--topic", topic);
  if (dryRun) args.push("--dry-run");
  if (noEval) args.push("--no-eval");

  const logStream = fs.createWriteStream(path.join(outputDir, "run.log"), {
    flags: "a",
  });
  const child = spawn("python3", args, {
    cwd: benchmarkDir(),
    env: process.env,
  });
  child.stdout.pipe(logStream);
  child.stderr.pipe(logStream);
  children.set(id, child);

  child.on("error", (err) => {
    logger.error({ err, runId: id }, "Échec du lancement du benchmark");
    finalize(id, "failed", `Échec du lancement : ${err.message}`);
  });
  child.on("close", (code) => {
    children.delete(id);
    if (code === 0) {
      finalize(id, "completed", null);
    } else {
      finalize(id, "failed", `Le processus s'est terminé avec le code ${code}.`);
    }
  });

  logger.info({ runId: id, models, limit, topic, dryRun, noEval }, "Benchmark lancé");
  return toRun(meta);
}

function finalize(id: string, status: string, error: string | null): void {
  const meta = readMeta(id);
  if (!meta) return;
  meta.status = status;
  meta.error = error;
  meta.finishedAt = new Date().toISOString();
  writeMeta(meta);
}

export class ValidationError extends Error {}
