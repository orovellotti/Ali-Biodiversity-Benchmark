import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  useListQuestions,
  getListQuestionsQueryKey,
  useGetQuestionAnswers,
  getGetQuestionAnswersQueryKey,
  type QuestionPreview,
  type QuestionAnswer,
} from "@workspace/api-client-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { useTranslateMap } from "@/lib/use-translate";
import {
  Columns3,
  Search,
  MessageSquare,
  Loader2,
  Trophy,
  ChevronDown,
} from "lucide-react";

function scoreClass(score: number): string {
  if (score >= 80) return "text-primary";
  if (score >= 50) return "text-foreground";
  return "text-destructive";
}

/** Format an average comparative rank (1 = best); shows one decimal when needed. */
function formatRank(rank: number): string {
  return Number.isInteger(rank) ? String(rank) : rank.toFixed(1);
}

export function Compare() {
  const { tr, t } = useI18n();

  // Deep link: /comparer?q=<id> preselects that question.
  const deepLinkId = useMemo(
    () => new URLSearchParams(window.location.search).get("q"),
    [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(deepLinkId);
  const [search, setSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(!deepLinkId);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const { data: questions, isLoading: qLoading } = useListQuestions({
    query: {
      queryKey: getListQuestionsQueryKey(),
      staleTime: 5 * 60 * 1000,
    },
  });

  const selected = useMemo(
    () => (questions ?? []).find((q) => q.id === selectedId) ?? null,
    [questions, selectedId],
  );

  const matches = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = questions ?? [];
    if (!term) return list.slice(0, 40);
    return list
      .filter((q) =>
        `${q.id} ${q.question} ${q.expectedAnswerShort ?? ""}`
          .toLowerCase()
          .includes(term),
      )
      .slice(0, 40);
  }, [questions, search]);

  // Close the picker dropdown when clicking outside it.
  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  const pick = (q: QuestionPreview) => {
    setSelectedId(q.id);
    setSearch("");
    setPickerOpen(false);
    // Reflect the selection in the URL so the link is shareable/bookmarkable.
    const base = import.meta.env.BASE_URL;
    const prefix = base.endsWith("/") ? base : `${base}/`;
    window.history.replaceState(
      null,
      "",
      `${prefix}comparer?q=${encodeURIComponent(q.id)}`,
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader maxWidth="max-w-[1280px]">
        <Button variant="outline" size="sm" asChild>
          <Link href="/contact">
            <MessageSquare className="w-4 h-4 mr-2" /> Contact
          </Link>
        </Button>
      </SiteHeader>

      <main className="max-w-[1280px] mx-auto px-6 py-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground font-mono mb-3">
          <Columns3 className="w-4 h-4 text-primary" />{" "}
          {tr("Comparateur", "Compare")}
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
          {tr("Comparer les modèles", "Compare the models")}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          {tr(
            "Choisissez une question pour afficher côte à côte la réponse de chaque modèle, avec son rang comparatif, son score et le verdict du juge.",
            "Pick a question to see each model's answer side by side, with its comparative rank, score and the judge's verdict.",
          )}
        </p>

        {/* Question picker -------------------------------------------------- */}
        <div className="mt-8 max-w-2xl relative" ref={pickerRef}>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={tr(
                "Rechercher une question (ID, texte)...",
                "Search a question (ID, text)...",
              )}
              value={search}
              onFocus={() => setPickerOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setPickerOpen(true);
              }}
            />
          </div>

          {pickerOpen && (
            <div className="absolute z-20 mt-1 w-full rounded-md border border-card-border bg-card shadow-lg max-h-80 overflow-y-auto">
              {qLoading ? (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ) : matches.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">
                  {tr("Aucune question.", "No question.")}
                </p>
              ) : (
                matches.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => pick(q)}
                    className="w-full text-left px-3 py-2 hover:bg-secondary/60 border-b border-card-border last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-primary shrink-0">
                        {q.id}
                      </span>
                      {q.topic && (
                        <Badge variant="secondary" className="shrink-0">
                          {t(q.topic)}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mt-1 line-clamp-2">{q.question}</p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Comparison ------------------------------------------------------- */}
        {!selected ? (
          <div className="mt-12 rounded-lg border border-dashed border-card-border p-12 text-center text-muted-foreground">
            <Columns3 className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              {tr(
                "Sélectionnez une question ci-dessus pour comparer les réponses.",
                "Select a question above to compare the answers.",
              )}
            </p>
          </div>
        ) : (
          <ComparisonView question={selected} onChange={() => setPickerOpen(true)} />
        )}
      </main>
    </div>
  );
}

function ComparisonView({
  question,
  onChange,
}: {
  question: QuestionPreview;
  onChange: () => void;
}) {
  const { tr, t } = useI18n();
  const { data, isLoading, isError } = useGetQuestionAnswers(question.id, {
    query: {
      queryKey: getGetQuestionAnswersQueryKey(question.id),
      staleTime: 5 * 60 * 1000,
    },
  });

  const answers = data?.answers ?? [];

  // Translate question, expected answer, every model answer + verdict (cached).
  const translatable = useMemo(() => {
    const out: string[] = [question.question];
    if (question.expectedAnswerShort) out.push(question.expectedAnswerShort);
    for (const a of answers) {
      out.push(a.response);
      if (a.verdict) out.push(a.verdict);
    }
    return out;
  }, [question, answers]);
  const { tr: trText, loading: trLoading } = useTranslateMap(translatable);

  // Best (lowest) comparative rank, to highlight the winning column.
  const bestRank = useMemo(() => {
    const ranks = answers
      .map((a) => a.rankInQuestion)
      .filter((r): r is number => r != null);
    return ranks.length ? Math.min(...ranks) : null;
  }, [answers]);

  return (
    <div className="mt-8">
      {/* Selected question header */}
      <div className="rounded-lg border border-card-border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs font-semibold text-primary">
                {question.id}
              </span>
              {question.topic && (
                <Badge variant="secondary">{t(question.topic)}</Badge>
              )}
              {question.difficulty && (
                <Badge variant="outline">{t(question.difficulty)}</Badge>
              )}
              {question.questionType && (
                <Badge variant="outline">{t(question.questionType)}</Badge>
              )}
            </div>
            <p className="text-base font-medium">{trText(question.question)}</p>
            {question.expectedAnswerShort && (
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-semibold">
                  {tr("Réponse attendue : ", "Expected answer: ")}
                </span>
                {trText(question.expectedAnswerShort)}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={onChange}
          >
            {tr("Changer", "Change")}
            <ChevronDown className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>

      {trLoading && (
        <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          {tr("Traduction en cours…", "Translating…")}
        </div>
      )}

      {/* Side-by-side columns */}
      <div className="mt-5">
        {isLoading ? (
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full rounded-lg" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-sm text-destructive">
            {tr(
              "Erreur lors du chargement des réponses.",
              "Error loading answers.",
            )}
          </p>
        ) : answers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-card-border p-10 text-center text-sm text-muted-foreground">
            {tr(
              "Aucun modèle n'a encore répondu à cette question.",
              "No model has answered this question yet.",
            )}
          </div>
        ) : (
          <div
            className="grid gap-4 items-start"
            style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}
          >
            {answers.map((a: QuestionAnswer) => {
              const isBest =
                bestRank != null && a.rankInQuestion === bestRank;
              return (
                <div
                  key={`${a.provider}::${a.model}`}
                  className={`flex flex-col rounded-lg border bg-card p-4 ${
                    isBest
                      ? "border-primary ring-1 ring-primary/40"
                      : "border-card-border"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-semibold break-all">
                      {a.model}
                    </span>
                    {isBest && (
                      <Trophy className="w-4 h-4 text-primary shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 mb-3">
                    {a.rankInQuestion != null && (
                      <span className="inline-flex items-baseline gap-1">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">
                          {tr("Rang", "Rank")}
                        </span>
                        <span className="font-display text-lg font-semibold tabular-nums">
                          {formatRank(a.rankInQuestion)}
                        </span>
                      </span>
                    )}
                    {a.overallScore != null && (
                      <span
                        className={`font-mono text-sm font-semibold tabular-nums ${scoreClass(
                          a.overallScore,
                        )}`}
                      >
                        {Math.round(a.overallScore)}
                        <span className="text-muted-foreground text-xs">
                          /100
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {trText(a.response)}
                  </p>
                  {a.verdict && (
                    <p className="text-xs text-muted-foreground italic mt-3 border-l-2 border-card-border pl-2">
                      {trText(a.verdict)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
