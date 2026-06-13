import { Router, type IRouter, type RequestHandler } from "express";
import { createHash, timingSafeEqual } from "node:crypto";
import {
  CreateRunBody,
  GetArenaDuelResponse,
  GetArenaLeaderboardResponse,
  GetBenchmarkConfigResponse,
  GetQuestionAnswersResponse,
  GetRunResponse,
  GetRunResultsResponse,
  ListRunsResponse,
  ListQuestionsResponse,
  ListQuestionVotesResponse,
  SubmitArenaVoteBody,
  SubmitContactBody,
  SubmitQuestionVoteBody,
  TranslateTextsBody,
} from "@workspace/api-zod";
import { appendFileSync } from "node:fs";
import { getBenchmarkConfig } from "../lib/benchmark/config";
import { listQuestions } from "../lib/benchmark/dataset";
import { contactFilePath } from "../lib/benchmark/paths";
import {
  ConcurrentRunError,
  createRun,
  deleteRun,
  getRun,
  listRuns,
  ValidationError,
} from "../lib/benchmark/runner";
import { getRunResults } from "../lib/benchmark/results";
import {
  ArenaVoteError,
  buildDuel,
  getLeaderboard,
  recordVote,
} from "../lib/benchmark/arena";
import {
  QuestionVoteError,
  listQuestionVotes,
  recordQuestionVote,
} from "../lib/benchmark/question-votes";
import {
  answersForQuestion,
  isKnownQuestion,
} from "../lib/benchmark/question-answers";
import {
  TranslateValidationError,
  translateTexts,
} from "../lib/benchmark/translate";

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

  // Hash both sides to fixed-length digests so the comparison does constant
  // work regardless of input length (no length short-circuit that could leak
  // the configured password's length through timing).
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(configured).digest();
  const ok = timingSafeEqual(a, b);

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

router.get("/benchmark/questions/:questionId/answers", (req, res) => {
  const questionId = req.params.questionId;
  if (!isKnownQuestion(questionId)) {
    res.status(404).json({ error: "Question inconnue" });
    return;
  }
  const data = GetQuestionAnswersResponse.parse(answersForQuestion(questionId));
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
    if (err instanceof ConcurrentRunError) {
      res.status(409).json({ error: err.message });
      return;
    }
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

router.post("/benchmark/contact", (req, res) => {
  const parsed = SubmitContactBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Message invalide",
    });
    return;
  }
  try {
    const entry = {
      ...parsed.data,
      receivedAt: new Date().toISOString(),
    };
    appendFileSync(contactFilePath(), JSON.stringify(entry) + "\n", "utf-8");
    res.status(201).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Échec de l'enregistrement du message de contact");
    res.status(500).json({
      error: "Erreur interne lors de l'envoi du message.",
    });
  }
});

// Display-only FR->EN translation (cached permanently). French stays the
// source of truth; this only powers the EN view of questions/answers. Public,
// consistent with the rest of the read API, and cost-bounded by the cache.
router.post("/benchmark/translate", async (req, res) => {
  const parsed = TranslateTextsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Requête de traduction invalide",
    });
    return;
  }
  try {
    const translations = await translateTexts(parsed.data.texts, parsed.data.target);
    res.json({ translations });
  } catch (err) {
    if (err instanceof TranslateValidationError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Échec de la traduction");
    res.status(502).json({
      error: "La traduction a échoué. Réessayez plus tard.",
    });
  }
});

// --- Community arena (blind duels over already-generated answers) ---------

router.get("/benchmark/arena/duel", (_req, res) => {
  const duel = buildDuel();
  if (!duel) {
    res.status(404).json({
      error:
        "Pas assez de réponses générées pour créer un duel (il faut au moins deux modèles ayant répondu à une même question).",
    });
    return;
  }
  res.json(GetArenaDuelResponse.parse(duel));
});

router.post("/benchmark/arena/vote", (req, res) => {
  const parsed = SubmitArenaVoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Vote invalide" });
    return;
  }
  try {
    const result = recordVote(parsed.data.duelToken, parsed.data.winner);
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof ArenaVoteError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Échec de l'enregistrement du vote arène");
    res.status(500).json({ error: "Erreur interne lors de l'enregistrement du vote." });
  }
});

router.get("/benchmark/arena/leaderboard", (_req, res) => {
  res.json(GetArenaLeaderboardResponse.parse(getLeaderboard()));
});

// --- Community question voting (public up/down on dataset questions) -------

router.get("/benchmark/questions/votes", (_req, res) => {
  res.json(ListQuestionVotesResponse.parse(listQuestionVotes()));
});

router.post("/benchmark/questions/vote", (req, res) => {
  const parsed = SubmitQuestionVoteBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Vote invalide" });
    return;
  }
  try {
    const result = recordQuestionVote(
      parsed.data.questionId,
      parsed.data.voterId,
      parsed.data.vote,
    );
    res.status(201).json(result);
  } catch (err) {
    if (err instanceof QuestionVoteError) {
      res.status(400).json({ error: err.message });
      return;
    }
    req.log.error({ err }, "Échec de l'enregistrement du vote question");
    res.status(500).json({ error: "Erreur interne lors de l'enregistrement du vote." });
  }
});

export default router;
