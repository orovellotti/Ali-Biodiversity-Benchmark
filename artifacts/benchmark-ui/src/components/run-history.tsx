import { useMemo } from "react";
import { Link } from "wouter";
import {
  useListRuns,
  getListRunsQueryKey,
  useGetBenchmarkConfig,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { t, formatDateTime } from "@/lib/format";
import { Trash2, ArrowRight, BarChart3 } from "lucide-react";

export function RunHistory({
  onDelete,
  featured = true,
  emptyHint,
}: {
  onDelete?: (id: string, e: React.MouseEvent) => void;
  featured?: boolean;
  emptyHint?: string;
}) {
  const { data: runs, isLoading: runsLoading } = useListRuns({
    query: {
      queryKey: getListRunsQueryKey(),
      refetchInterval: (query) => {
        const hasActive = query.state.data?.some(
          (r) => r.status === "queued" || r.status === "running",
        );
        return hasActive ? 2000 : false;
      },
    },
  });

  // Map provider keys (openai, anthropic…) to the real model names
  // (gpt-4o-mini, claude-sonnet-4-5…) the benchmark actually runs.
  const { data: config } = useGetBenchmarkConfig();
  const modelNameById = useMemo(() => {
    const map = new Map<string, string>();
    config?.providers.forEach((p) => map.set(p.id, p.defaultModel));
    return map;
  }, [config]);
  const modelNames = (ids: string[]) =>
    ids.map((id) => modelNameById.get(id) ?? id).join(", ");

  const canDelete = !!onDelete;
  const latestCompleted = featured
    ? runs?.find((r) => r.status === "completed" && !r.dryRun)
    : undefined;

  return (
    <div>
      {latestCompleted && (
        <Link href={`/runs/${latestCompleted.id}`}>
          <div className="group mb-8 block rounded-2xl border border-primary/30 bg-primary/[0.04] p-6 sm:p-7 hover:border-primary/60 hover:shadow-lg transition-all cursor-pointer">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
              <div className="min-w-0">
                <div className="eyebrow mb-2 flex items-center gap-2 !text-primary">
                  <BarChart3 className="w-3.5 h-3.5" /> Dernier résultat
                </div>
                <h3 className="font-display text-2xl font-semibold tracking-tight">
                  Évaluation {latestCompleted.id.split("-").pop()}
                </h3>
                <p className="text-sm text-muted-foreground mt-2">
                  <span className="font-medium text-foreground">
                    {latestCompleted.models.length} modèles
                  </span>{" "}
                  comparés sur{" "}
                  <span className="font-medium text-foreground">
                    {latestCompleted.completed} questions
                  </span>{" "}
                  · {formatDateTime(latestCompleted.createdAt)}
                </p>
                <p className="text-xs text-muted-foreground mt-1 truncate">
                  {modelNames(latestCompleted.models)}
                </p>
              </div>
              <div className="shrink-0">
                <Button size="lg" className="w-full sm:w-auto">
                  Voir les résultats
                  <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </div>
            </div>
          </div>
        </Link>
      )}

      {latestCompleted && runs && runs.length > 1 && (
        <div className="eyebrow mb-4 !text-foreground/60">Historique complet</div>
      )}

      {runsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      ) : !runs || runs.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-xl bg-card/40">
          <p className="text-muted-foreground">
            Aucun run n'a été lancé pour le moment.
          </p>
          {emptyHint && (
            <p className="text-sm text-muted-foreground/70 mt-1">{emptyHint}</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {runs.map((r, i) => {
            const isActive = r.status === "queued" || r.status === "running";
            const progress =
              r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;

            return (
              <Link key={r.id} href={`/runs/${r.id}`}>
                <div className="block rounded-xl border border-card-border bg-card p-5 hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group relative h-full">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="index-tag">
                          {String(runs.length - i).padStart(2, "0")}
                        </span>
                        <span className="font-mono text-sm font-semibold">
                          {r.id.split("-").pop()}
                        </span>
                        <Badge
                          variant={
                            isActive
                              ? "default"
                              : r.status === "completed"
                                ? "secondary"
                                : "destructive"
                          }
                        >
                          {t(r.status)}
                        </Badge>
                        {r.dryRun && <Badge variant="outline">Simulation</Badge>}
                        {r.noEval && (
                          <Badge variant="outline">Sans évaluation</Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        Modèles : {modelNames(r.models)}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground shrink-0 font-mono">
                      {formatDateTime(r.createdAt)}
                    </p>
                  </div>

                  {isActive ? (
                    <div className="mt-4 space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{t(r.phase)}</span>
                        <span className="font-mono font-medium tabular-nums">
                          {r.completed} / {r.total}
                        </span>
                      </div>
                      <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 text-xs">
                      {r.status === "completed" ? (
                        <span className="text-primary font-medium">
                          {r.completed} questions traitées
                        </span>
                      ) : (
                        <span className="text-destructive truncate block max-w-full">
                          {r.error || "Erreur inconnue"}
                        </span>
                      )}
                    </div>
                  )}

                  {canDelete && (
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={(e) => onDelete!(r.id, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
