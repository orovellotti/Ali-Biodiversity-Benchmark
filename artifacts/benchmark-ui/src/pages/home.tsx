import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useGetBenchmarkConfig,
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
import { RunHistory } from "@/components/run-history";
import { t } from "@/lib/format";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { AlertCircle, Lock, LogOut, BarChart3 } from "lucide-react";

import {
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  isAuthError,
  isAdminDisabledError,
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

  const createRun = useCreateRun();
  const deleteRun = useDeleteRun();
  const verifyAdmin = useVerifyAdmin();

  // --- Admin login ---------------------------------------------------------
  // Launching (and deleting) a run is gated behind a login: the password is
  // verified server-side, then kept for the tab so the console is revealed.
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
          isAdminDisabledError(err)
            ? "Le lancement d'évaluations est désactivé sur ce serveur."
            : isAuthError(err)
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
      <SiteHeader maxWidth="max-w-[1200px]">
        <Button variant="outline" size="sm" asChild>
          <Link href="/resultats">
            <BarChart3 className="w-4 h-4 mr-2" /> Résultats
          </Link>
        </Button>
      </SiteHeader>

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
            Lancez et gérez les évaluations. Cet espace est réservé : une
            connexion est nécessaire. Pour consulter les résultats,{" "}
            <Link href="/resultats" className="text-primary hover:underline">
              rendez-vous sur la page Résultats
            </Link>
            .
          </p>
        </div>

        {/* Nouvelle analyse — login required */}
        <section>
          <div className="mb-5">
            <div className="eyebrow mb-1.5">
              <span className="text-primary">§01</span> Espace réservé
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

        {/* §02 Gérer les analyses — visible once logged in */}
        {authed && (
          <section className="mt-14">
            <div className="mb-5">
              <div className="eyebrow mb-1.5">
                <span className="text-primary">§02</span> Gestion
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                Gérer les analyses
              </h2>
              <p className="text-muted-foreground mt-2 text-[15px] max-w-2xl">
                Survolez un run pour le supprimer, ou cliquez pour ouvrir son
                tableau de bord.
              </p>
            </div>
            <RunHistory
              featured={false}
              onDelete={handleDelete}
              emptyHint="Lancez une première évaluation ci-dessus."
            />
          </section>
        )}
      </div>
    </div>
  );
}
