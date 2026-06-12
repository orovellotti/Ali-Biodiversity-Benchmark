"""Point d'entrée du benchmark biodiversité multi-LLM.

Exemple :
    python main.py --input biodiversity_benchmark_100_v4.json \\
        --models openai,mistral,anthropic,gemini --limit 50
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time

from tqdm import tqdm

try:
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dotenv optionnel
    pass

import config
from evaluator import Judge
from providers import ProviderError, get_provider
from report import generate_all_reports

logger = logging.getLogger("benchmark")


# --------------------------------------------------------------------------- #
# Suivi de progression (fichier JSON lisible par le serveur web)
# --------------------------------------------------------------------------- #
def write_progress(
    path: str | None,
    phase: str,
    completed: int,
    total: int,
    extra: dict | None = None,
) -> None:
    """Écrit l'état d'avancement dans un fichier JSON (écriture atomique)."""
    if not path:
        return
    payload = {
        "phase": phase,
        "completed": completed,
        "total": total,
        "updated_at": time.time(),
    }
    if extra:
        payload.update(extra)
    try:
        directory = os.path.dirname(path)
        if directory:
            os.makedirs(directory, exist_ok=True)
        tmp = f"{path}.tmp"
        with open(tmp, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, ensure_ascii=False)
        os.replace(tmp, path)
    except Exception:  # pragma: no cover - le suivi ne doit jamais interrompre
        pass


# --------------------------------------------------------------------------- #
# Chargement et filtrage des questions
# --------------------------------------------------------------------------- #
def load_questions(path: str) -> tuple[dict, list[dict]]:
    """Charge le fichier JSON et renvoie (metadata, questions)."""
    if not os.path.exists(path):
        raise FileNotFoundError(f"Fichier introuvable : {path}")
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    meta = data.get("metadata", {})
    questions = data.get("questions", [])
    if not questions:
        raise ValueError("Aucune question trouvée dans le fichier JSON.")
    return meta, questions


def topic_of(question: dict) -> str | None:
    """Dimension de regroupement : ``topic`` (anciens jeux) ou ``section``."""
    return question.get("topic") or question.get("section")


def filter_questions(
    questions: list[dict],
    topic: str | None,
    limit: int | None,
    offset: int | None = None,
) -> list[dict]:
    """Filtre par topic/section, applique un décalage puis une limite."""
    filtered = questions
    if topic:
        filtered = [q for q in filtered if topic_of(q) == topic]
        if not filtered:
            available = sorted({t for q in questions if (t := topic_of(q))})
            raise ValueError(
                f"Aucune question pour le topic {topic!r}. "
                f"Topics disponibles : {', '.join(available)}"
            )
    if offset is not None:
        if offset < 0:
            raise ValueError("Le décalage (--offset) doit être positif ou nul.")
        filtered = filtered[offset:]
    if limit is not None:
        if limit < 1:
            raise ValueError("La limite (--limit) doit être un entier positif.")
        filtered = filtered[:limit]
    return filtered


# --------------------------------------------------------------------------- #
# Sélection et initialisation des fournisseurs
# --------------------------------------------------------------------------- #
def parse_models(models_arg: str | None) -> list[str]:
    if not models_arg or models_arg.strip().lower() == "all":
        return list(config.ALL_PROVIDERS)
    names = [m.strip().lower() for m in models_arg.split(",") if m.strip()]
    for n in names:
        if n not in config.ALL_PROVIDERS:
            raise ValueError(
                f"Modèle/fournisseur inconnu : {n!r}. "
                f"Disponibles : {', '.join(config.ALL_PROVIDERS)}"
            )
    return names


def init_providers(names: list[str], dry_run: bool) -> list:
    """Instancie les fournisseurs disponibles ; ignore ceux sans clé."""
    providers = []
    for name in names:
        provider = get_provider(name)
        if dry_run:
            providers.append(provider)
            continue
        if not provider.is_available():
            logger.warning(
                "Fournisseur %s ignoré (clé/serveur indisponible).", name
            )
            continue
        providers.append(provider)
    return providers


# --------------------------------------------------------------------------- #
# Boucle principale d'interrogation
# --------------------------------------------------------------------------- #
def query_models(
    providers: list,
    questions: list[dict],
    dry_run: bool,
    progress_file: str | None = None,
) -> list[dict]:
    """Interroge chaque modèle pour chaque question."""
    raw_results: list[dict] = []
    total = len(providers) * len(questions)
    completed = 0
    write_progress(progress_file, "query", completed, total)
    pbar = tqdm(total=total, desc="Interrogation", unit="req")

    for provider in providers:
        for q in questions:
            user_prompt = config.build_user_prompt(q)
            record = {
                "question_id": q.get("id"),
                "topic": topic_of(q),
                "subtopic": q.get("subtopic"),
                "difficulty": q.get("difficulty"),
                "question_type": q.get("question_type"),
                "country_scope": q.get("country_scope"),
                "question": q.get("question"),
                "provider": provider.name,
                "model": provider.model,
                "raw_response": "",
                "latency_seconds": None,
                "error": "",
            }

            if dry_run:
                record["raw_response"] = "[DRY-RUN] Aucune requête envoyée."
                record["latency_seconds"] = 0.0
                raw_results.append(record)
                completed += 1
                pbar.update(1)
                write_progress(progress_file, "query", completed, total)
                continue

            start = time.time()
            try:
                answer = provider.generate(config.SYSTEM_PROMPT, user_prompt)
                record["raw_response"] = answer
            except Exception as exc:  # journalise sans interrompre le benchmark
                record["error"] = f"{type(exc).__name__}: {exc}"
                logger.error(
                    "Erreur %s sur %s : %s",
                    provider.name,
                    q.get("id"),
                    exc,
                )
            finally:
                record["latency_seconds"] = round(time.time() - start, 3)

            raw_results.append(record)
            completed += 1
            pbar.update(1)
            write_progress(progress_file, "query", completed, total)

    pbar.close()
    return raw_results


# --------------------------------------------------------------------------- #
# Évaluation LLM-as-judge
# --------------------------------------------------------------------------- #
def evaluate_results(
    raw_results: list[dict],
    questions_by_id: dict,
    dry_run: bool,
    progress_file: str | None = None,
) -> list[dict]:
    """Évalue chaque réponse via le juge et fusionne les scores."""
    evaluated: list[dict] = []
    total = len(raw_results)
    completed = 0
    write_progress(progress_file, "evaluate", completed, total)

    judge = None
    if not dry_run:
        judge = Judge()
        if not judge.is_available():
            logger.error(
                "OPENAI_API_KEY absente : impossible d'évaluer. Les réponses "
                "brutes sont conservées sans notation."
            )
            judge = None

    for record in tqdm(raw_results, desc="Évaluation", unit="rép"):
        merged = dict(record)
        # Valeurs par défaut des scores.
        scores = {
            "accuracy": None,
            "uncertainty_handling": None,
            "justification_quality": None,
            "source_awareness": None,
            "regulatory_hallucination_risk": None,
            "overall_score": None,
            "strengths": "",
            "weaknesses": "",
            "verdict": "",
        }

        if record["error"]:
            scores["verdict"] = "Non évalué (erreur d'appel du modèle)."
        elif dry_run:
            scores["verdict"] = "[DRY-RUN] Non évalué."
        elif judge is None:
            scores["verdict"] = "Non évalué (juge indisponible)."
        else:
            question = questions_by_id.get(record["question_id"], {})
            try:
                evaluation = judge.evaluate(question, record["raw_response"])
                scores.update(evaluation.model_dump())
            except Exception as exc:
                scores["verdict"] = f"Évaluation échouée : {exc}"
                logger.error(
                    "Échec d'évaluation %s/%s : %s",
                    record["model"],
                    record["question_id"],
                    exc,
                )

        merged.update(scores)
        evaluated.append(merged)
        completed += 1
        write_progress(progress_file, "evaluate", completed, total)

    return evaluated


# --------------------------------------------------------------------------- #
# Persistance JSONL
# --------------------------------------------------------------------------- #
def write_jsonl(rows: list[dict], path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False) + "\n")


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #
def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Benchmark multi-LLM sur le Biodiversity Judgment Benchmark.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--input",
        default="biodiversity_benchmark_100_v4.json",
        help="Chemin du fichier JSON du benchmark.",
    )
    parser.add_argument(
        "--models",
        default="all",
        help="Liste de fournisseurs séparés par des virgules "
        "(openai,anthropic,mistral,gemini,openai-small,anthropic-small,ollama) ou 'all'.",
    )
    parser.add_argument(
        "--topic",
        default=None,
        help="Limiter le benchmark à un topic/section (valeurs lues dans le jeu de données).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Nombre maximum de questions (test rapide).",
    )
    parser.add_argument(
        "--offset",
        type=int,
        default=None,
        help="Nombre de questions à ignorer avant d'appliquer la limite (lots successifs).",
    )
    parser.add_argument(
        "--judge-model",
        default=config.JUDGE_MODEL,
        help="Modèle OpenAI utilisé comme juge.",
    )
    parser.add_argument(
        "--output-dir",
        default="outputs",
        help="Dossier de sortie des résultats et rapports.",
    )
    parser.add_argument(
        "--progress-file",
        default=None,
        help="Fichier JSON où écrire l'avancement (utilisé par l'interface web).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="N'appelle aucune API ; vérifie le pipeline de bout en bout.",
    )
    parser.add_argument(
        "--no-eval",
        action="store_true",
        help="Interroge les modèles mais saute l'évaluation par le juge.",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Active les logs détaillés.",
    )
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # Le juge peut être surchargé en CLI.
    config.JUDGE_MODEL = args.judge_model

    try:
        meta, all_questions = load_questions(args.input)
        questions = filter_questions(
            all_questions, args.topic, args.limit, args.offset
        )
        model_names = parse_models(args.models)
    except (FileNotFoundError, ValueError) as exc:
        logger.error("%s", exc)
        return 1

    logger.info(
        "%d question(s) sélectionnée(s) | fournisseurs demandés : %s",
        len(questions),
        ", ".join(model_names),
    )

    providers = init_providers(model_names, args.dry_run)
    if not providers:
        logger.error(
            "Aucun fournisseur disponible. Ajoutez les clés d'API dans les "
            "Secrets (OPENAI_API_KEY, ANTHROPIC_API_KEY, MISTRAL_API_KEY, "
            "GEMINI_API_KEY) ou démarrez Ollama, puis relancez."
        )
        return 1

    logger.info(
        "Fournisseurs actifs : %s",
        ", ".join(f"{p.name}({p.model})" for p in providers),
    )

    # 1. Interrogation des modèles
    raw_results = query_models(
        providers, questions, args.dry_run, args.progress_file
    )
    raw_path = os.path.join(args.output_dir, "raw_results.jsonl")
    write_jsonl(raw_results, raw_path)
    logger.info("Réponses brutes écrites dans %s", raw_path)

    # 2. Évaluation
    questions_by_id = {q.get("id"): q for q in all_questions}
    dry_or_skip = args.dry_run or args.no_eval
    evaluated = evaluate_results(
        raw_results, questions_by_id, dry_or_skip, args.progress_file
    )
    eval_path = os.path.join(args.output_dir, "evaluated_results.jsonl")
    write_jsonl(evaluated, eval_path)
    logger.info("Résultats évalués écrits dans %s", eval_path)

    # 3. Rapports
    write_progress(args.progress_file, "report", len(evaluated), len(evaluated))
    meta = dict(meta)
    meta["judge_model"] = config.JUDGE_MODEL
    generate_all_reports(evaluated, args.output_dir, meta=meta)

    write_progress(args.progress_file, "done", len(evaluated), len(evaluated))
    logger.info("Terminé. Consultez %s/report.md", args.output_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
