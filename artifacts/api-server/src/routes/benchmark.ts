import { Router, type IRouter, type RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";
import {
  CreateRunBody,
  GetBenchmarkConfigResponse,
  GetRunResponse,
  GetRunResultsResponse,
  ListRunsResponse,
  ListQuestionsResponse,
} from "@workspace/api-zod";
import { getBenchmarkConfig } from "../lib/benchmark/config";
import { listQuestions } from "../lib/benchmark/dataset";
import {
  createRun,
  deleteRun,
  getRun,
  listRuns,
  ValidationError,
} from "../lib/benchmark/runner";
import { getRunResults } from "../lib/benchmark/results";

const router: IRouter = Router();

/**
 * Guard for write actions (launching / deleting runs). Browsing stays public,
 * but mutating endpoints require a shared admin password supplied as a
 * `Authorization: Bearer <password>` header, compared against the
 * `BENCHMARK_ADMIN_PASSWORD` secret. If no password is configured, writes are
 * disabled entirely (safer default for a publicly-shared tool).
 */
const requireAdmin: RequestHandler = (req, res, next) => {
  const configured = process.env["BENCHMARK_ADMIN_PASSWORD"];
  if (!configured) {
    res.status(503).json({
      error:
        "Le lancement d'évaluations est désactivé : aucun mot de passe administrateur n'est configuré.",
    });
    return;
  }

  const header = req.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  const a = Buffer.from(provided);
  const b = Buffer.from(configured);
  const ok = a.length === b.length && timingSafeEqual(a, b);

  if (!ok) {
    res.status(401).json({
      error: "Mot de passe administrateur invalide ou manquant.",
    });
    return;
  }

  next();
};

router.get("/benchmark/config", (_req, res) => {
  const data = GetBenchmarkConfigResponse.parse(getBenchmarkConfig());
  res.json(data);
});

router.get("/benchmark/questions", (_req, res) => {
  const data = ListQuestionsResponse.parse(listQuestions());
  res.json(data);
});

router.get("/benchmark/runs", (_req, res) => {
  const data = ListRunsResponse.parse(listRuns());
  res.json(data);
});

router.post("/benchmark/admin/session", requireAdmin, (_req, res) => {
  res.status(204).end();
});

router.post("/benchmark/runs", requireAdmin, (req, res) => {
  const parsed = CreateRunBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Requête invalide" });
    return;
  }
  try {
    const run = createRun(parsed.data);
    res.status(201).json(GetRunResponse.parse(run));
  } catch (err) {
    if (err instanceof ValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Échec de création du run");
    res.status(500).json({ error: "Erreur interne lors du lancement du benchmark." });
  }
});

router.get("/benchmark/runs/:runId", (req, res) => {
  const run = getRun(req.params.runId);
  if (!run) {
    res.status(404).json({ error: "Run introuvable." });
    return;
  }
  res.json(GetRunResponse.parse(run));
});

router.delete("/benchmark/runs/:runId", requireAdmin, (req, res) => {
  const ok = deleteRun(req.params.runId as string);
  if (!ok) {
    res.status(404).json({ error: "Run introuvable." });
    return;
  }
  res.status(204).end();
});

router.get("/benchmark/runs/:runId/results", (req, res) => {
  const results = getRunResults(req.params.runId);
  if (!results) {
    res.status(404).json({ error: "Run introuvable." });
    return;
  }
  res.json(GetRunResultsResponse.parse(results));
});

export default router;
