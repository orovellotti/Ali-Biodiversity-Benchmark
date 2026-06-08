import { Router, type IRouter } from "express";
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

router.post("/benchmark/runs", (req, res) => {
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

router.delete("/benchmark/runs/:runId", (req, res) => {
  const ok = deleteRun(req.params.runId);
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
