import { useRoute } from "wouter";
import { Link } from "wouter";
import {
  useGetRun,
  useGetRunResults,
  getGetRunQueryKey,
  getGetRunResultsQueryKey,
} from "@workspace/api-client-react";
import { DarkModeToggle, PrintButton } from "@/components/controls";
import { t, formatDateTime } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
// We will implement ResultsDashboard later
import { ResultsDashboard } from "./results-dashboard";

export function RunDetail() {
  const [match, params] = useRoute("/runs/:id");
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
      <div className="min-h-screen bg-background p-8 flex justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-xl mx-auto text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Run introuvable</h1>
          <p className="text-muted-foreground">Le benchmark avec l'ID {runId} n'existe pas ou a été supprimé.</p>
          <Link href="/">
            <a className="text-primary hover:underline">Retour à l'accueil</a>
          </Link>
        </div>
      </div>
    );
  }

  const isActive = run.status === "queued" || run.status === "running";
  const progress = run.total > 0 ? Math.round((run.completed / run.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-background px-5 py-4 pt-[32px] pb-[32px] pl-[24px] pr-[24px]">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="pt-2">
            <div className="flex items-center gap-2 mb-2 print:hidden">
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground flex items-center transition-colors">
                <ChevronLeft className="w-4 h-4" /> Retour
              </Link>
            </div>
            <h1 className="font-bold text-[32px] flex items-center gap-3">
              Run {run.id.split('-').pop()}
              <Badge variant={isActive ? "default" : run.status === "completed" ? "secondary" : "destructive"} className="text-sm font-normal">
                {t(run.status)}
              </Badge>
            </h1>
            <p className="text-muted-foreground mt-1.5 text-[14px]">
              Modèles : {run.models.join(', ')}
              {run.topic && ` • Topic: ${t(run.topic)}`}
              {run.limit && ` • Limite: ${run.limit}`}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[12px] text-muted-foreground shrink-0">Tags :</span>
              {run.dryRun && <span className="text-[12px] font-bold rounded px-2 py-0.5 bg-muted text-muted-foreground">Simulation</span>}
              {run.noEval && <span className="text-[12px] font-bold rounded px-2 py-0.5 bg-muted text-muted-foreground">Sans évaluation</span>}
              {!run.noEval && run.judgeModel && (
                <span className="text-[12px] font-bold rounded px-2 py-0.5 bg-primary/10 text-primary">Juge : {run.judgeModel}</span>
              )}
            </div>
            <p className="text-[12px] text-muted-foreground mt-3">Lancé le {formatDateTime(run.createdAt)}</p>
          </div>
          <div className="flex items-center gap-3 pt-2 print:hidden">
            <PrintButton disabled={isActive} />
            <DarkModeToggle />
          </div>
        </div>

        {/* Live Progress Banner */}
        {isActive && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                    {t(run.phase)}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Le benchmark est en cours d'exécution locale. Veuillez patienter...
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold text-primary">{progress}%</span>
                  <p className="text-sm text-muted-foreground">{run.completed} / {run.total} requêtes</p>
                </div>
              </div>
              <div className="w-full bg-background rounded-full h-3 border">
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
                <div>
                  <h3 className="font-semibold text-destructive">Échec de l'exécution</h3>
                  <pre className="mt-2 text-sm bg-background p-4 rounded-md border overflow-x-auto text-destructive whitespace-pre-wrap">
                    {run.error}
                  </pre>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success Banner (if no results loaded yet but run completed) */}
        {run.status === "completed" && !results && resultsLoading && (
          <Card className="mb-8">
            <CardContent className="p-6 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-primary mx-auto" />
              <h3 className="font-semibold text-lg">Génération du rapport...</h3>
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
