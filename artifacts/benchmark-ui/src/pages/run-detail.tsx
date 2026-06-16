import { useRoute } from "wouter";
import { Link } from "wouter";
import {
  useGetRun,
  useGetRunResults,
  getGetRunQueryKey,
  getGetRunResultsQueryKey,
} from "@workspace/api-client-react";
import { SiteHeader } from "@/components/site-header";
import { PrintButton } from "@/components/controls";
import { ShareMenu } from "@/components/share-menu";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Loader2, AlertTriangle, CheckCircle2, Share2 } from "lucide-react";
import { ResultsDashboard } from "./results-dashboard";

export function RunDetail() {
  const { tr, t, formatDateTime } = useI18n();
  const [, params] = useRoute("/runs/:id");
  const runId = params?.id || "";

  // Poll useGetRun every 2s while the run is active.
  const { data: run, isLoading: runLoading } = useGetRun(runId, {
    query: {
      enabled: !!runId,
      queryKey: getGetRunQueryKey(runId),
      refetchInterval: (query) => {
        const status = query.state.data?.status;
        return status === "queued" || status === "running" ? 2000 : false;
      },
    },
  });

  const isFinished =
    run &&
    (run.status === "completed" ||
      run.status === "failed" ||
      run.status === "interrupted");

  // Only fetch results when the run completed successfully.
  const { data: results, isLoading: resultsLoading } = useGetRunResults(runId, {
    query: {
      enabled: !!(isFinished && run.status === "completed"),
      queryKey: getGetRunResultsQueryKey(runId),
    },
  });

  if (runLoading && !run) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader maxWidth="max-w-[1400px]" />
        <div className="p-16 flex justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader maxWidth="max-w-[1400px]" />
        <div className="p-16">
          <div className="max-w-xl mx-auto text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="font-display text-2xl font-semibold">
              {tr("Run introuvable", "Run not found")}
            </h1>
            <p className="text-muted-foreground">
              {tr(
                `Le benchmark avec l'ID ${runId} n'existe pas ou a été supprimé.`,
                `The benchmark with ID ${runId} does not exist or has been deleted.`,
              )}
            </p>
            <Link href="/resultats" className="text-primary hover:underline">
              {tr("Retour aux résultats", "Back to results")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isActive = run.status === "queued" || run.status === "running";
  const progress =
    run.total > 0 ? Math.round((run.completed / run.total) * 100) : 0;

  // Shareable deep link to this run, with a summary text for social posts.
  const shareUrl =
    typeof window !== "undefined" ? window.location.href : "";
  // Only claim a "top model" when the run was actually judged.
  const winner =
    !run.noEval && !run.dryRun
      ? results?.summaryByModel?.[0]?.model
      : undefined;
  const modelCount = run.models.length;
  const questionCount = run.total || run.limit || undefined;
  const shareText = (() => {
    const counts = [
      modelCount
        ? tr(`${modelCount} modèles d'IA`, `${modelCount} AI models`)
        : null,
      questionCount
        ? tr(`${questionCount} questions`, `${questionCount} questions`)
        : null,
    ]
      .filter(Boolean)
      .join(tr(" · ", " · "));
    const headline = tr(
      "Benchmark Biodiversité ALI",
      "ALI Biodiversity Benchmark",
    );
    const winnerPart = winner
      ? tr(` — modèle le plus fiable : ${winner}.`, ` — top model: ${winner}.`)
      : ".";
    return counts
      ? `${headline} : ${counts}${winnerPart}`
      : `${headline}${winnerPart}`;
  })();

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader maxWidth="max-w-[1400px]">
        <ShareMenu
          url={shareUrl}
          text={shareText}
          align="end"
          trigger={
            <button
              type="button"
              className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-md bg-secondary text-secondary-foreground/80 hover:bg-secondary/70 transition-colors text-[12px] print:hidden"
              aria-label={tr("Partager ce run", "Share this run")}
            >
              <Share2 className="w-3.5 h-3.5" />
              {tr("Partager", "Share")}
            </button>
          }
        />
        <PrintButton disabled={isActive} />
      </SiteHeader>

      <div className="max-w-[1400px] mx-auto px-6 py-8">
        <Link
          href="/resultats"
          className="eyebrow hover:text-foreground transition-colors mb-4 print:hidden"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> {tr("Retour aux résultats", "Back to results")}
        </Link>

        <div className="mb-8 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
          <div>
            <div className="index-tag mb-2">run · {run.id.split("-").pop()}</div>
            <h1 className="font-display text-4xl font-semibold tracking-tight flex items-center gap-3 flex-wrap">
              Run {run.id.split("-").pop()}
              <Badge
                variant={
                  isActive
                    ? "default"
                    : run.status === "completed"
                      ? "secondary"
                      : "destructive"
                }
                className="text-sm font-normal align-middle"
              >
                {t(run.status)}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-2 text-[14px]">
              {tr("Modèles", "Models")} : {run.models.join(", ")}
              {run.topic && ` • ${tr("Famille", "Family")} : ${t(run.topic)}`}
              {run.limit && ` • ${tr("Limite", "Limit")} : ${run.limit}`}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              {run.dryRun && (
                <span className="text-[11px] font-mono uppercase tracking-wider rounded-full px-2.5 py-0.5 bg-muted text-muted-foreground">
                  {tr("Simulation", "Dry run")}
                </span>
              )}
              {run.noEval && (
                <span className="text-[11px] font-mono uppercase tracking-wider rounded-full px-2.5 py-0.5 bg-muted text-muted-foreground">
                  {tr("Sans évaluation", "No evaluation")}
                </span>
              )}
              {!run.noEval && run.judgeModel && (
                <span className="text-[11px] font-mono uppercase tracking-wider rounded-full px-2.5 py-0.5 bg-primary/10 text-primary">
                  {tr("Juge", "Judge")} : {run.judgeModel}
                </span>
              )}
              <span className="text-[12px] text-muted-foreground ml-1">
                {tr("Lancé le", "Started on")} {formatDateTime(run.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Live Progress Banner */}
        {isActive && (
          <Card className="mb-8 border-primary/30 bg-primary/5 overflow-hidden">
            <div className="absolute inset-0 paper-grid opacity-50 pointer-events-none" />
            <CardContent className="p-6 relative">
              <div className="flex items-center justify-between mb-4 gap-4">
                <div>
                  <div className="eyebrow mb-1.5 !text-primary">
                    {tr("En cours d'exécution", "In progress")}
                  </div>
                  <h3 className="font-display font-semibold text-xl flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    {t(run.phase)}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {tr(
                      "Le benchmark tourne en local. Vous pouvez quitter cette page, la progression est sauvegardée.",
                      "The benchmark is running locally. You can leave this page; progress is saved.",
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-display text-4xl font-semibold text-primary tabular-nums">
                    {progress}%
                  </span>
                  <p className="text-sm text-muted-foreground font-mono">
                    {run.completed} / {run.total}
                  </p>
                </div>
              </div>
              <div className="w-full bg-background rounded-full h-3 border border-border overflow-hidden">
                <div
                  className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Banner */}
        {run.status === "failed" && run.error && (
          <Card className="mb-8 border-destructive/50 bg-destructive/5">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-destructive text-lg">
                    {tr("Échec de l'exécution", "Run failed")}
                  </h3>
                  <pre className="mt-2 text-sm bg-background p-4 rounded-md border border-border overflow-x-auto text-destructive whitespace-pre-wrap font-mono">
                    {run.error}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Banner (results still loading) */}
        {run.status === "completed" && !results && resultsLoading && (
          <Card className="mb-8">
            <CardContent className="p-6 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <h3 className="font-display font-semibold text-lg">
                {tr("Génération du rapport…", "Generating report…")}
              </h3>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        )}

        {/* Results Dashboard */}
        {results && <ResultsDashboard results={results} run={run} />}
      </div>
    </div>
  );
}
