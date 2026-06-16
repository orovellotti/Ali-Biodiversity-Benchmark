# ALI Biodiversity Benchmark

Banc d'essai indépendant qui compare la fiabilité de plusieurs intelligences
artificielles (OpenAI, Anthropic, Mistral, ainsi que des modèles *open-weight* via
OpenRouter) sur les **106 questions** du *Biodiversity Judgment Benchmark*. Sur des
sujets de biodiversité et de réglementation environnementale, une réponse fausse —
ou une règle inventée — peut coûter cher : ce projet mesure, de façon comparable et
vérifiable, l'exactitude des modèles, leur prudence, et leur tendance à inventer des
informations crédibles mais fausses.

Le projet réunit trois éléments :

| Élément | Rôle | Emplacement |
|---|---|---|
| **Interface web** | Salle de contrôle (FR/EN) : lancer des runs, suivre la progression, explorer les classements, l'Arène et la base de questions. | `artifacts/benchmark-ui` |
| **Serveur d'API** | Pilote la CLI Python, lit les résultats sur disque, expose `/api`. | `artifacts/api-server` |
| **CLI Python** | Le moteur : interroge les modèles, fait juger les réponses, produit les rapports. | `biodiversity-benchmark/` |

## Démarrage rapide

> Les applications tournent via des *workflows* Replit, pas via `pnpm dev` à la
> racine. Utilisez le panneau d'aperçu ou redémarrez les workflows au besoin.

- **Interface web + API** : les workflows `artifacts/benchmark-ui: web` et
  `artifacts/api-server: API Server` servent l'application (aperçu sur `/`).
- **Vérifier la CLI sans dépenser de crédits** :
  ```bash
  cd biodiversity-benchmark && python main.py --dry-run --limit 5
  ```
- **Un vrai test court** :
  ```bash
  cd biodiversity-benchmark && python main.py --models openai,mistral --limit 10
  ```

La documentation complète de la CLI (dataset, secrets, options, lecture des
résultats) est dans **[`biodiversity-benchmark/README.md`](biodiversity-benchmark/README.md)**.

## Méthodologie d'évaluation (en bref)

- **Classement comparatif.** Pour chaque question, un juge classe ensemble toutes
  les réponses (anonymisées et mélangées). Le classement final trie par **rang
  moyen** croissant (plus bas = meilleur) ; le score sur 100 est secondaire.
- **Panel de juges cross-fournisseurs** (défaut : `openai:gpt-4o` +
  `anthropic:claude-sonnet-4-5`), surchargeable via `BENCHMARK_JUDGES`.
- **Anti-auto-évaluation** : un modèle n'est jamais noté par un juge de sa propre
  famille.
- **`regulatory_hallucination_risk` est inversé** : 5 = faible risque, 0 = fort
  risque. L'interface l'étiquette pour qu'un score plus élevé se lise toujours
  comme « meilleur ».

## Le classement « équitable » 13 modèles

Le run de référence compare **13 modèles** sur l'ensemble des 106 questions, tous
jugés ensemble par le même panel comparatif — la seule façon d'obtenir un
classement juste (les modèles ne sont comparables que s'ils sont notés dans le même
appel de classement).

Principe d'économie de crédits : **on ne relance un modèle que si c'est
nécessaire** (questions modifiées, nouveau modèle ajouté, ou changement du juge).
Les réponses déjà générées sont relues sur disque, jamais recalculées.

### Reproduire ou étendre le classement

Le pilote `biodiversity-benchmark/fair13_chunk.py` génère et juge un classement
multi-modèles de façon **résistante aux pannes et reprenable** :

- génération en parallèle (concurrence limitée à 3), chaque réponse écrite sur
  disque immédiatement ;
- une reprise saute les couples `(modèle, question)` déjà réussis — **aucun
  crédit n'est dépensé deux fois** ;
- évaluation reprenable à la question près ;
- réutilise les réponses déjà stockées (`REUSE_SRC`) au lieu de les régénérer.

Pour les runs longs (≈ 2 h), il est lancé par lots `--offset` via un *workflow*
Replit persistant qui survit aux interruptions, puis les lots sont concaténés en un
seul run consolidé que l'interface affiche comme classement unique.

> ⚠️ **Quotas.** Une clé d'API en palier gratuit à **quota nul** échoue (HTTP 429) :
> ses réponses sont vides et le modèle est exclu du classement. Vérifiez que les
> clés utilisées comme **juges** disposent d'un quota payant.

## Architecture et préférences

L'architecture détaillée (contrat OpenAPI, persistance fichier, Arène, traduction
EN, garde-fous de crédits, i18n…) et les préférences de fonctionnement sont
documentées dans **[`replit.md`](replit.md)** à la racine.
