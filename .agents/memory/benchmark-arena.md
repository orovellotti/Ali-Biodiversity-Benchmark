---
name: benchmark-ui arena
description: How the LLM "arena" (blind duels + community Elo) is built on top of already-generated benchmark answers.
---

# Benchmark Arena (blind duels + community Elo)

The arena is a Chatbot-Arena-style feature layered on top of existing run results — it does **not** call any LLM live. It reuses answers already produced by past benchmark runs.

## Core decisions

- **No live API calls.** A duel = two different models' stored answers to the *same* dataset question, picked from an index built across all run dirs. Answers that are empty, errored, or `[DRY-RUN]` placeholders are excluded; a question needs ≥2 distinct models to be eligible.
- **Duel token is HMAC-signed (forge-proof reveal).** The GET /duel response carries an HMAC-signed token encoding the two `provider/model` identities + question. The public POST /vote endpoint verifies the signature before revealing identities and recording the vote — this is what stops a public voter from fabricating matchups.
  - **Why:** the vote route is intentionally public ("communautaire", no admin). Without a signed token, anyone could forge fake votes/identities and poison the leaderboard.
  - **How to apply:** never trust client-sent model identities on /vote. Prefer `SESSION_SECRET`; if unset, fall back to a **random per-process** secret (never a hardcoded string) — tokens then only live for the process lifetime, which is acceptable.
- **Votes are append-only JSONL** at `biodiversity-benchmark/arena/votes.jsonl` (path via `arenaVotesFilePath()`). The leaderboard is computed by **replaying** all votes through Elo (init 1000, K=24); per-vote `ratingChange` returned to the client is the delta from the last replayed vote.
- **Dedup freshness:** the answer index keeps the **newest** answer per model+question. `listRuns()` is newest-first, so set-if-absent (first seen wins). Iterating-and-overwriting would make older runs win — that's the bug to avoid.

## Gotchas

- Always clear `biodiversity-benchmark/arena/votes.jsonl` after seeding test/e2e votes — it feeds the real leaderboard.
- e2e tests can flake if run during a Vite HMR reload: a transient "Invalid hook call / useContext null in wouter useRouter" crash in SiteHeader makes the page non-interactive. Restart the UI workflow for a clean full reload before testing, then re-run.
- Contract-first: arena shapes live in `lib/api-spec/openapi.yaml`; the vote-result shape is constructed server-side (no generated vote-response zod). Regenerate hooks/zod after spec edits.
