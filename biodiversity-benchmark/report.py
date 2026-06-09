"""Génération des rapports comparatifs à partir des résultats évalués."""

from __future__ import annotations

import logging
import os

import pandas as pd

logger = logging.getLogger("benchmark.report")

# Colonnes de scores produites par le juge.
SCORE_COLS = [
    "accuracy",
    "uncertainty_handling",
    "justification_quality",
    "source_awareness",
    "regulatory_hallucination_risk",
    "overall_score",
]


def _load_dataframe(evaluated: list[dict]) -> pd.DataFrame:
    df = pd.DataFrame(evaluated)
    if df.empty:
        return df
    for col in SCORE_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
    return df


def write_comparison_csv(df: pd.DataFrame, path: str) -> None:
    """comparison.csv : une ligne par couple (question, modèle)."""
    cols = [
        "question_id",
        "topic",
        "difficulty",
        "question_type",
        "model",
        "provider",
        "latency_seconds",
        *SCORE_COLS,
        "error",
    ]
    existing = [c for c in cols if c in df.columns]
    df[existing].to_csv(path, index=False)


def write_summary_by_model(df: pd.DataFrame, path: str) -> pd.DataFrame:
    """summary_by_model.csv : moyennes par modèle."""
    ok = df[df["error"].isna() | (df["error"] == "")]
    grouped = (
        ok.groupby(["provider", "model"])[SCORE_COLS]
        .mean()
        .round(2)
        .reset_index()
    )
    counts = (
        df.groupby(["provider", "model"])
        .agg(
            n_questions=("question_id", "count"),
            n_errors=("error", lambda s: (s.notna() & (s != "")).sum()),
            avg_latency_s=("latency_seconds", "mean"),
        )
        .round(2)
        .reset_index()
    )
    summary = counts.merge(grouped, on=["provider", "model"], how="left")
    summary = summary.sort_values("overall_score", ascending=False)
    summary.to_csv(path, index=False)
    return summary


def write_summary_by_topic(df: pd.DataFrame, path: str) -> pd.DataFrame:
    """summary_by_topic.csv : moyennes par modèle et par topic."""
    ok = df[df["error"].isna() | (df["error"] == "")]
    summary = (
        ok.groupby(["provider", "model", "topic"])[SCORE_COLS]
        .mean()
        .round(2)
        .reset_index()
        .sort_values(["topic", "overall_score"], ascending=[True, False])
    )
    summary.to_csv(path, index=False)
    return summary


def _ranking_table(summary_model: pd.DataFrame) -> str:
    lines = [
        "| Rang | Fournisseur | Modèle | Score global | Exactitude | "
        "Incertitudes | Justification | Sources | Anti-hallucination | "
        "Questions | Erreurs |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for i, (_, r) in enumerate(summary_model.iterrows(), start=1):
        lines.append(
            f"| {i} | {r['provider']} | {r['model']} | "
            f"{r.get('overall_score', float('nan')):.1f} | "
            f"{r.get('accuracy', float('nan')):.2f} | "
            f"{r.get('uncertainty_handling', float('nan')):.2f} | "
            f"{r.get('justification_quality', float('nan')):.2f} | "
            f"{r.get('source_awareness', float('nan')):.2f} | "
            f"{r.get('regulatory_hallucination_risk', float('nan')):.2f} | "
            f"{int(r['n_questions'])} | {int(r['n_errors'])} |"
        )
    return "\n".join(lines)


def _pivot_by(df: pd.DataFrame, dimension: str) -> str:
    ok = df[df["error"].isna() | (df["error"] == "")]
    if ok.empty:
        return "_Aucune donnée._"
    pivot = (
        ok.pivot_table(
            index=dimension,
            columns="model",
            values="overall_score",
            aggfunc="mean",
        )
        .round(1)
    )
    return pivot.to_markdown()


def _best_worst(df: pd.DataFrame, n: int, ascending: bool) -> str:
    ok = df[(df["error"].isna() | (df["error"] == "")) & df["overall_score"].notna()]
    if ok.empty:
        return "_Aucune donnée._"
    ordered = ok.sort_values("overall_score", ascending=ascending).head(n)
    lines = ["| Score | Modèle | Topic | Difficulté | Question (id) | Verdict |",
             "|---|---|---|---|---|---|"]
    for _, r in ordered.iterrows():
        verdict = str(r.get("verdict", "")).replace("\n", " ")[:140]
        question = str(r.get("question", ""))[:80].replace("\n", " ")
        lines.append(
            f"| {r['overall_score']:.0f} | {r['model']} | {r['topic']} | "
            f"{r['difficulty']} | {question} ({r['question_id']}) | {verdict} |"
        )
    return "\n".join(lines)


def _hallucination_analysis(df: pd.DataFrame) -> str:
    ok = df[df["error"].isna() | (df["error"] == "")]
    if ok.empty:
        return "_Aucune donnée._"
    # Score inversé : plus bas = plus de risque.
    risk = (
        ok.groupby(["provider", "model"])["regulatory_hallucination_risk"]
        .mean()
        .round(2)
        .sort_values()
        .reset_index()
    )
    lines = [
        "Rappel : `regulatory_hallucination_risk` est **inversé** "
        "(5 = faible risque, 0 = fort risque d'hallucination réglementaire).",
        "",
        "| Fournisseur | Modèle | Score anti-hallucination moyen |",
        "|---|---|---|",
    ]
    for _, r in risk.iterrows():
        lines.append(
            f"| {r['provider']} | {r['model']} | "
            f"{r['regulatory_hallucination_risk']:.2f} |"
        )
    n_high = (ok["regulatory_hallucination_risk"] <= 2).sum()
    lines.append("")
    lines.append(
        f"**{n_high}** réponses présentent un risque élevé d'hallucination "
        f"réglementaire (score ≤ 2)."
    )
    return "\n".join(lines)


# Types de question portant sur les arbitrages / biais socio-écologiques.
# Inclut l'ancien jeu (`arbitrage`), le jeu V2 (`tradeoff_and_bias_detection`)
# et le jeu V3 (`ethical_tradeoff`, section dilemmes moraux).
ARBITRAGE_QUESTION_TYPES = {
    "arbitrage",
    "tradeoff_and_bias_detection",
    "ethical_tradeoff",
}


def _arbitrage_analysis(df: pd.DataFrame) -> str:
    ok = df[
        (df["error"].isna() | (df["error"] == ""))
        & (df["question_type"].isin(ARBITRAGE_QUESTION_TYPES))
    ]
    if ok.empty:
        return "_Aucune question d'arbitrage évaluée._"
    grouped = (
        ok.groupby(["provider", "model"])[
            ["overall_score", "justification_quality", "uncertainty_handling"]
        ]
        .mean()
        .round(2)
        .sort_values("overall_score", ascending=False)
        .reset_index()
    )
    lines = [
        "Sur les questions d'**arbitrage socio-écologique**, on valorise la "
        "présentation équilibrée des compromis plutôt qu'une position unique.",
        "",
        "| Fournisseur | Modèle | Score global | Justification | Incertitudes |",
        "|---|---|---|---|---|",
    ]
    for _, r in grouped.iterrows():
        lines.append(
            f"| {r['provider']} | {r['model']} | {r['overall_score']:.1f} | "
            f"{r['justification_quality']:.2f} | {r['uncertainty_handling']:.2f} |"
        )
    return "\n".join(lines)


def _recommendations(summary_model: pd.DataFrame, df: pd.DataFrame) -> str:
    if summary_model.empty:
        return "_Pas assez de données pour recommander un modèle._"
    best = summary_model.iloc[0]
    lines = [
        f"- **Meilleur modèle global** : `{best['model']}` "
        f"({best['provider']}) avec un score moyen de "
        f"{best.get('overall_score', float('nan')):.1f}/100.",
    ]
    # Modèle le plus fiable sur le plan réglementaire.
    ok = df[df["error"].isna() | (df["error"] == "")]
    if not ok.empty:
        safe = (
            ok.groupby("model")["regulatory_hallucination_risk"]
            .mean()
            .sort_values(ascending=False)
        )
        if len(safe):
            lines.append(
                f"- **Plus fiable contre l'hallucination réglementaire** : "
                f"`{safe.index[0]}` (score anti-hallucination "
                f"{safe.iloc[0]:.2f}/5)."
            )
        arb = ok[ok["question_type"].isin(ARBITRAGE_QUESTION_TYPES)]
        if not arb.empty:
            best_arb = (
                arb.groupby("model")["overall_score"].mean().sort_values(ascending=False)
            )
            lines.append(
                f"- **Meilleur sur les arbitrages socio-écologiques** : "
                f"`{best_arb.index[0]}` ({best_arb.iloc[0]:.1f}/100)."
            )
    lines.append(
        "- Pour ALI / Natural Solutions, privilégier un modèle combinant un "
        "score global élevé **et** un faible risque d'hallucination "
        "réglementaire ; valider les réponses réglementaires par un expert "
        "avant tout usage opérationnel."
    )
    return "\n".join(lines)


def write_markdown_report(
    df: pd.DataFrame,
    summary_model: pd.DataFrame,
    path: str,
    meta: dict | None = None,
) -> None:
    """Génère le rapport Markdown complet."""
    meta = meta or {}
    n_total = len(df)
    n_errors = int((df["error"].notna() & (df["error"] != "")).sum())
    models = ", ".join(sorted(df["model"].dropna().unique()))

    sections = [
        "# Rapport de benchmark — Biodiversity Judgment Benchmark",
        "",
        f"- Benchmark : **{meta.get('name', 'Biodiversity Judgment Benchmark')}**",
        f"- Modèles testés : {models}",
        f"- Réponses évaluées : {n_total} (dont {n_errors} en erreur)",
        f"- Modèle juge : `{meta.get('judge_model', '?')}`",
        "",
        "## 1. Classement global des modèles",
        "",
        _ranking_table(summary_model),
        "",
        "## 2. Score moyen par modèle",
        "",
        summary_model[["provider", "model", *SCORE_COLS]].to_markdown(index=False),
        "",
        "## 3. Score moyen par topic",
        "",
        _pivot_by(df, "topic"),
        "",
        "## 4. Score moyen par difficulté",
        "",
        _pivot_by(df, "difficulty"),
        "",
        "## 5. Top 10 des meilleures réponses",
        "",
        _best_worst(df, 10, ascending=False),
        "",
        "## 6. Top 10 des pires réponses",
        "",
        _best_worst(df, 10, ascending=True),
        "",
        "## 7. Analyse des risques d'hallucination réglementaire",
        "",
        _hallucination_analysis(df),
        "",
        "## 8. Analyse des questions d'arbitrage socio-écologique",
        "",
        _arbitrage_analysis(df),
        "",
        "## 9. Recommandations pour ALI / Natural Solutions",
        "",
        _recommendations(summary_model, df),
        "",
    ]
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(sections))


def generate_all_reports(
    evaluated: list[dict], output_dir: str, meta: dict | None = None
) -> None:
    """Produit comparison.csv, summary_by_model.csv, summary_by_topic.csv et report.md."""
    os.makedirs(output_dir, exist_ok=True)
    df = _load_dataframe(evaluated)
    if df.empty:
        logger.warning("Aucun résultat à reporter.")
        return

    write_comparison_csv(df, os.path.join(output_dir, "comparison.csv"))
    summary_model = write_summary_by_model(
        df, os.path.join(output_dir, "summary_by_model.csv")
    )
    write_summary_by_topic(df, os.path.join(output_dir, "summary_by_topic.csv"))
    write_markdown_report(
        df, summary_model, os.path.join(output_dir, "report.md"), meta=meta
    )
    logger.info("Rapports générés dans %s", output_dir)
