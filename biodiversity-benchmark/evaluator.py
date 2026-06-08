"""Évaluateur LLM-as-judge (OpenAI par défaut).

Le juge note chaque réponse selon les critères du benchmark et renvoie un
JSON strict validé par pydantic.
"""

from __future__ import annotations

import json
import logging
import re

from pydantic import BaseModel, Field, ValidationError
from tenacity import retry, stop_after_attempt, wait_exponential

import config

logger = logging.getLogger("benchmark.evaluator")


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
