---
name: Benchmark model size + parameter counts
description: Why model "size" is a qualitative tier and parameter counts only appear for open-weight models.
---

# Model size tier + parameter count

The results dashboard shows each model's **size tier** (small / medium / large)
and, when available, its **parameter count** (e.g. "8B").

## Parameter counts: only open-weight models have them

Proprietary API models — OpenAI (gpt-4o*, gpt-3.5), Anthropic (Claude
sonnet/haiku/opus), Google (Gemini flash/pro), and Mistral's hosted
`*-latest` — **do not publish parameter counts**. Never invent or guess a
number for these; the helper returns null and the UI shows only the tier.

Real counts are only known for open-weight families (Llama, Ministral, Mixtral,
open Mistral). Their model ids carry multiple sizes, so the matcher is
substring-based and **ordered most-specific-first** (e.g. `llama3.1:70b` before
the `llama3.1` family default of 8B), or the bigger variant would be mislabeled.

**Why:** this is a credibility constraint for a benchmark — a fabricated
parameter figure would discredit the whole comparison. The user explicitly
asked to "show the number only if available."

**How to apply:** size tier = qualitative i18n keys (`small`/`medium`/`large`),
translated in the UI via `t(\`size_\${size}\`)`, NOT raw localized strings — so
the same value works in both FR and EN and in CSV export. If you add a new
open-weight model, add its official count to the param rules; leave proprietary
models out (null).
