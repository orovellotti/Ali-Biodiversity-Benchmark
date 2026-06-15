"""Ops one-off: build a FAIR 13-model leaderboard chunk over the 106q ref set.

For a given question window (--offset/--limit) it:
  1. REUSES the already-generated answers for openai + anthropic (clean, 106q)
     from the big-3 merged run -> no re-spend on those answer calls.
  2. GENERATES fresh answers for the other 11 models (mistral + the 10 missing).
  3. Runs ONE comparative ranking over ALL 13 answers per question (same judge
     panel as the reference), so rank_in_question is on a unified 13-model scale.

Outputs raw_results.jsonl + evaluated_results.jsonl into --output-dir, then
writes a DONE marker. Run once per chunk; concatenate chunks afterwards.

Crash-safe & resumable: every generated answer is appended to raw_results.jsonl
the instant it completes, and a re-run skips any (provider, question) pair that
already has a good (non-empty, error-free) answer on disk. So a mid-run crash
never re-spends credits on answers already obtained — just rerun the same chunk.
Generation is parallel but task order is INTERLEAVED by question so concurrent
in-flight calls hit DISTINCT provider objects (avoids hammering one provider's
client object from many threads at once).
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

import config
from main import load_questions, filter_questions, write_jsonl, init_providers, topic_of
from evaluator import build_judge_panel, evaluate_run

GEN_WORKERS = 3

INPUT = "biodiversity_benchmark_100_v4.json"
REUSE_PROVIDERS = ["openai", "anthropic"]
GEN_PROVIDERS = [
    "mistral",
    "openai-small",
    "anthropic-small",
    "llama-3.2-3b",
    "llama-3.2-1b",
    "qwen-2.5-7b",
    "ministral-8b",
    "gemma-3-4b",
    "llama-3.3-70b",
    "mistral-small-24b",
    "gemma-2-27b",
]
REUSE_SRC = "runs/2026-06-15T16-30-00-fair13-all/raw_results.jsonl"

_APPEND_LOCK = threading.Lock()


def _row_key(r: dict) -> tuple:
    return (r.get("provider"), r.get("question_id"))


def _is_good(r: dict) -> bool:
    return bool((r.get("raw_response") or "").strip()) and not r.get("error")


def _load_rows(path: str) -> list[dict]:
    rows: list[dict] = []
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line:
                    rows.append(json.loads(line))
    return rows


def _append_row(path: str, rec: dict) -> None:
    line = json.dumps(rec, ensure_ascii=False) + "\n"
    with _APPEND_LOCK:
        with open(path, "a", encoding="utf-8") as fh:
            fh.write(line)
            fh.flush()


def load_reused(qids: set[str]) -> list[dict]:
    rows: list[dict] = []
    if not os.path.exists(REUSE_SRC):
        return rows
    with open(REUSE_SRC, "r", encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            r = json.loads(line)
            if (
                r.get("provider") in REUSE_PROVIDERS
                and r.get("question_id") in qids
                and _is_good(r)
            ):
                rows.append(r)
    return rows


def gen_parallel(
    providers: list, questions: list[dict], raw_path: str, done_keys: set[tuple]
) -> None:
    """Generate answers for providers x questions, appending each to raw_path.

    Skips (provider, question_id) pairs already in done_keys (resume). Task order
    is interleaved by question so the in-flight set hits distinct providers.
    """
    tasks = [
        (p, q)
        for q in questions
        for p in providers
        if (p.name, q.get("id")) not in done_keys
    ]
    total = len(tasks)
    if total == 0:
        print("[gen] nothing to do (all answers already on disk)", flush=True)
        return

    def work(provider, q) -> dict:
        rec = {
            "question_id": q.get("id"),
            "topic": topic_of(q),
            "subtopic": q.get("subtopic"),
            "difficulty": q.get("difficulty"),
            "question_type": q.get("question_type"),
            "country_scope": q.get("country_scope"),
            "question": q.get("question"),
            "provider": provider.name,
            "model": provider.model,
            "raw_response": "",
            "latency_seconds": None,
            "error": "",
        }
        start = time.time()
        try:
            rec["raw_response"] = provider.generate(
                config.SYSTEM_PROMPT, config.build_user_prompt(q)
            )
        except Exception as exc:  # noqa: BLE001 - logged into the record
            rec["error"] = f"{type(exc).__name__}: {exc}"
        finally:
            rec["latency_seconds"] = round(time.time() - start, 3)
        if _is_good(rec):
            _append_row(raw_path, rec)
        return rec

    done = 0
    failed = 0
    with ThreadPoolExecutor(max_workers=GEN_WORKERS) as ex:
        futs = [ex.submit(work, p, q) for (p, q) in tasks]
        for f in as_completed(futs):
            rec = f.result()
            done += 1
            if not _is_good(rec):
                failed += 1
            if done % 20 == 0 or done == total:
                print(f"[gen] {done}/{total} (failed so far: {failed})", flush=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--offset", type=int, required=True)
    ap.add_argument("--limit", type=int, required=True)
    ap.add_argument("--output-dir", required=True)
    args = ap.parse_args()

    out = args.output_dir
    os.makedirs(out, exist_ok=True)
    raw_path = os.path.join(out, "raw_results.jsonl")

    meta, all_q = load_questions(INPUT)
    chunk = filter_questions(all_q, None, args.limit, args.offset)
    qids = {q.get("id") for q in chunk}
    print(
        f"[chunk] offset={args.offset} limit={args.limit} -> {len(chunk)} questions",
        flush=True,
    )

    # Resume: keep good rows already on disk; only (re)fetch missing/bad ones.
    existing = _load_rows(raw_path)
    good_keys = {_row_key(r) for r in existing if _is_good(r)}
    if existing:
        print(
            f"[resume] {len(existing)} rows on disk, {len(good_keys)} good -> skip those",
            flush=True,
        )

    # 1. Reuse openai + anthropic answers (append once if not already present).
    reused = load_reused(qids)
    added = 0
    for r in reused:
        if _row_key(r) not in good_keys:
            _append_row(raw_path, r)
            good_keys.add(_row_key(r))
            added += 1
    print(f"[reuse] {len(reused)} candidates, {added} appended", flush=True)

    # 2. Generate the other 11 models (parallel, incremental, resumable).
    providers = init_providers(GEN_PROVIDERS, dry_run=False)
    print(f"[gen] providers active: {[p.name for p in providers]}", flush=True)
    gen_parallel(providers, chunk, raw_path, good_keys)

    # Dedup raw file -> one good row per (provider, question_id).
    by_key: dict[tuple, dict] = {}
    for r in _load_rows(raw_path):
        k = _row_key(r)
        if k not in by_key or (_is_good(r) and not _is_good(by_key[k])):
            by_key[k] = r
    combined = list(by_key.values())
    write_jsonl(combined, raw_path)
    good = sum(1 for r in combined if _is_good(r))
    print(f"[raw] {len(combined)} rows ({good} good) after dedup", flush=True)

    # 3. One comparative ranking over all 13 per question.
    #    Driven per-question so eval is RESUMABLE: each question's evaluated rows
    #    are appended the instant its judging completes; a re-run skips questions
    #    already fully on disk (so an interrupted eval never re-pays judge calls
    #    for questions already scored).
    judges = build_judge_panel(dry_run=False)
    print(f"[judge] panel: {[j.label for j in judges]}", flush=True)
    questions_by_id = {q.get("id"): q for q in all_q}
    eval_path = os.path.join(out, "evaluated_results.jsonl")

    from collections import defaultdict

    combined_by_q: dict = defaultdict(list)
    for r in combined:
        combined_by_q[r.get("question_id")].append(r)

    eval_count_by_q: dict = defaultdict(int)
    for r in _load_rows(eval_path):
        eval_count_by_q[r.get("question_id")] += 1
    done_q = {
        qid
        for qid, recs in combined_by_q.items()
        if eval_count_by_q.get(qid, 0) >= len(recs) and eval_count_by_q.get(qid, 0) > 0
    }
    if done_q:
        print(f"[eval-resume] {len(done_q)}/{len(combined_by_q)} questions already scored", flush=True)

    n_done = len(done_q)
    n_total = len(combined_by_q)
    for qid, recs in combined_by_q.items():
        if qid in done_q:
            continue
        ev = evaluate_run(recs, questions_by_id, judges)
        for row in ev:
            _append_row(eval_path, row)
        n_done += 1
        print(f"[eval] {n_done}/{n_total} questions", flush=True)

    # Dedup eval file -> one row per (question_id, provider), keep last (full re-eval).
    by_key: dict[tuple, dict] = {}
    for r in _load_rows(eval_path):
        by_key[(r.get("question_id"), r.get("provider"))] = r
    evaluated = list(by_key.values())
    write_jsonl(evaluated, eval_path)
    print(f"[eval] wrote {len(evaluated)} evaluated rows", flush=True)

    with open(os.path.join(out, "DONE"), "w", encoding="utf-8") as fh:
        fh.write("ok\n")
    print("[done]", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
