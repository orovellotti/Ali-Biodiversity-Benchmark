---
name: Benchmark human review & leaderboard-poisoning guard
description: Public community-write endpoints that aggregate per model must corpus-gate client-supplied provider/model against stored answers.
---

# Human review & community write-endpoint integrity

The benchmark has a `/revue` page where the community scores stored model answers
on the judge's 5 criteria (0–5 each; hallucination inverted = higher is better),
saved append-only and replayed into a "human score" leaderboard — same
filesystem/replay-latest-per-id philosophy as arena votes and question votes.

**Rule:** any PUBLIC write endpoint whose payload contributes to a per-model
aggregate (arena vote, human review score, future community leaderboards) MUST
validate every client-supplied `{provider, model}` against the set actually
present in the stored answers for that question (`answersForQuestion(id)`), and
reject duplicates within one payload.

**Why:** these endpoints are intentionally anonymous/public ("communautaire").
Without a membership check, anyone can POST fabricated provider/model names and
poison the leaderboard with models that never answered. This is the same
"corpus gate" principle used to stop the public translate endpoint from draining
credits — never trust client-supplied identifiers on a public aggregating write.

**How to apply:** build an allow-set from stored data server-side; 400 on any
unknown identifier or in-payload duplicate. Range/shape validation (Zod) is not
enough — it doesn't bind the payload to real data.
