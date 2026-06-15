"""Évaluateur LLM-as-judge (OpenAI par défaut).

Le juge note chaque réponse selon les critères du benchmark et renvoie un
JSON strict validé par pydantic.
"""

from __future__ import annotations

import json
import logging
import random
import re
from collections import defaultdict
from contextlib import contextmanager
from statistics import mean

from pydantic import BaseModel, Field, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential

import config
from providers import get_provider

logger = logging.getLogger("benchmark.evaluator")

# Critères notés de 0 à 5 (regulatory_hallucination_risk est INVERSÉ).
CRIT_KEYS = (
    "accuracy",
    "uncertainty_handling",
    "justification_quality",
    "source_awareness",
    "regulatory_hallucination_risk",
)


class Evaluation(BaseModel):
    """Schéma strict renvoyé par le juge."""

    accuracy: int = Field(ge=0, le=5)
    uncertainty_handling: int = Field(ge=0, le=5)
    justification_quality: int = Field(ge=0, le=5)
    source_awareness: int = Field(ge=0, le=5)
    # Score INVERSÉ : 5 = faible risque d'hallucination, 0 = fort risque.
    regulatory_hallucination_risk: int = Field(ge=0, le=5)
    overall_score: int = Field(ge=0, le=100)
    strengths: str = ""
    weaknesses: str = ""
    verdict: str = ""


def _extract_json(text: str) -> dict:
    """Extrait le premier objet JSON valide d'une réponse texte."""
    text = text.strip()
    # Retire un éventuel bloc de code Markdown ```json ... ```
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        text = fence.group(1)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        # Cherche le premier { ... } englobant.
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            return json.loads(match.group(0))
        raise


class Judge:
    """Juge LLM utilisant OpenAI pour évaluer les réponses des modèles."""

    def __init__(self, model: str | None = None):
        self.model = model or config.JUDGE_MODEL
        self._client = None

    def _get_client(self):
        if self._client is None:
            api_key = config.get_api_key("openai")
            if not api_key:
                raise RuntimeError(
                    "OPENAI_API_KEY manquante : le juge LLM-as-judge nécessite "
                    "une clé OpenAI. Ajoutez-la dans les Secrets."
                )
            from openai import OpenAI

            self._client = OpenAI(api_key=api_key, timeout=config.REQUEST_TIMEOUT)
        return self._client

    def is_available(self) -> bool:
        return bool(config.get_api_key("openai"))

    @retry(
        reraise=True,
        stop=stop_after_attempt(config.MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=2, max=30),
    )
    def _call_judge(self, prompt: str) -> str:
        client = self._get_client()
        resp = client.chat.completions.create(
            model=self.model,
            messages=[
                {"role": "system", "content": config.JUDGE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content or ""

    def evaluate(self, question: dict, model_answer: str) -> Evaluation:
        """Évalue une réponse et renvoie une instance Evaluation validée."""
        prompt = config.build_judge_prompt(question, model_answer)
        raw = self._call_judge(prompt)
        data = _extract_json(raw)
        try:
            return Evaluation(**data)
        except ValidationError as exc:
            logger.warning("JSON du juge invalide, valeurs ajustées : %s", exc)
            # Tentative de récupération : on borne les valeurs.
            cleaned = {}
            for key, (lo, hi) in {
                "accuracy": (0, 5),
                "uncertainty_handling": (0, 5),
                "justification_quality": (0, 5),
                "source_awareness": (0, 5),
                "regulatory_hallucination_risk": (0, 5),
                "overall_score": (0, 100),
            }.items():
                try:
                    cleaned[key] = max(lo, min(hi, int(round(float(data.get(key, 0))))))
                except (TypeError, ValueError):
                    cleaned[key] = 0
            cleaned["strengths"] = str(data.get("strengths", ""))
            cleaned["weaknesses"] = str(data.get("weaknesses", ""))
            cleaned["verdict"] = str(data.get("verdict", ""))
            return Evaluation(**cleaned)


# --------------------------------------------------------------------------- #
# Juge COMPARATIF (multi-juges, classement par rangs)
# --------------------------------------------------------------------------- #
def _label_for(index: int) -> str:
    """Étiquette de réponse anonyme : 0->A, 25->Z, 26->AA, ..."""
    label = ""
    index += 1
    while index:
        index, rem = divmod(index - 1, 26)
        label = chr(65 + rem) + label
    return label


@contextmanager
def _judge_generation_params():
    """Force temporairement les paramètres de génération propres au juge.

    Les fournisseurs lisent ``config.TEMPERATURE`` / ``config.MAX_TOKENS`` à
    l'appel ; le benchmark étant séquentiel (mono-thread), on les bascule le
    temps de l'appel du juge puis on les restaure.
    """
    prev_t, prev_m = config.TEMPERATURE, config.MAX_TOKENS
    config.TEMPERATURE = config.JUDGE_TEMPERATURE
    config.MAX_TOKENS = config.JUDGE_MAX_TOKENS
    try:
        yield
    finally:
        config.TEMPERATURE, config.MAX_TOKENS = prev_t, prev_m


def _clamp(value, lo, hi, default):
    try:
        return max(lo, min(hi, float(value)))
    except (TypeError, ValueError):
        return default


def _coerce_ranked(data: dict) -> list[dict]:
    """Normalise la liste d'évaluations renvoyée par un juge comparatif."""
    items = data.get("evaluations")
    if not isinstance(items, list):
        raise ValueError("Champ 'evaluations' manquant ou invalide.")
    out: list[dict] = []
    for raw in items:
        if not isinstance(raw, dict):
            continue
        label = str(raw.get("label", "")).strip()
        if not label:
            continue
        entry = {"label": label}
        for key in CRIT_KEYS:
            entry[key] = _clamp(raw.get(key), 0, 5, 0.0)
        entry["overall_score"] = _clamp(raw.get("overall_score"), 0, 100, 0.0)
        entry["rank"] = _clamp(raw.get("rank"), 1, 9999, 1.0)
        entry["verdict"] = str(raw.get("verdict", "")).strip()
        out.append(entry)
    if not out:
        raise ValueError("Aucune évaluation exploitable.")
    return out


class RankingJudge:
    """Juge comparatif : note et classe TOUTES les réponses d'une question.

    Utilise l'abstraction ``providers`` afin de supporter n'importe quel
    fournisseur (OpenAI, Anthropic, Gemini, ...). Une seule requête par
    (question, juge), quel que soit le nombre de réponses à classer.
    """

    def __init__(self, provider_name: str, model: str):
        self.provider_name = provider_name
        self.model = model
        self.family = config.provider_family(provider_name)
        self.label = f"{provider_name}:{model}"
        self._provider = get_provider(provider_name, model=model)

    def is_available(self) -> bool:
        return self._provider.is_available()

    @retry(
        reraise=True,
        stop=stop_after_attempt(config.MAX_RETRIES),
        wait=wait_exponential(multiplier=1, min=2, max=30),
    )
    def _call(self, prompt: str) -> str:
        with _judge_generation_params():
            return self._provider.generate(
                config.JUDGE_RANK_SYSTEM_PROMPT, prompt
            )

    def evaluate(
        self, question: dict, labeled_answers: list[tuple[str, str]]
    ) -> list[dict]:
        prompt = config.build_ranking_judge_prompt(question, labeled_answers)
        raw = self._call(prompt)
        data = _extract_json(raw)
        return _coerce_ranked(data)


def build_judge_panel(dry_run: bool = False) -> list[RankingJudge]:
    """Construit le panel de juges disponibles à partir de config.JUDGE_MODELS."""
    panel: list[RankingJudge] = []
    families: set[str] = set()
    for provider_name, model in config.JUDGE_MODELS:
        try:
            judge = RankingJudge(provider_name, model)
        except Exception as exc:
            logger.warning("Juge %s:%s ignoré : %s", provider_name, model, exc)
            continue
        if not dry_run and not judge.is_available():
            logger.warning(
                "Juge %s ignoré (clé/serveur indisponible).", judge.label
            )
            continue
        panel.append(judge)
        families.add(judge.family)
    if panel and len(families) == 1:
        logger.warning(
            "Tous les juges disponibles appartiennent à la même famille (%s) : "
            "l'exclusion d'auto-évaluation peut laisser certaines réponses non "
            "notées.",
            next(iter(families)),
        )
    return panel


def _is_answerable(record: dict) -> bool:
    if record.get("error"):
        return False
    resp = (record.get("raw_response") or "").strip()
    if not resp or resp.startswith("[DRY-RUN]"):
        return False
    return True


def _empty_scores(verdict: str) -> dict:
    scores = {key: None for key in CRIT_KEYS}
    scores.update(
        {
            "overall_score": None,
            "rank_in_question": None,
            "n_judges": 0,
            "strengths": "",
            "weaknesses": "",
            "verdict": verdict,
        }
    )
    return scores


def evaluate_run(
    raw_results: list[dict],
    questions_by_id: dict,
    judges: list[RankingJudge],
    progress=None,
) -> list[dict]:
    """Évalue toutes les réponses par classement comparatif multi-juges.

    Pour chaque question : les réponses exploitables sont anonymisées et
    mélangées, chaque juge les note et les classe en un appel. On agrège ensuite
    (moyenne) par (modèle, question), en EXCLUANT tout juge de la même famille
    que le modèle évalué (anti auto-évaluation).
    """
    by_question: dict[str, list[dict]] = defaultdict(list)
    for record in raw_results:
        by_question[record.get("question_id")].append(record)

    evaluated: list[dict] = []
    for qid, records in by_question.items():
        question = questions_by_id.get(qid, {})
        answerable = [r for r in records if _is_answerable(r)]
        acc: dict[int, dict] = {
            id(r): {
                "crit": defaultdict(list),
                "overall": [],
                "rank": [],
                "verdicts": [],
            }
            for r in records
        }

        if answerable and judges:
            shuffled = answerable[:]
            random.shuffle(shuffled)
            labels = [_label_for(i) for i in range(len(shuffled))]
            label_to_record = dict(zip(labels, shuffled))
            labeled_answers = [
                (lbl, rec.get("raw_response") or "")
                for lbl, rec in zip(labels, shuffled)
            ]
            for judge in judges:
                try:
                    items = judge.evaluate(question, labeled_answers)
                except Exception as exc:
                    logger.error(
                        "Juge %s a échoué sur %s : %s", judge.label, qid, exc
                    )
                    continue
                for item in items:
                    rec = label_to_record.get(item["label"])
                    if rec is None:
                        continue
                    # Exclusion d'auto-évaluation (même famille de fournisseur).
                    if config.provider_family(rec.get("provider", "")) == judge.family:
                        continue
                    bucket = acc[id(rec)]
                    for key in CRIT_KEYS:
                        bucket["crit"][key].append(item[key])
                    bucket["overall"].append(item["overall_score"])
                    bucket["rank"].append(item["rank"])
                    if item["verdict"]:
                        bucket["verdicts"].append(
                            f"[{judge.label}] {item['verdict']}"
                        )

        for rec in records:
            merged = dict(rec)
            bucket = acc[id(rec)]
            n_judges = len(bucket["rank"])
            if n_judges == 0:
                if rec.get("error"):
                    reason = "Non évalué (erreur d'appel du modèle)."
                elif not _is_answerable(rec):
                    reason = "Non évalué (réponse vide ou dry-run)."
                else:
                    reason = "Non évalué (aucun juge éligible)."
                merged.update(_empty_scores(reason))
            else:
                scores: dict = {}
                for key in CRIT_KEYS:
                    scores[key] = round(mean(bucket["crit"][key]), 2)
                scores["overall_score"] = round(mean(bucket["overall"]), 1)
                scores["rank_in_question"] = round(mean(bucket["rank"]), 2)
                scores["n_judges"] = n_judges
                scores["strengths"] = ""
                scores["weaknesses"] = ""
                scores["verdict"] = " | ".join(bucket["verdicts"])
                merged.update(scores)
            evaluated.append(merged)

        if progress:
            progress(len(records))

    return evaluated
