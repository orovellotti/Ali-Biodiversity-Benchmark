import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useGetBenchmarkConfig,
  useListRuns,
  useCreateRun,
  useDeleteRun,
} from "@workspace/api-client-react";
import { getListRunsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { DarkModeToggle } from "@/components/controls";
import { t, formatDateTime } from "@/lib/format";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Play, Trash2, Settings, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const runSchema = z.object({
  models: z.array(z.string()).min(1, "Sélectionnez au moins un modèle"),
  topic: z.string().nullable(),
  limit: z.number().nullable().optional(),
  dryRun: z.boolean(),
  noEval: z.boolean(),
});

type RunFormValues = z.infer<typeof runSchema>;

export function Home() {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: config, isLoading: configLoading } = useGetBenchmarkConfig();

  // Poll the runs list every 2s only while at least one run is active.
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

  const createRun = useCreateRun();
  const deleteRun = useDeleteRun();

  const form = useForm<RunFormValues>({
    resolver: zodResolver(runSchema),
    defaultValues: {
      models: [],
      topic: null,
      limit: null,
      dryRun: false,
      noEval: false,
    },
  });

  const selectedModels = form.watch("models");
  const selectedLimit = form.watch("limit");

  const estimatedRequests = config
    ? selectedModels.length * (selectedLimit || config.totalQuestions)
    : 0;

  const onSubmit = (values: RunFormValues) => {
    createRun.mutate(
      { data: values },
      {
        onSuccess: (newRun) => {
          queryClient.invalidateQueries({ queryKey: getListRunsQueryKey() });
          setLocation(`/runs/${newRun.id}`);
        },
      }
    );
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (confirm("Supprimer ce run ?")) {
      deleteRun.mutate(
        { runId: id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListRunsQueryKey() });
          },
        }
      );
    }
  };

  return (
    <div className="min-h-screen bg-background px-5 py-4 pt-[32px] pb-[32px] pl-[24px] pr-[24px]">
      <div className="max-w-[1200px] mx-auto">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="pt-2">
            <h1 className="font-bold text-[32px]">Biodiversity Judgment Benchmark</h1>
            <p className="text-muted-foreground mt-1.5 text-[14px]">
              Contrôle et analyse des modèles de langage sur les questions de biodiversité.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2 print:hidden">
            <DarkModeToggle />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Form */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                  <Settings className="w-5 h-5" /> Nouveau Run
                </CardTitle>
                <CardDescription>Configurer une nouvelle évaluation</CardDescription>
              </CardHeader>
              <CardContent>
                {configLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !config ? (
                  <div className="text-red-500">Erreur de chargement de la configuration</div>
                ) : (
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-semibold">Modèles à évaluer</label>
                      <div className="space-y-2">
                        {config.providers.map((p) => (
                          <div key={p.id} className="flex items-start gap-2">
                            <Controller
                              name="models"
                              control={form.control}
                              render={({ field }) => (
                                <Checkbox
                                  id={`model-${p.id}`}
                                  disabled={!p.available}
                                  checked={field.value.includes(p.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      field.onChange([...field.value, p.id]);
                                    } else {
                                      field.onChange(field.value.filter((v) => v !== p.id));
                                    }
                                  }}
                                />
                              )}
                            />
                            <div className="grid leading-none">
                              <label
                                htmlFor={`model-${p.id}`}
                                className={`text-sm font-medium ${!p.available && 'text-muted-foreground opacity-50'}`}
                              >
                                {p.id} ({p.defaultModel})
                              </label>
                              {!p.available && (
                                <span className="text-xs text-muted-foreground">Non disponible (clé API manquante ou serveur local hors ligne)</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {form.formState.errors.models && (
                        <p className="text-xs text-red-500">{form.formState.errors.models.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Filtre par Topic (optionnel)</label>
                      <Controller
                        name="topic"
                        control={form.control}
                        render={({ field }) => (
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                          >
                            <option value="">Tous les topics</option>
                            {config.topics.map((t_id) => (
                              <option key={t_id} value={t_id}>{t(t_id)}</option>
                            ))}
                          </select>
                        )}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold">Limite de questions (optionnel)</label>
                      <Controller
                        name="limit"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            type="number"
                            placeholder={`Max ${config.totalQuestions}`}
                            value={field.value || ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                            min={1}
                            max={config.totalQuestions}
                          />
                        )}
                      />
                    </div>

                    <div className="space-y-4 pt-2 border-t">
                      <div className="flex items-start gap-2">
                        <Controller
                          name="dryRun"
                          control={form.control}
                          render={({ field }) => (
                            <Checkbox id="dryRun" checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label htmlFor="dryRun" className="text-sm font-medium">Simulation (dry-run)</label>
                          <p className="text-xs text-muted-foreground">Aucun appel API réel ne sera effectué.</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Controller
                          name="noEval"
                          control={form.control}
                          render={({ field }) => (
                            <Checkbox id="noEval" checked={field.value} onCheckedChange={field.onChange} />
                          )}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label htmlFor="noEval" className="text-sm font-medium">Sauter l'évaluation</label>
                          <p className="text-xs text-muted-foreground">Les réponses seront générées mais non notées par le juge.</p>
                        </div>
                      </div>
                    </div>

                    {!config.judgeAvailable && !form.watch("noEval") && !form.watch("dryRun") && (
                      <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-900 rounded-md flex items-start gap-2 text-amber-800 dark:text-amber-200">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-xs">Le modèle juge ({config.judgeModel}) n'est pas disponible. L'évaluation sera sautée sauf si une clé API est fournie.</p>
                      </div>
                    )}

                    <div className="pt-4 flex items-center justify-between border-t">
                      <div className="text-sm text-muted-foreground">
                        Est. requêtes: <span className="font-bold">{estimatedRequests}</span>
                      </div>
                      <Button type="submit" disabled={createRun.isPending || selectedModels.length === 0}>
                        {createRun.isPending ? "Lancement..." : <><Play className="w-4 h-4 mr-2" /> Lancer</>}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Runs History */}
          <div className="lg:col-span-2">
            <Card className="h-full border-none shadow-none bg-transparent">
              <CardHeader className="px-0 pt-0">
                <CardTitle className="text-xl">Historique des Runs</CardTitle>
                <CardDescription>Liste des benchmarks passés et en cours</CardDescription>
              </CardHeader>
              <CardContent className="px-0">
                {runsLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-20 w-full rounded-lg" />
                    <Skeleton className="h-20 w-full rounded-lg" />
                  </div>
                ) : !runs || runs.length === 0 ? (
                  <div className="p-8 text-center border rounded-lg border-dashed bg-muted/20">
                    <p className="text-muted-foreground">Aucun run n'a été lancé pour le moment.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {runs.map((r) => {
                      const isActive = r.status === "queued" || r.status === "running";
                      const progress = r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0;
                      
                      return (
                        <Link key={r.id} href={`/runs/${r.id}`}>
                          <div className="block border rounded-lg p-4 hover:border-primary/50 hover:bg-muted/10 transition-all cursor-pointer group relative">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-mono text-sm font-semibold">{r.id.split('-').pop()}</span>
                                  <Badge variant={isActive ? "default" : r.status === "completed" ? "secondary" : "destructive"}>
                                    {t(r.status)}
                                  </Badge>
                                  {r.dryRun && <Badge variant="outline">Simulation</Badge>}
                                  {r.noEval && <Badge variant="outline">Sans évaluation</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  Modèles: {r.models.join(', ')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</p>
                              </div>
                            </div>
                            
                            {isActive ? (
                              <div className="mt-4 space-y-1">
                                <div className="flex justify-between text-xs mb-1">
                                  <span>{t(r.phase)}</span>
                                  <span className="font-medium">{r.completed} / {r.total}</span>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-1.5">
                                  <div 
                                    className="bg-primary h-1.5 rounded-full transition-all duration-500" 
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="mt-2 text-xs">
                                {r.status === "completed" ? (
                                  <span className="text-primary font-medium">{r.completed} questions traitées</span>
                                ) : (
                                  <span className="text-red-500 truncate block max-w-full">{r.error || "Erreur inconnue"}</span>
                                )}
                              </div>
                            )}

                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:bg-destructive/10"
                                onClick={(e) => handleDelete(r.id, e)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
