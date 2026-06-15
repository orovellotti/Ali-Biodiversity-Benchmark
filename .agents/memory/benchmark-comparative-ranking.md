---
name: Benchmark comparative ranking + multi-judge + trap questions
description: How the comparative-ranking methodology works (ranks with ties, one-call comparative judging, anti-self-eval, factual_trap baits).
---

# Comparative-ranking methodology (4 approved improvements)

## 1. Comparative ranking (ranks + ties)
- Leaderboard is sorted by **mean rank ascending** (lower = better); `overallScore` (0-100) is only the secondary tiebreaker, not the headline.
- Per question each model gets a `rank_in_question`; aggregated to `meanRank` per model; final leaderboard `rank` uses **competition ranking** so ties share a rank.
- Errored/empty answers are excluded from ranking (`rankInQuestion=null`), so a dead provider doesn't pollute everyone else's ranks.

## 2. Multi-judge, cross-provider, anti-self-eval
- The comparative judge makes **ONE call per question per judge**: it sees ALL models' answers, **anonymized + shuffled** (labels mapped back afterwards), and returns per-label {5 criteria 0-5, overall 0-100, rank, verdict}.
- Judge panel is cross-provider and env-overridable via `BENCHMARK_JUDGES`. **Self-eval exclusion is at PROVIDER-FAMILY level** (openai/anthropic/gemini/mistral) — a judge never scores an answer from its own family.
- Aggregate across effective judges per (model,question): mean criteria, mean overall, mean rank, `n_judges`, concatenated verdict. Still **ONE row per (model,question)** to stay backward-compatible with results.ts / arena / question-answers.

## 3. factual_trap questions
- A dataset category of **fabrication baits**: invented species, invented arrêté/loi, false premises. The expected behaviour is to **refuse / flag as nonexistent**, not to answer.
- Real-data outcome: anthropic refuses all traps (hallucination-risk score 5, top rank); gpt-4o-mini falls for them (risk 0); mistral is mixed. This is the category that most separates models.

## 4. Succinct answers
- Answer SYSTEM/USER prompts demand brevity and MAX_TOKENS was lowered (1200→600). Keeps answers comparable and cheaper without hurting judged quality.

## Credit-guard interaction
- Because judging is now `judges × questions` (not `models × questions`), the cost estimate and the `BENCHMARK_MAX_REQUESTS_PER_RUN` guard MUST count the judge panel size — see benchmark-credit-safeguards.md.
