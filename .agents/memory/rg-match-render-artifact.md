---
name: rg match-highlight renders as "n" in tool output
description: Why ripgrep output sometimes shows a bogus "n" where the searched word should be, and how to verify ground truth.
---

When `rg` prints a line whose match-highlight is the searched term, the highlight can render in the tool transcript as the single letter **`n`** in place of the matched word. Example: searching `arena|Arena` made real source like `import { Arena } from "@/pages/arena";` appear as `import { n } from "@/pages/n";`, and `tr("Arène", "Arena")` appear as `tr("Arène", "n")`. This looked like a catastrophic find/replace corruption but the files were completely intact.

**Why:** it is a rendering artifact of rg's ANSI match-highlighting in this harness — only the *matched substring* is affected, so the same word shows correctly in a grep where it is NOT the search pattern.

**How to apply:**
- Never trust the spelling of the *matched token* in `rg` output. Use the surrounding context only to locate.
- To confirm exact file content (before editing or before concluding "corruption"), READ the file (read tool / `sed -n`) — those outputs are accurate.
- Tell-tale sign it's the artifact, not real corruption: two greps of the same line disagree, or a word renders as `n` only in the grep where it's the search term.
