# Biodiversity Judgment Benchmark — Banc d'essai multi-LLM

Application Python qui interroge plusieurs modèles d'IA (OpenAI, Anthropic,
Mistral, Google Gemini, Ollama local) sur les **800 questions** du
*Biodiversity Judgment Benchmark*, évalue automatiquement leurs réponses avec
un juge **LLM-as-judge**, puis produit un rapport comparatif complet.

Sujets couverts : taxonomie, statuts réglementaires, séquence ERC, études
d'impact, restauration écologique, espèces protégées, services
écosystémiques, arbitrages socio-écologiques.

## 1. Structure du projet

```
biodiversity-benchmark/
├── main.py                 # CLI : chargement, interrogation, évaluation, rapports
├── config.py               # Modèles, prompts standard et prompt du juge
├── evaluator.py            # Juge LLM-as-judge (sortie JSON stricte, pydantic)
├── report.py               # Génération des CSV et du rapport Markdown
├── providers/
│   ├── base.py             # Interface commune + retries (tenacity)
│   ├── openai_provider.py
│   ├── anthropic_provider.py
│   ├── mistral_provider.py
│   ├── gemini_provider.py
│   └── ollama_provider.py  # Ollama local (HTTP, sans clé)
├── requirements.txt
├── outputs/                # Résultats et rapports générés
└── biodiversity_judgment_benchmark_800_questions.json
```

## 2. Importer le fichier JSON dans Replit

Le fichier `biodiversity_judgment_benchmark_800_questions.json` est déjà présent
à la racine du dossier. Pour le remplacer par une nouvelle version, glissez-le
simplement dans l'arborescence de fichiers de Replit (ou utilisez l'option
*Upload file*), en conservant le même nom.

## 3. Ajouter les secrets d'API

Dans Replit, ouvrez l'onglet **Secrets** (icône cadenas) et ajoutez les clés des
fournisseurs que vous souhaitez tester :

| Secret | Fournisseur | Obligatoire ? |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI | Oui (utilisé aussi par le juge) |
| `ANTHROPIC_API_KEY` | Anthropic / Claude | Optionnel |
| `MISTRAL_API_KEY` | Mistral AI | Optionnel |
| `GEMINI_API_KEY` | Google Gemini | Optionnel |

> Le **juge** d'évaluation utilise OpenAI : `OPENAI_API_KEY` est nécessaire pour
> obtenir des scores. Sans elle, les réponses brutes sont tout de même
> collectées, mais non notées.

Ollama est **local** et ne nécessite aucune clé : démarrez `ollama serve` et
assurez-vous que le modèle est téléchargé (`ollama pull llama3.1`).

### Choisir les modèles (optionnel)

Les noms de modèles ont des valeurs par défaut surchargeables par variables
d'environnement :

| Variable | Défaut |
|---|---|
| `OPENAI_MODEL` | `gpt-4o-mini` |
| `ANTHROPIC_MODEL` | `claude-3-5-sonnet-latest` |
| `MISTRAL_MODEL` | `mistral-large-latest` |
| `GEMINI_MODEL` | `gemini-2.0-flash` |
| `OLLAMA_MODEL` | `llama3.1` |
| `OPENAI_JUDGE_MODEL` | `gpt-4o-mini` |

## 4. Lancer un test rapide

Vérifier le pipeline **sans appeler aucune API** (gratuit) :

```bash
cd biodiversity-benchmark
python main.py --dry-run --limit 5
```

Test réel sur quelques questions et quelques modèles :

```bash
python main.py --models openai,mistral --limit 10
```

Limiter à un topic :

```bash
python main.py --models openai --topic sequence_erc --limit 20
```

## 5. Lancer le benchmark complet

```bash
python main.py \
  --input biodiversity_judgment_benchmark_800_questions.json \
  --models openai,mistral,anthropic,gemini \
  --limit 50
```

Pour les 800 questions, retirez simplement `--limit`.

### Options de la ligne de commande

| Option | Description |
|---|---|
| `--input` | Chemin du fichier JSON du benchmark. |
| `--models` | `all` ou liste séparée par des virgules (`openai,anthropic,mistral,gemini,openai-small,anthropic-small,ollama`). `openai-small` (gpt-3.5-turbo) et `anthropic-small` (Claude Haiku) sont des « baselines » volontairement plus légères, réutilisant les mêmes clés que `openai`/`anthropic`. |
| `--topic` | Restreint à un topic du benchmark. |
| `--limit N` | Limite le nombre de questions (test rapide). |
| `--judge-model` | Modèle OpenAI utilisé comme juge. |
| `--output-dir` | Dossier de sortie (défaut : `outputs`). |
| `--dry-run` | N'appelle aucune API ; valide le pipeline. |
| `--no-eval` | Interroge les modèles mais saute l'évaluation. |
| `--verbose` | Logs détaillés. |

## 6. Lire les résultats

Tous les fichiers sont écrits dans `outputs/` :

| Fichier | Contenu |
|---|---|
| `raw_results.jsonl` | Réponse brute de chaque modèle (1 ligne / réponse). |
| `evaluated_results.jsonl` | Réponses + scores du juge. |
| `comparison.csv` | Tableau plat (question × modèle) avec tous les scores. |
| `summary_by_model.csv` | Moyennes par modèle. |
| `summary_by_topic.csv` | Moyennes par modèle et par topic. |
| `report.md` | Rapport comparatif complet (à lire en premier). |

### Critères d'évaluation (juge)

Chaque réponse reçoit un JSON strict :

```json
{
  "accuracy": 0-5,
  "uncertainty_handling": 0-5,
  "justification_quality": 0-5,
  "source_awareness": 0-5,
  "regulatory_hallucination_risk": 0-5,
  "overall_score": 0-100,
  "strengths": "...",
  "weaknesses": "...",
  "verdict": "..."
}
```

> ⚠️ `regulatory_hallucination_risk` est **inversé** : **5 = faible risque**
> d'hallucination réglementaire, **0 = fort risque**. Les affirmations
> réglementaires non sourcées sont fortement pénalisées.

Le rapport `report.md` contient : classement global, scores par modèle, par
topic et par difficulté, top 10 des meilleures et pires réponses, analyse des
risques d'hallucination réglementaire, analyse des questions d'arbitrage
socio-écologique, et recommandations pour ALI / Natural Solutions.

## 7. Robustesse

- Retries automatiques (tenacity) sur les erreurs réseau / API.
- Les erreurs d'un modèle sont journalisées **sans interrompre** le benchmark.
- Les fournisseurs sans clé sont automatiquement ignorés.
- Le juge récupère les JSON imparfaits et borne les scores hors limites.
