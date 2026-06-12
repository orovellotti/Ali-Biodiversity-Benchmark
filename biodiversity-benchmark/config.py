"""Configuration centrale du benchmark biodiversité.

Toutes les valeurs sensibles (clés d'API) proviennent de variables
d'environnement. Les noms de modèles peuvent eux aussi être surchargés
par variables d'environnement pour faciliter les comparaisons.
"""

from __future__ import annotations

import os

# Les topics/sections disponibles sont désormais dérivés dynamiquement du jeu
# de données chargé (champ `section` ou `topic`), il n'y a plus de liste figée.

# Fournisseurs supportés et la variable d'environnement contenant leur clé.
# Ollama est local et ne nécessite pas de clé.
PROVIDER_API_KEYS = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "gemini": "GEMINI_API_KEY",
    # Petits modèles "baseline" volontairement plus faibles (mêmes clés que les
    # fournisseurs complets), utiles comme points de comparaison bas dans le
    # classement.
    "openai-small": "OPENAI_API_KEY",
    "anthropic-small": "ANTHROPIC_API_KEY",
    "ollama": None,
}

ALL_PROVIDERS = list(PROVIDER_API_KEYS.keys())

# Modèle par défaut pour chaque fournisseur. Surchargeable par env var.
DEFAULT_MODELS = {
    "openai": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
    "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929"),
    "mistral": os.environ.get("MISTRAL_MODEL", "mistral-large-latest"),
    "gemini": os.environ.get("GEMINI_MODEL", "gemini-2.0-flash"),
    "openai-small": os.environ.get("OPENAI_SMALL_MODEL", "gpt-3.5-turbo"),
    "anthropic-small": os.environ.get("ANTHROPIC_SMALL_MODEL", "claude-3-5-haiku-20241022"),
    "ollama": os.environ.get("OLLAMA_MODEL", "llama3.1"),
}

# Modèle utilisé par le juge LLM-as-judge (OpenAI par défaut).
JUDGE_MODEL = os.environ.get("OPENAI_JUDGE_MODEL", "gpt-4o-mini")

# URL du serveur Ollama local.
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

# Paramètres de génération.
MAX_TOKENS = int(os.environ.get("BENCHMARK_MAX_TOKENS", "1200"))
TEMPERATURE = float(os.environ.get("BENCHMARK_TEMPERATURE", "0.2"))
REQUEST_TIMEOUT = int(os.environ.get("BENCHMARK_TIMEOUT", "120"))

# Nombre de tentatives (retries) en cas d'erreur réseau / API.
MAX_RETRIES = int(os.environ.get("BENCHMARK_MAX_RETRIES", "3"))

# --------------------------------------------------------------------------- #
# Prompt standard envoyé aux modèles testés.
# --------------------------------------------------------------------------- #
SYSTEM_PROMPT = (
    "Tu es un assistant expert en biodiversité, réglementation "
    "environnementale, séquence ERC, études d'impact et restauration "
    "écologique.\n"
    "Réponds de manière professionnelle, nuancée et vérifiable.\n"
    "Si une information réglementaire dépend du pays, de la région, de la "
    "date ou d'un arrêté, indique qu'elle doit être vérifiée dans une source "
    "officielle.\n"
    "Ne fabrique pas de statut réglementaire."
)

USER_PROMPT_TEMPLATE = (
    "Question :\n{question}\n\n"
    "Format de sortie :\n"
    "- Réponse synthétique\n"
    "- Raisonnement\n"
    "- Sources ou types de sources à vérifier\n"
    "- Incertitudes / points nécessitant validation humaine"
)

# Consigne spécifique aux questions de raisonnement sur graphe de connaissance.
GRAPH_INSTRUCTION = (
    "Ce graphe de connaissance est la SEULE source autorisée pour répondre. "
    "N'ajoute aucun fait externe au graphe. Donne explicitement les chemins de "
    "preuve (la suite de triplets utilisés) et distingue clairement les effets "
    "directs des effets indirects."
)


def format_graph_context(graph: dict | None) -> str:
    """Formate un graphe de connaissance (triplets) en texte lisible, ou ''."""
    if not isinstance(graph, dict):
        return ""
    triples = graph.get("triples") or []
    if not isinstance(triples, (list, tuple)) or not triples:
        return ""
    name = graph.get("name", "")
    header = "# Graphe de connaissance fourni"
    if name:
        header += f" ({name})"
    lines = []
    for t in triples:
        if isinstance(t, (list, tuple)) and len(t) == 3:
            lines.append(f"- {t[0]} --[{t[1]}]--> {t[2]}")
        else:
            lines.append(f"- {t}")
    return header + "\n" + "\n".join(lines)


def build_user_prompt(question: dict) -> str:
    """Construit le prompt utilisateur standardisé pour une question.

    Pour les questions disposant d'un ``graph_context``, le graphe est injecté
    en tête du prompt avec la consigne de répondre uniquement à partir de
    celui-ci.
    """
    text = question.get("question", "")
    graph_block = format_graph_context(question.get("graph_context"))
    if graph_block:
        return (
            f"{graph_block}\n\n"
            f"{GRAPH_INSTRUCTION}\n\n"
            f"{USER_PROMPT_TEMPLATE.format(question=text)}"
        )
    return USER_PROMPT_TEMPLATE.format(question=text)


# --------------------------------------------------------------------------- #
# Prompt du juge (LLM-as-judge).
# --------------------------------------------------------------------------- #
JUDGE_SYSTEM_PROMPT = (
    "Tu es un évaluateur expert et impartial de réponses produites par des "
    "modèles d'IA sur des sujets de biodiversité, de réglementation "
    "environnementale, de séquence ERC (Éviter-Réduire-Compenser), d'études "
    "d'impact, de restauration écologique et d'arbitrages socio-écologiques.\n"
    "Tu notes chaque réponse de manière rigoureuse selon des critères "
    "précis et tu renvoies UNIQUEMENT un objet JSON valide, sans texte "
    "additionnel, sans bloc de code Markdown."
)

JUDGE_USER_TEMPLATE = """Évalue la réponse d'un modèle à une question de biodiversité.

# Question posée
{question}

# Type de question
{question_type} (topic : {topic}, difficulté : {difficulty})
{graph_section}
# Réponse attendue (squelette générique, non exhaustif)
{expected_answer}

# Critères d'évaluation officiels
{evaluation_criteria}

# Réponse du modèle à évaluer
{model_answer}

# Consignes de notation
- accuracy : exactitude scientifique (0 = fausse, 5 = excellente).
- uncertainty_handling : prise en compte des incertitudes et des limites (0-5).
- justification_quality : qualité et clarté du raisonnement (0-5).
- source_awareness : mention des sources ou types de sources à vérifier (0-5).
  Ne pénalise PAS sévèrement l'absence de sources exactes si la question
  demande seulement une stratégie ou une méthode.
- regulatory_hallucination_risk : ce score est INVERSÉ. 5 = aucun risque
  d'hallucination réglementaire (aucune affirmation réglementaire inventée),
  0 = fort risque (statuts, arrêtés ou protections affirmés sans réserve ni
  source). Pénalise fortement toute affirmation réglementaire non sourcée.
- overall_score : note globale de 0 à 100 synthétisant l'ensemble.
- Pour les questions d'arbitrage, valorise la présentation équilibrée des
  compromis (écologie / développement / parties prenantes) plutôt qu'une
  position militante unique.
- Pour les questions de raisonnement sur graphe de connaissance, vérifie la
  fidélité STRICTE au graphe fourni : pénalise tout fait ajouté absent des
  triplets, et valorise les chemins de preuve corrects ainsi que la distinction
  entre effets directs et indirects.

Renvoie STRICTEMENT ce JSON (et rien d'autre) :
{{
  "accuracy": 0-5,
  "uncertainty_handling": 0-5,
  "justification_quality": 0-5,
  "source_awareness": 0-5,
  "regulatory_hallucination_risk": 0-5,
  "overall_score": 0-100,
  "strengths": "...",
  "weaknesses": "...",
  "verdict": "..."
}}"""


def build_judge_prompt(question: dict, model_answer: str) -> str:
    """Construit le prompt du juge à partir d'une question et d'une réponse."""
    criteria = question.get("evaluation_criteria", [])
    criteria_txt = "\n".join(f"- {c}" for c in criteria) if criteria else "- (non précisés)"
    graph_block = format_graph_context(question.get("graph_context"))
    graph_section = (
        f"\n# Graphe de connaissance fourni au modèle (seule source autorisée)\n"
        f"{graph_block}\n"
        if graph_block
        else ""
    )
    return JUDGE_USER_TEMPLATE.format(
        question=question.get("question", ""),
        question_type=question.get("question_type", "?"),
        topic=question.get("topic") or question.get("section", "?"),
        difficulty=question.get("difficulty", "?"),
        graph_section=graph_section,
        expected_answer=question.get("expected_answer_short", "(non fournie)"),
        evaluation_criteria=criteria_txt,
        model_answer=model_answer,
    )


def get_api_key(provider: str) -> str | None:
    """Retourne la clé d'API d'un fournisseur, ou None si absente."""
    env_name = PROVIDER_API_KEYS.get(provider)
    if env_name is None:
        return None
    return os.environ.get(env_name)
