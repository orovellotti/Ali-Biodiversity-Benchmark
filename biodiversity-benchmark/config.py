"""Configuration centrale du benchmark biodiversité.

Toutes les valeurs sensibles (clés d'API) proviennent de variables
d'environnement. Les noms de modèles peuvent eux aussi être surchargés
par variables d'environnement pour faciliter les comparaisons.
"""

from __future__ import annotations

import os

# --------------------------------------------------------------------------- #
# Topics disponibles dans le benchmark (utilisés par --topic)
# --------------------------------------------------------------------------- #
TOPICS = [
    "taxonomie",
    "statuts_reglementaires",
    "sequence_erc",
    "etude_impact",
    "restauration_ecologique",
    "especes_protegees",
    "services_ecosystemiques",
    "arbitrages_socio_ecologiques",
]

# Fournisseurs supportés et la variable d'environnement contenant leur clé.
# Ollama est local et ne nécessite pas de clé.
PROVIDER_API_KEYS = {
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
    "mistral": "MISTRAL_API_KEY",
    "gemini": "GEMINI_API_KEY",
    "ollama": None,
}

ALL_PROVIDERS = list(PROVIDER_API_KEYS.keys())

# Modèle par défaut pour chaque fournisseur. Surchargeable par env var.
DEFAULT_MODELS = {
    "openai": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
    "anthropic": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929"),
    "mistral": os.environ.get("MISTRAL_MODEL", "mistral-large-latest"),
    "gemini": os.environ.get("GEMINI_MODEL", "gemini-1.5-flash"),
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


def build_user_prompt(question: str) -> str:
    """Construit le prompt utilisateur standardisé pour une question."""
    return USER_PROMPT_TEMPLATE.format(question=question)


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
    return JUDGE_USER_TEMPLATE.format(
        question=question.get("question", ""),
        question_type=question.get("question_type", "?"),
        topic=question.get("topic", "?"),
        difficulty=question.get("difficulty", "?"),
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
