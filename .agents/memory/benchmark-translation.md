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
