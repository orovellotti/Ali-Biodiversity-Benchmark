---
name: LLM provider SDK gotchas
description: Non-obvious failures when wiring OpenAI/Anthropic/Mistral/Gemini Python SDKs in this repl
---

# LLM provider SDK gotchas (Python)

- **mistralai**: the package manager installed `mistralai==2.4.9` which was broken — its top-level `__init__.py` was missing, so `from mistralai import Mistral` failed with "cannot import name 'Mistral' (unknown location)". Fix: pin to a 1.x release (`mistralai==1.9.10`). 1.x has the documented `from mistralai import Mistral` + `client.chat.complete(...)` API.
  **Why:** an unpinned install pulled a corrupt/odd 2.x build. **How to apply:** if Mistral import fails, check `pip show mistralai` and reinstall pinned to 1.x.

- **Anthropic model names**: alias-style ids like `claude-3-5-sonnet-latest` 404 ("not_found_error"). Use concrete dated ids from `client.models.list()` (e.g. `claude-sonnet-4-5-20250929`).
  **Why:** `-latest` aliases are not accepted by the Messages API here. **How to apply:** list models and pick a concrete id; keep it overridable via env var.

- **Gemini free tier**: `gemini-2.0-flash` returned 429 RESOURCE_EXHAUSTED with `free_tier ... limit: 0` on a fresh key. Defaulted to `gemini-1.5-flash`. This is an account/billing quota, not a code bug — handle 429s gracefully (log + continue).

- **pandas `.to_markdown()`** requires the `tabulate` package; install it explicitly or report generation crashes.
