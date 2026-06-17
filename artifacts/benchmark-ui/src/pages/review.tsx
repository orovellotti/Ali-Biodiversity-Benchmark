import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetReviewQuestion,
  useSubmitReview,
  useGetReviewLeaderboard,
  getGetReviewLeaderboardQueryKey,
  type ReviewModelRanking,
} from "@workspace/api-client-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import { useTranslateMap } from "@/lib/use-translate";
import { toast } from "@/hooks/use-toast";
import {
  ClipboardCheck,
  Trophy,
  RefreshCw,
  Loader2,
  ArrowRight,
  Send,
  Crown,
} from "lucide-react";

/** Stable anonymous per-browser id so a reviewer can re-score without inflating totals. */
function getReviewerId(): string {
  const KEY = "benchmark-reviewer-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

type CriterionKey =
  | "accuracy"
  | "uncertainty"
  | "justification"
  | "sources"
  | "hallucination";

// The same five criteria the LLM judge uses (each 0–5). `hallucination` is
// inverted (5 = no regulatory hallucination risk), so higher is always better.
const CRITERIA: { key: CriterionKey; labelKey: string }[] = [
  { key: "accuracy", labelKey: "accuracy" },
  { key: "uncertainty", labelKey: "uncertaintyHandling" },
  { key: "justification", labelKey: "justificationQuality" },
  { key: "sources", labelKey: "sourceAwareness" },
  { key: "hallucination", labelKey: "regulatoryHallucinationRisk" },
];

type AnswerScores = Partial<Record<CriterionKey, number>>;

function ScoreSelector({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={active}
            className={`w-8 h-8 rounded-md text-sm font-mono tabular-nums transition-colors border ${
              active
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-secondary hover:text-foreground"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export function Review() {
  const { tr, t } = useI18n();
  const queryClient = useQueryClient();
  const reviewerId = useMemo(() => getReviewerId(), []);

  const {
    data: question,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useGetReviewQuestion();

  const submitMutation = useSubmitReview();

  // scores keyed by `${provider}::${model}`
  const [scores, setScores] = useState<Record<string, AnswerScores>>({});

  // Reset the form whenever a new question loads.
  const questionId = question?.questionId;
  useEffect(() => {
    setScores({});
    submitMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questionId]);

  const answers = useMemo(() => question?.answers ?? [], [question]);

  // Translate question text + answers to EN (cached, no-op in FR).
  const translatable = useMemo(() => {
    const out: string[] = [];
    if (question?.question) out.push(question.question);
    for (const a of answers) out.push(a.response);
    return out;
  }, [question, answers]);
  const { tr: trText, loading: trLoading } = useTranslateMap(translatable);

  const setScore = (key: string, criterion: CriterionKey, v: number) => {
    setScores((prev) => ({
      ...prev,
      [key]: { ...prev[key], [criterion]: v },
    }));
  };

  const allScored =
    answers.length > 0 &&
    answers.every((a) => {
      const s = scores[`${a.provider}::${a.model}`];
      return s && CRITERIA.every((c) => typeof s[c.key] === "number");
    });

  const handleSubmit = async () => {
    if (!question || !allScored) return;
    try {
      await submitMutation.mutateAsync({
        data: {
          reviewerId,
          questionId: question.questionId,
          scores: answers.map((a) => {
            const s = scores[`${a.provider}::${a.model}`]!;
            return {
              provider: a.provider,
              model: a.model,
              accuracy: s.accuracy!,
              uncertainty: s.uncertainty!,
              justification: s.justification!,
              sources: s.sources!,
              hallucination: s.hallucination!,
            };
          }),
        },
      });
      queryClient.invalidateQueries({
        queryKey: getGetReviewLeaderboardQueryKey(),
      });
      toast({
        title: tr("Merci !", "Thank you!"),
        description: tr(
          "Vos notes ont été enregistrées. Voici une nouvelle question.",
          "Your scores were saved. Here is a new question.",
        ),
      });
      await refetch();
    } catch {
      // surfaced via submitMutation.isError below
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader maxWidth="max-w-[1100px]">
        <Button variant="outline" size="sm" asChild>
          <Link href="/resultats">
            <ArrowRight className="w-4 h-4 mr-2" />
            {tr("Résultats", "Results")}
          </Link>
        </Button>
      </SiteHeader>

      <main className="max-w-[1100px] mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground font-mono mb-3">
            <ClipboardCheck className="w-3.5 h-3.5" />
            {tr("Évaluation humaine", "Human review")}
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {tr("Notez les réponses des modèles", "Score the model answers")}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-[15px]">
            {tr(
              "Lisez une question tirée au hasard et la réponse de chaque modèle, puis notez-les sur les mêmes 5 critères que le juge IA (chacun de 0 à 5). Vos notes alimentent un classement communautaire « score humain ». Aucun appel aux modèles n'est effectué — les réponses sont déjà enregistrées.",
              "Read a random question and each model's answer, then score them on the same 5 criteria as the AI judge (each 0–5). Your scores feed a community \"human score\" leaderboard. No model calls are made — the answers are already stored.",
            )}
          </p>
        </div>

        <Tabs defaultValue="review">
          <TabsList>
            <TabsTrigger value="review">
              <ClipboardCheck className="w-4 h-4 mr-2" />
              {tr("Évaluer", "Review")}
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Trophy className="w-4 h-4 mr-2" />
              {tr("Classement", "Leaderboard")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="review">
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-40 w-full rounded-lg" />
              </div>
            ) : isError || !question ? (
              <Card className="hairline-top">
                <CardContent className="py-12 text-center">
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {tr(
                      "Aucune question ne dispose encore de réponses générées à évaluer. Lancez d'abord un benchmark.",
                      "No question has stored answers to review yet. Run a benchmark first.",
                    )}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => refetch()}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {tr("Réessayer", "Retry")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-5">
                <Card className="hairline-top">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono">
                        {tr("Question", "Question")}
                        {trLoading && (
                          <span className="inline-flex items-center gap-1.5 text-primary normal-case tracking-normal">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            {tr("Traduction…", "Translating…")}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => refetch()}
                        disabled={isFetching}
                      >
                        {isFetching ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        {tr("Autre question", "Another question")}
                      </Button>
                    </div>
                    <p className="mt-3 text-[15px] leading-relaxed">
                      {trText(question.question)}
                    </p>
                  </CardContent>
                </Card>

                {answers.map((a) => {
                  const key = `${a.provider}::${a.model}`;
                  const s = scores[key] ?? {};
                  return (
                    <Card key={key} className="hairline-top">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="font-display font-semibold leading-tight">
                            {a.model}
                          </span>
                          <Badge variant="secondary" className="font-mono">
                            {a.provider}
                          </Badge>
                        </div>
                        <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
                          {trText(a.response)}
                        </p>

                        <div className="mt-5 border-t border-card-border pt-4 space-y-3">
                          {CRITERIA.map((c) => (
                            <div
                              key={c.key}
                              className="flex flex-wrap items-center justify-between gap-2"
                            >
                              <span className="text-sm text-muted-foreground">
                                {t(c.labelKey)}
                                {c.key === "hallucination" && (
                                  <span className="ml-1.5 text-xs text-muted-foreground/70">
                                    {tr("(5 = aucun risque)", "(5 = no risk)")}
                                  </span>
                                )}
                              </span>
                              <ScoreSelector
                                value={s[c.key]}
                                onChange={(v) => setScore(key, c.key, v)}
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}

                {submitMutation.isError && (
                  <p className="text-sm text-destructive">
                    {tr(
                      "L'enregistrement de vos notes a échoué. Réessayez.",
                      "Saving your scores failed. Please try again.",
                    )}
                  </p>
                )}

                <div className="flex items-center justify-end gap-3">
                  {!allScored && (
                    <span className="text-xs text-muted-foreground">
                      {tr(
                        "Notez les 5 critères de chaque réponse pour valider.",
                        "Score all 5 criteria for every answer to submit.",
                      )}
                    </span>
                  )}
                  <Button
                    onClick={handleSubmit}
                    disabled={!allScored || submitMutation.isPending}
                  >
                    {submitMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {tr("Envoyer mes notes", "Submit my scores")}
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="leaderboard">
            <ReviewLeaderboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function ReviewLeaderboard() {
  const { tr, t } = useI18n();
  const { data, isLoading, isError } = useGetReviewLeaderboard();

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }
  if (isError || !data) {
    return (
      <p className="text-sm text-destructive">
        {tr(
          "Erreur lors du chargement du classement.",
          "Error loading the leaderboard.",
        )}
      </p>
    );
  }
  if (data.rankings.length === 0) {
    return (
      <Card className="hairline-top">
        <CardContent className="py-12 text-center">
          <Crown className="w-8 h-8 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {tr(
              "Aucune évaluation pour l'instant. Soyez le premier à noter des réponses.",
              "No reviews yet. Be the first to score some answers.",
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground font-mono">
        {tr(
          `${data.totalReviews} évaluation${data.totalReviews > 1 ? "s" : ""} au total`,
          `${data.totalReviews} review${data.totalReviews > 1 ? "s" : ""} total`,
        )}
      </div>
      <Card className="hairline-top">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{tr("Rang", "Rank")}</TableHead>
                <TableHead>{tr("Modèle", "Model")}</TableHead>
                <TableHead className="text-right">
                  {tr("Score humain", "Human score")}
                </TableHead>
                {CRITERIA.map((c) => (
                  <TableHead key={c.key} className="text-right">
                    {t(c.labelKey)}
                  </TableHead>
                ))}
                <TableHead className="text-right">{tr("Évals", "Reviews")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rankings.map((row: ReviewModelRanking, index) => (
                <TableRow key={`${row.provider}/${row.model}`}>
                  <TableCell>
                    <span className="index-tag">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-display font-semibold leading-tight">
                      {row.model}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      {row.provider}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium tabular-nums">
                    {row.overall.toFixed(2)}
                  </TableCell>
                  {CRITERIA.map((c) => (
                    <TableCell
                      key={c.key}
                      className="text-right font-mono tabular-nums text-muted-foreground"
                    >
                      {row[c.key].toFixed(2)}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {row.nReviews}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
