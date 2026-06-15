# Biodiversity Judgment Benchmark — Banc d'essai multi-LLM

Application Python qui interroge plusieurs modèles d'IA (OpenAI, Anthropic,
Mistral, Google Gemini, Ollama local, plus des modèles open-weight via
OpenRouter) sur les **106 questions** du *Biodiversity Judgment Benchmark*,
fait évaluer leurs réponses par un **panel de juges LLM cross-fournisseurs** en
**classement comparatif**, puis produit un rapport comparatif complet.

Sujets couverts : connaissances factuelles (faciles et expertes), biais et
dilemmes, dilemmes moraux, raisonnement implicite sur graphe de connaissances,
et **questions « pièges »** (taxons / arrêtés / lois inventés destinés à
détecter les hallucinations).

## 1. Structure du projet

```
biodiversity-benchmark/
├── main.py                 # CLI : chargement, interrogation, évaluation, rapports
├── config.py               # Modèles, prompts standard, panel de juges, prompt du juge
├── evaluator.py            # Juges LLM en classement comparatif (sortie JSON stricte, pydantic)
├── report.py               # Génération des CSV et du rapport Markdown
├── providers/
│   ├── base.py             # Interface commune + retries (tenacity)
│   ├── openai_provider.py
│   ├── anthropic_provider.py
│   ├── mistral_provider.py
│   ├── gemini_provider.py
│   ├── openrouter_provider.py  # Modèles open-weight (Llama, Qwen, Gemma, Ministral…)
│   └── ollama_provider.py  # Ollama local (HTTP, sans clé)
├── requirements.txt
├── outputs/                # Résultats et rapports générés
└── biodiversity_benchmark_100_v4.json   # Dataset par défaut (106 questions)
```

## 2. Le dataset

Le fichier par défaut est `biodiversity_benchmark_100_v4.json` (106 questions).
Sa structure :

| Section | Questions | Objet |
|---|---|---|
| `factual_easy` | 20 | Connaissances de base. |
| `factual_expert` | 20 | Connaissances expertes. |
| `bias_and_dilemmas` | 20 | Détection de biais, arbitrages. |
| `moral_dilemmas` | 20 | Dilemmes éthiques socio-écologiques. |
| `implicit_knowledge_graph_reasoning` | 20 | Raisonnement relationnel implicite. |
| `factual_trap` | 6 | **Pièges** : espèce / sous-espèce, arrêté ou loi **inventés**. La bonne réponse **refuse d'inventer** un statut/une aire, signale que le taxon ou le texte n'existe pas, et renvoie vers des sources officielles. |

Pour remplacer le dataset, déposez un nouveau JSON dans le dossier et passez son
chemin via `--input`.

## 3. Ajouter les secrets d'API

Dans Replit, ouvrez l'onglet **Secrets** (icône cadenas) et ajoutez les clés des
fournisseurs que vous souhaitez tester :

| Secret | Fournisseur | Obligatoire ? |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI (réponses **et** juge) | Oui pour la notation. |
| `ANTHROPIC_API_KEY` | Anthropic / Claude (réponses + juge) | Optionnel. |
| `MISTRAL_API_KEY` | Mistral AI | Optionnel. |
| `GEMINI_API_KEY` | Google Gemini (réponses + juge) | Optionnel. |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` (+ base URL) | OpenRouter (modèles open-weight) | Optionnel. |

> ⚠️ **Quotas.** Un juge ou un modèle dont la clé est en **palier gratuit à
> quota nul** échouera (HTTP 429 `RESOURCE_EXHAUSTED`) : ses réponses seront
> vides et il sera exclu du classement. Vérifiez que les clés utilisées comme
> **juges** disposent d'un quota payant.

Ollama est **local** et ne nécessite aucune clé : démarrez `ollama serve` et
téléchargez le modèle (`ollama pull llama3.1`).

### Choisir les modèles (optionnel)

Les noms de modèles ont des valeurs par défaut surchargeables par variables
d'environnement, par exemple :

| Variable | Défaut |
|---|---|
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-5-20250929` |
| `MISTRAL_MODEL` | `mistral-large-latest` |
| `GEMINI_MODEL` | `gemini-2.0-flash` |
| `OLLAMA_MODEL` | `llama3.1` |
| `BENCHMARK_MAX_TOKENS` | `600` (réponses volontairement succinctes) |

## 4. Méthodologie d'évaluation

L'évaluation a été repensée autour de quatre principes :

1. **Classement comparatif avec ex æquo.** Plutôt qu'une note absolue isolée,
   chaque juge **classe ensemble** toutes les réponses à une même question
   (réponses **anonymisées et mélangées**). Le classement final trie les modèles
   par **rang moyen** croissant (plus bas = meilleur) ; le score sur 100 reste
   un critère secondaire. Les **égalités** partagent le même rang.
2. **Panel de juges cross-fournisseurs.** Plusieurs juges récents et de
   fournisseurs différents votent (défaut : `openai:gpt-4o`,
   `anthropic:claude-sonnet-4-5-20250929`, `gemini:gemini-2.0-flash`).
   Surchargeable via `BENCHMARK_JUDGES` (format
   `provider:model,provider:model`).
3. **Anti-auto-évaluation.** Un modèle n'est **jamais** noté par un juge de sa
   **propre famille** (openai / anthropic / gemini / mistral). Le nombre de
   juges effectifs par réponse est enregistré (`n_judges`).
4. **Réponses succinctes.** Les prompts demandent des réponses concises et
   `MAX_TOKENS` est abaissé (600), pour des réponses plus comparables et moins
   coûteuses.

Une seule requête par (question, juge) est émise : un juge classe toutes les
réponses d'une question en un appel. Les réponses vides ou en erreur sont
exclues du classement (`rank_in_question = null`).

## 5. Lancer un test rapide

Vérifier le pipeline **sans appeler aucune API** (gratuit) :

```bash
cd biodiversity-benchmark
python main.py --dry-run --limit 5
```

Test réel sur quelques questions et quelques modèles :

```bash
python main.py --models openai,mistral --limit 10
```

Restreindre à une section / un topic :

```bash
python main.py --models openai --topic factual_trap
```

## 6. Lancer le benchmark complet

```bash
python main.py \
  --models openai,anthropic,mistral,gemini \
  --limit 50
```

Pour toutes les questions, retirez `--limit`.

### Lancer par lots (`--offset`)

Un run complet peut être long ; découpez-le en lots de questions
non chevauchants avec `--offset` (la sélection suit l'ordre
topic → offset → limit) :

```bash
python main.py --models openai,anthropic,mistral --offset 0  --limit 27
python main.py --models openai,anthropic,mistral --offset 27 --limit 27
python main.py --models openai,anthropic,mistral --offset 54 --limit 27
python main.py --models openai,anthropic,mistral --offset 81 --limit 25
```

### Options de la ligne de commande

| Option | Description |
|---|---|
| `--input` | Chemin du fichier JSON du benchmark (défaut : `biodiversity_benchmark_100_v4.json`). |
| `--models` | `all` ou liste séparée par des virgules. `openai-small` (gpt-3.5-turbo) et `anthropic-small` (Claude Haiku 4.5) sont des « baselines » plus légères réutilisant les mêmes clés. Les modèles open-weight (`llama-3.3-70b`, `qwen-2.5-7b`, `gemma-2-27b`, …) passent par OpenRouter. |
| `--topic` | Restreint à une section / un topic du benchmark. |
| `--limit N` | Limite le nombre de questions. |
| `--offset N` | Décale le point de départ de la sélection (lots non chevauchants). |
| `--judge-model` | Modèle OpenAI utilisé comme juge de secours. |
| `--output-dir` | Dossier de sortie (défaut : `outputs`). |
| `--progress-file` | Fichier JSON de progression (consommé par l'interface web). |
| `--dry-run` | N'appelle aucune API ; valide le pipeline. |
| `--no-eval` | Interroge les modèles mais saute l'évaluation. |
| `--verbose` | Logs détaillés. |

## 7. Lire les résultats

Tous les fichiers sont écrits dans `outputs/` :

| Fichier | Contenu |
|---|---|
| `raw_results.jsonl` | Réponse brute de chaque modèle (1 ligne / réponse). |
| `evaluated_results.jsonl` | Réponses + agrégat des juges (dont `rank_in_question`, `n_judges`). |
| `comparison.csv` | Tableau plat (question × modèle) avec tous les scores. |
| `summary_by_model.csv` | Classement et moyennes par modèle (rang moyen). |
| `summary_by_topic.csv` | Moyennes par modèle et par topic. |
| `report.md` | Rapport comparatif complet (à lire en premier). |

### Critères d'évaluation (juge)

Pour chaque réponse classée, le juge renvoie un JSON strict :

```json
{
  "accuracy": 0-5,
  "uncertainty_handling": 0-5,
  "justification_quality": 0-5,
  "source_awareness": 0-5,
  "regulatory_hallucination_risk": 0-5,
  "overall_score": 0-100,
  "rank": 1,
  "verdict": "..."
}
```

Les critères et le score sont **moyennés** sur les juges effectifs ; le
`rank` de chaque juge est moyenné en `rank_in_question`.

> ⚠️ `regulatory_hallucination_risk` est **inversé** : **5 = faible risque**
> d'hallucination réglementaire, **0 = fort risque**. Les affirmations
> réglementaires non sourcées — et la validation d'un taxon/texte **inventé**
> dans les questions pièges — sont fortement pénalisées.

Le rapport `report.md` contient : classement global par **rang moyen**, scores
par modèle, par topic et par difficulté, meilleures et pires réponses, analyse
des risques d'hallucination réglementaire, comportement sur les questions
pièges, et recommandations.

## 8. Robustesse

- Retries automatiques (tenacity) sur les erreurs réseau / API.
- Les erreurs d'un modèle sont journalisées **sans interrompre** le benchmark.
- Les fournisseurs et juges sans clé (ou à quota nul) sont automatiquement
  ignorés ; un modèle non noté apparaît sans rang.
- Le juge récupère les JSON imparfaits et borne les scores hors limites.

---

> Cette CLI est aussi pilotée par une interface web (artifact `benchmark-ui` +
> serveur `api-server`). Voir `replit.md` à la racine du projet pour
> l'architecture complète.
