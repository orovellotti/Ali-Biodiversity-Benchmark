---
name: Benchmark EN translation
description: How/why French dataset+answers are shown in English (display-only) and the cost-safety design of the public translate endpoint.
---

# EN translation of dataset questions + stored answers

The benchmark UI shows English translations of dataset **questions, expected
answers, model answers, and judge verdicts** when the language toggle is EN.
French remains the source of truth; English is **display-only** (answers and
scoring are never re-run).

**Why:** this reverses the earlier "dataset content stays French" decision — the
user explicitly asked for everything to read in English in EN mode.

## Cost-safety design (the endpoint is public)

A credit-anxious user owns this. The public `POST /benchmark/translate` calls a
paid LLM with the server's OpenAI key, so three guards bound the spend:

1. **Permanent disk cache** keyed by `sha256(source)` — each unique string is
   translated once, ever; repeat views are free.
2. **Corpus gate** — only strings that already exist in the benchmark corpus
   (dataset questions/expected answers + stored run answers/verdicts) are ever
   sent to the LLM. Novel/arbitrary input is returned untranslated, so total
   cost is bounded to "translate the corpus once" even though the endpoint is
   public.
3. **Serialized translation** (a module-level mutex re-checking the cache inside
   the critical section) so concurrent requests can't double-pay for the same
   miss.

**How to apply:** if you add new translatable UI fields, also add their source
strings to the corpus hash-set builder, or the corpus gate will silently leave
them in French. Client batches requests under the server's hard caps (600 texts
/ 300k chars); keep new callers going through the shared client hook so chunking
+ caching stay consistent. FR mode is a pure no-op identity (never calls the
endpoint).

## Cold-cache UX (why EN can "look broken")

The client query is **all-or-nothing per query key**: nothing flips to English
until the entire batch resolves. On a cold cache the server translates misses in
sequential LLM chunk-waves (20/chunk, concurrency 4), so a first EN load of a
full page takes several seconds during which dataset text **silently stays
French**. Users read this as "translation is broken."

**Fix in place:** every page that calls `useTranslateMap` must surface its
`loading` flag (a "Translating… / Traduction en cours…" spinner). Don't ship a
translated surface that only renders `failed` — the silent multi-second wait is
the actual complaint, not failure. Warm cache is instant (~9ms, a cache hit).

**Why:** the server handler runs to completion even if the HTTP request is
aborted (client disconnect/unmount doesn't cancel the OpenAI calls), so an
aborted first request still warms the cache — but the *first viewer* sees French
the whole time unless the loading state is shown.

## Body-size limit (413 on large EN batches)

The public `POST /benchmark/translate` body grows with run size (more models = more
answers/verdicts). Express's default `express.json()` 100kb limit **413s** on
multi-model runs in EN mode. Fix: route-scope a larger `express.json({limit:"1mb"})`
to the translate path only (keep the small default elsewhere to limit DoS surface).
**Rule:** the translate route's body limit must stay ahead of the client chunk cap
(use-translate.ts CHUNK_MAX_CHARS) AND the server's 300k-char request cap.
