import fs from "node:fs";
import path from "node:path";

let cachedRoot: string | null = null;

/** Walk up from cwd to locate the biodiversity-benchmark CLI directory. */
export function benchmarkDir(): string {
  if (cachedRoot) return cachedRoot;
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    const candidate = path.join(dir, "biodiversity-benchmark");
    if (fs.existsSync(path.join(candidate, "main.py"))) {
      cachedRoot = candidate;
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    "Impossible de localiser le dossier biodiversity-benchmark (main.py introuvable).",
  );
}

export function datasetPath(): string {
  return path.join(
    benchmarkDir(),
    "biodiversity_benchmark_100_v4.json",
  );
}

export function runsDir(): string {
  const dir = path.join(benchmarkDir(), "runs");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const RUN_ID_RE = /^[A-Za-z0-9_-]+$/;

/** Validate a runId and resolve its directory, guarding against path traversal. */
export function runDir(runId: string): string {
  if (typeof runId !== "string" || !RUN_ID_RE.test(runId)) {
    throw new Error(`Identifiant de run invalide : ${runId}`);
  }
  const base = runsDir();
  const resolved = path.resolve(base, runId);
  const rel = path.relative(base, resolved);
  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(`Identifiant de run invalide : ${runId}`);
  }
  return resolved;
}
