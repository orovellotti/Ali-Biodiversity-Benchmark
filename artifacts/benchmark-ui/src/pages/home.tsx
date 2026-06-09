import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useGetBenchmarkConfig,
  useListRuns,
  useCreateRun,
  useDeleteRun,
  useVerifyAdmin,
} from "@workspace/api-client-react";
import { getListRunsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { SiteHeader } from "@/components/site-header";
import { QuestionsPreview } from "@/components/questions-preview";
import { t, formatDateTime } from "@/lib/format";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { Trash2, AlertCircle, Lock, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  isAuthError,
} from "@/lib/admin";

const runSchema = z.object({
  models: z.array(z.string()).min(1, "Sélectionnez au moins un modèle"),
  topic: z.string().nullable(),
  limit: z.number().nullable().optional(),
  dryRun: z.boolean(),
  noEval: z.boolean(),
});

type RunFormValues = z.infer<typeof runSchema>;

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="eyebrow !text-foreground/70 mb-2 block">{children}</label>;
}

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
  const verifyAdmin = useVerifyAdmin();

  // --- Admin login ---------------------------------------------------------
  // Browsing results and questions is public. Launching (and deleting) a run is
  // gated behind a login: the password is verified server-side, then kept for
  // the tab so the launch form is revealed.
  const [authed, setAuthed] = useState<boolean>(() => !!getAdminToken());
  const [pwInput, setPwInput] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  const submitLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const value = pwInput.trim();
    if (!value) return;
    setLoginError(null);
    // Store first so the request transport attaches it as a Bearer token.
    setAdminToken(value);
    verifyAdmin.mutate(undefined, {
      onSuccess: () => {
        setAuthed(true);
        setPwInput("");
      },
      onError: (err) => {
        clearAdminToken();
        setAuthed(false);
        setLoginError(
          isAuthError(err)
            ? "Mot de passe incorrect."
            : "Connexion impossible. Réessayez.",
        );
      },
    });
  };

  const logout = () => {
    clearAdminToken();
    setAuthed(false);
    setPwInput("");
    setLoginError(null);
  };

  const handleAuthFailure = () => {
    clearAdminToken();
    setAuthed(false);
    setLoginError("Session expirée. Reconnectez-vous.");
  };

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
        onError: (err) => {
          if (isAuthError(err)) handleAuthFailure();
        },
      }
    );
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm("Supprimer ce run ?")) return;
    deleteRun.mutate(
      { runId: id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRunsQueryKey() });
        },
        onError: (err) => {
          if (isAuthError(err)) handleAuthFailure();
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader maxWidth="max-w-[1200px]" />

      <div className="max-w-[1200px] mx-auto px-6 py-10">
        {/* Page intro */}
        <div className="mb-10">
          <div className="eyebrow mb-3">
            <span className="text-primary">§</span> Poste de contrôle
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            Console de benchmark
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px] max-w-2xl">
            Consultez les résultats et le jeu de questions librement. Le
            lancement d'une nouvelle évaluation nécessite une connexion.
          </p>
        </div>

        {/* §01 Résultats — run history (public) */}
        <section className="mb-14">
          <div className="flex items-baseline justify-between mb-5">
            <div>
              <div className="eyebrow mb-1.5">
                <span className="text-primary">§01</span> Résultats
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Résultats &amp; historique des runs
              </h2>
            </div>
            {runs && runs.length > 0 && (
              <span className="index-tag">
                {String(runs.length).padStart(2, "0")} entrées
              </span>
            )}
          </div>

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
              <p className="text-sm text-muted-foreground/70 mt-1">
                Connectez-vous plus bas pour lancer une première évaluation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {runs.map((r, i) => {
                const isActive =
                  r.status === "queued" || r.status === "running";
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
                            {r.dryRun && (
                              <Badge variant="outline">Simulation</Badge>
                            )}
                            {r.noEval && (
                              <Badge variant="outline">Sans évaluation</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            Modèles : {r.models.join(", ")}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground shrink-0 font-mono">
                          {formatDateTime(r.createdAt)}
                        </p>
                      </div>

                      {isActive ? (
                        <div className="mt-4 space-y-1.5">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">
                              {t(r.phase)}
                            </span>
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

                      {authed && (
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
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* §02 Questions — the dataset (public) */}
        <section className="mb-14">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
            <div>
              <div className="eyebrow mb-1.5">
                <span className="text-primary">§02</span> Le jeu de données
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Les questions
              </h2>
              <p className="text-muted-foreground mt-2 text-[15px] max-w-2xl">
                Parcourez l'ensemble des questions du jeu de données «&nbsp;jugement
                biodiversité&nbsp;» — filtrez par famille, par difficulté ou par
                mot-clé.
              </p>
            </div>
            <QuestionsPreview />
          </div>
        </section>

        {/* §03 Nouvelle analyse — login required */}
        <section>
          <div className="mb-5">
            <div className="eyebrow mb-1.5">
              <span className="text-primary">§03</span> Espace réservé
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              Lancer une nouvelle analyse
            </h2>
          </div>

          {!authed ? (
            <Card className="overflow-hidden max-w-md">
              <div className="px-6 py-4 border-b border-card-border bg-secondary/40 flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                <div className="eyebrow !text-foreground/80">Connexion</div>
              </div>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-4">
                  Le lancement d'une évaluation est réservé. Saisissez le mot de
                  passe pour accéder au formulaire.
                </p>
                <form onSubmit={submitLogin} className="space-y-3">
                  <Input
                    type="password"
                    placeholder="Mot de passe administrateur"
                    value={pwInput}
                    onChange={(e) => setPwInput(e.target.value)}
                  />
                  {loginError && (
                    <p className="text-sm text-destructive flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" />
                      {loginError}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={!pwInput.trim() || verifyAdmin.isPending}
                  >
                    {verifyAdmin.isPending ? "Connexion..." : "Se connecter"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="px-6 py-4 border-b border-card-border bg-secondary/40 flex items-center justify-between">
                <div className="eyebrow !text-foreground/80">Nouveau run</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={logout}
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" /> Déconnexion
                </Button>
              </div>
              <CardContent className="p-6">
                {configLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !config ? (
                  <div className="text-destructive text-sm">
                    Erreur de chargement de la configuration
                  </div>
                ) : (
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                      <FieldLabel>Modèles à évaluer</FieldLabel>
                      <div className="space-y-2">
                        {config.providers.map((p) => (
                          <Controller
                            key={p.id}
                            name="models"
                            control={form.control}
                            render={({ field }) => {
                              const checked = field.value.includes(p.id);
                              return (
                                <label
                                  htmlFor={`model-${p.id}`}
                                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer ${
                                    !p.available
                                      ? "opacity-50 cursor-not-allowed border-border"
                                      : checked
                                        ? "border-primary/60 bg-primary/5"
                                        : "border-border hover:border-primary/40 hover:bg-secondary/40"
                                  }`}
                                >
                                  <Checkbox
                                    id={`model-${p.id}`}
                                    disabled={!p.available}
                                    checked={checked}
                                    onCheckedChange={(c) => {
                                      if (c) field.onChange([...field.value, p.id]);
                                      else
                                        field.onChange(
                                          field.value.filter((v) => v !== p.id),
                                        );
                                    }}
                                    className="mt-0.5"
                                  />
                                  <div className="grid leading-tight">
                                    <span className="text-sm font-medium">
                                      {p.id}
                                    </span>
                                    <span className="text-xs font-mono text-muted-foreground mt-0.5">
                                      {p.defaultModel}
                                    </span>
                                    {p.id === "openai-small" && p.available && (
                                      <span className="text-xs text-muted-foreground mt-1">
                                        Petit modèle « baseline » volontairement
                                        plus faible (comparaison)
                                      </span>
                                    )}
                                    {!p.available && (
                                      <span className="text-xs text-muted-foreground mt-1">
                                        Non disponible (clé API manquante ou
                                        serveur local hors ligne)
                                      </span>
                                    )}
                                  </div>
                                </label>
                              );
                            }}
                          />
                        ))}
                      </div>
                      {form.formState.errors.models && (
                        <p className="text-xs text-destructive mt-2">
                          {form.formState.errors.models.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <FieldLabel>Filtre par famille (optionnel)</FieldLabel>
                      <Controller
                        name="topic"
                        control={form.control}
                        render={({ field }) => (
                          <select
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={field.value || ""}
                            onChange={(e) =>
                              field.onChange(e.target.value || null)
                            }
                          >
                            <option value="">Toutes les familles</option>
                            {config.topics.map((t_id) => (
                              <option key={t_id} value={t_id}>
                                {t(t_id)}
                              </option>
                            ))}
                          </select>
                        )}
                      />
                    </div>

                    <div>
                      <FieldLabel>Limite de questions (optionnel)</FieldLabel>
                      <Controller
                        name="limit"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            type="number"
                            placeholder={`Max ${config.totalQuestions}`}
                            value={field.value || ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseInt(e.target.value)
                                  : null,
                              )
                            }
                            min={1}
                            max={config.totalQuestions}
                          />
                        )}
                      />
                    </div>

                    <div className="space-y-3 pt-4 border-t border-border">
                      <label
                        htmlFor="dryRun"
                        className="flex items-start gap-3 cursor-pointer"
                      >
                        <Controller
                          name="dryRun"
                          control={form.control}
                          render={({ field }) => (
                            <Checkbox
                              id="dryRun"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-0.5"
                            />
                          )}
                        />
                        <div className="grid gap-0.5 leading-none">
                          <span className="text-sm font-medium">
                            Simulation (dry-run)
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Aucun appel API réel ne sera effectué.
                          </span>
                        </div>
                      </label>

                      <label
                        htmlFor="noEval"
                        className="flex items-start gap-3 cursor-pointer"
                      >
                        <Controller
                          name="noEval"
                          control={form.control}
                          render={({ field }) => (
                            <Checkbox
                              id="noEval"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              className="mt-0.5"
                            />
                          )}
                        />
                        <div className="grid gap-0.5 leading-none">
                          <span className="text-sm font-medium">
                            Sauter l'évaluation
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Les réponses seront générées mais non notées par le
                            juge.
                          </span>
                        </div>
                      </label>
                    </div>

                    {!config.judgeAvailable &&
                      !form.watch("noEval") &&
                      !form.watch("dryRun") && (
                        <div className="p-3 bg-ochre/10 border border-ochre/30 rounded-md flex items-start gap-2 text-ochre">
                          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                          <p className="text-xs">
                            Le modèle juge ({config.judgeModel}) n'est pas
                            disponible. L'évaluation sera sautée sauf si une clé
                            API est fournie.
                          </p>
                        </div>
                      )}

                    <div className="pt-4 flex items-center justify-between border-t border-border">
                      <div className="text-xs text-muted-foreground">
                        Est. requêtes
                        <span className="font-mono font-bold text-foreground ml-1.5 tabular-nums">
                          {estimatedRequests}
                        </span>
                      </div>
                      <Button
                        type="submit"
                        disabled={
                          createRun.isPending || selectedModels.length === 0
                        }
                      >
                        {createRun.isPending ? (
                          "Lancement..."
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 mr-2" /> Lancer
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
