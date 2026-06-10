import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useGetBenchmarkConfig,
  useCreateRun,
  useDeleteRun,
  useVerifyAdmin,
  useListRuns,
} from "@workspace/api-client-react";
import { getListRunsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SiteHeader } from "@/components/site-header";
import { RunHistory } from "@/components/run-history";
import { useI18n } from "@/lib/i18n";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation } from "wouter";
import { AlertCircle, Lock, LogOut, BarChart3, ShieldCheck } from "lucide-react";

import {
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  isAuthError,
  isAdminDisabledError,
  isConflictError,
  apiErrorMessage,
} from "@/lib/admin";

const runSchema = z.object({
  models: z.array(z.string()).min(1),
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
  const { tr, t } = useI18n();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: config, isLoading: configLoading } = useGetBenchmarkConfig();

  const localizedSchema = useMemo(
    () =>
      z.object({
        models: z
          .array(z.string())
          .min(1, tr("Sélectionnez au moins un modèle", "Select at least one model")),
        topic: z.string().nullable(),
        limit: z.number().nullable().optional(),
        dryRun: z.boolean(),
        noEval: z.boolean(),
      }),
    [tr],
  );

  const createRun = useCreateRun();
  const deleteRun = useDeleteRun();
  const verifyAdmin = useVerifyAdmin();

  // Poll runs so we can block a launch while another analysis is active.
  const { data: runs } = useListRuns({
    query: { queryKey: getListRunsQueryKey(), refetchInterval: 5000 },
  });
  const activeRun = useMemo(
    () =>
      (runs ?? []).find(
        (r) => r.status === "running" || r.status === "queued",
      ) ?? null,
    [runs],
  );

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
            ? tr(
                "Le lancement d'évaluations est désactivé sur ce serveur.",
                "Launching evaluations is disabled on this server.",
              )
            : isAuthError(err)
              ? tr("Mot de passe incorrect.", "Incorrect password.")
              : tr("Connexion impossible. Réessayez.", "Unable to connect. Try again."),
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
    setLoginError(tr("Session expirée. Reconnectez-vous.", "Session expired. Please log in again."));
  };

  const form = useForm<RunFormValues>({
    resolver: zodResolver(localizedSchema),
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
  const dryRun = form.watch("dryRun");

  const noEval = form.watch("noEval");
  const plannedQuestions = config
    ? selectedLimit || config.totalQuestions
    : 0;
  // Mirror the server cap: count answer calls plus judge-scoring calls (another
  // models × questions when the run is evaluated and a judge is configured).
  const answerRequests = selectedModels.length * plannedQuestions;
  const judged = !noEval && (config?.judgeAvailable ?? false);
  const estimatedRequests = answerRequests + (judged ? answerRequests : 0);
  const cap = config?.maxRequestsPerRun ?? 0;
  // A real (non-simulation) run over the server-enforced ceiling is refused.
  const overCap = !dryRun && cap > 0 && estimatedRequests > cap;

  const [launchError, setLaunchError] = useState<string | null>(null);
  const [pendingValues, setPendingValues] = useState<RunFormValues | null>(null);

  const doLaunch = (values: RunFormValues) => {
    setLaunchError(null);
    createRun.mutate(
      { data: values },
      {
        onSuccess: (newRun) => {
          queryClient.invalidateQueries({ queryKey: getListRunsQueryKey() });
          setLocation(`/runs/${newRun.id}`);
        },
        onError: (err) => {
          if (isAuthError(err)) {
            handleAuthFailure();
            return;
          }
          const msg = apiErrorMessage(err);
          setLaunchError(
            msg ??
              (isConflictError(err)
                ? tr(
                    "Une analyse est déjà en cours.",
                    "An analysis is already running.",
                  )
                : tr(
                    "Le lancement a échoué. Réessayez.",
                    "Launch failed. Try again.",
                  )),
          );
        },
      },
    );
  };

  // Always confirm before a real launch — the dialog spells out the cost.
  const onSubmit = (values: RunFormValues) => {
    setLaunchError(null);
    setPendingValues(values);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    if (!confirm(tr("Supprimer ce run ?", "Delete this run?"))) return;
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
            <BarChart3 className="w-4 h-4 mr-2" /> {tr("Résultats", "Results")}
          </Link>
        </Button>
      </SiteHeader>

      <div className="max-w-[1200px] mx-auto px-6 py-10">
        {/* Page intro */}
        <div className="mb-10">
          <div className="eyebrow mb-3">
            <span className="text-primary">§</span> {tr("Poste de contrôle", "Control station")}
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {tr("Console de benchmark", "Benchmark console")}
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px] max-w-2xl">
            {tr(
              "Lancez et gérez les évaluations. Cet espace est réservé : une connexion est nécessaire. Pour consulter les résultats,",
              "Launch and manage evaluations. This area is restricted: login is required. To view the results,",
            )}{" "}
            <Link href="/resultats" className="text-primary hover:underline">
              {tr("rendez-vous sur la page Résultats", "head to the Results page")}
            </Link>
            .
          </p>
        </div>

        {/* Nouvelle analyse — login required */}
        <section>
          <div className="mb-5">
            <div className="eyebrow mb-1.5">
              <span className="text-primary">§01</span> {tr("Espace réservé", "Restricted area")}
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight">
              {tr("Lancer une nouvelle analyse", "Launch a new analysis")}
            </h2>
          </div>

          {!authed ? (
            <Card className="overflow-hidden max-w-md">
              <div className="px-6 py-4 border-b border-card-border bg-secondary/40 flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                <div className="eyebrow !text-foreground/80">{tr("Connexion", "Login")}</div>
              </div>
              <CardContent className="p-6">
                <p className="text-sm text-muted-foreground mb-4">
                  {tr(
                    "Le lancement d'une évaluation est réservé. Saisissez le mot de passe pour accéder au formulaire.",
                    "Launching an evaluation is restricted. Enter the password to access the form.",
                  )}
                </p>
                <form onSubmit={submitLogin} className="space-y-3">
                  <Input
                    type="password"
                    placeholder={tr("Mot de passe administrateur", "Administrator password")}
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
                    {verifyAdmin.isPending
                      ? tr("Connexion...", "Connecting...")
                      : tr("Se connecter", "Log in")}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="px-6 py-4 border-b border-card-border bg-secondary/40 flex items-center justify-between">
                <div className="eyebrow !text-foreground/80">{tr("Nouveau run", "New run")}</div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={logout}
                >
                  <LogOut className="w-3.5 h-3.5 mr-1.5" /> {tr("Déconnexion", "Log out")}
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
                    {tr(
                      "Erreur de chargement de la configuration",
                      "Error loading the configuration",
                    )}
                  </div>
                ) : (
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <div>
                      <FieldLabel>{tr("Modèles à évaluer", "Models to evaluate")}</FieldLabel>
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
                                        {tr(
                                          "Petit modèle « baseline » volontairement plus faible (comparaison)",
                                          "Small \u201cbaseline\u201d model intentionally weaker (for comparison)",
                                        )}
                                      </span>
                                    )}
                                    {!p.available && (
                                      <span className="text-xs text-muted-foreground mt-1">
                                        {tr(
                                          "Non disponible (clé API manquante ou serveur local hors ligne)",
                                          "Unavailable (missing API key or local server offline)",
                                        )}
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
                      <FieldLabel>{tr("Filtre par famille (optionnel)", "Filter by family (optional)")}</FieldLabel>
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
                            <option value="">{tr("Toutes les familles", "All families")}</option>
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
                      <FieldLabel>{tr("Limite de questions (optionnel)", "Question limit (optional)")}</FieldLabel>
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
                            {tr("Simulation (dry-run)", "Simulation (dry-run)")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {tr(
                              "Aucun appel API réel ne sera effectué.",
                              "No real API calls will be made.",
                            )}
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
                            {tr("Sauter l'évaluation", "Skip the evaluation")}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {tr(
                              "Les réponses seront générées mais non notées par le juge.",
                              "Answers will be generated but not graded by the judge.",
                            )}
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
                            {tr(
                              `Le modèle juge (${config.judgeModel}) n'est pas disponible. L'évaluation sera sautée sauf si une clé API est fournie.`,
                              `The judge model (${config.judgeModel}) is not available. The evaluation will be skipped unless an API key is provided.`,
                            )}
                          </p>
                        </div>
                      )}

                    {activeRun && (
                      <div className="p-3 bg-secondary border border-card-border rounded-md flex items-start gap-2 text-foreground/80">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
                        <p className="text-xs">
                          {tr(
                            "Une analyse est déjà en cours. Pour protéger vos crédits, une seule analyse peut tourner à la fois — attendez sa fin ou supprimez-la avant d'en lancer une autre.",
                            "An analysis is already running. To protect your credits, only one analysis can run at a time — wait for it to finish or delete it before launching another.",
                          )}
                        </p>
                      </div>
                    )}

                    {overCap && (
                      <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md flex items-start gap-2 text-destructive">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-xs">
                          {tr(
                            `Cette configuration déclencherait ~${estimatedRequests} requêtes, au-dessus de la limite de sécurité de ${cap}. Réduisez le nombre de modèles ou fixez une limite de questions plus basse (ou passez en simulation).`,
                            `This configuration would trigger ~${estimatedRequests} requests, above the safety cap of ${cap}. Reduce the number of models or set a lower question limit (or switch to simulation).`,
                          )}
                        </p>
                      </div>
                    )}

                    {launchError && (
                      <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-md flex items-start gap-2 text-destructive">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <p className="text-xs">{launchError}</p>
                      </div>
                    )}

                    <div className="pt-4 flex items-center justify-between border-t border-border">
                      <div className="text-xs text-muted-foreground">
                        <div>
                          {tr("Est. requêtes", "Est. requests")}
                          <span
                            className={`font-mono font-bold ml-1.5 tabular-nums ${
                              overCap ? "text-destructive" : "text-foreground"
                            }`}
                          >
                            {estimatedRequests}
                          </span>
                          {cap > 0 && (
                            <span className="text-muted-foreground/70">
                              {" "}
                              / {cap} {tr("max", "max")}
                            </span>
                          )}
                        </div>
                        {dryRun && (
                          <div className="flex items-center gap-1 text-primary mt-1">
                            <ShieldCheck className="w-3 h-3" />
                            {tr("Simulation — aucun crédit utilisé", "Simulation — no credits used")}
                          </div>
                        )}
                      </div>
                      <Button
                        type="submit"
                        disabled={
                          createRun.isPending ||
                          selectedModels.length === 0 ||
                          overCap ||
                          activeRun != null
                        }
                      >
                        {createRun.isPending ? (
                          tr("Lancement...", "Launching...")
                        ) : (
                          <>
                            <Lock className="w-3.5 h-3.5 mr-2" /> {tr("Lancer", "Launch")}
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
                <span className="text-primary">§02</span> {tr("Gestion", "Management")}
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">
                {tr("Gérer les analyses", "Manage analyses")}
              </h2>
              <p className="text-muted-foreground mt-2 text-[15px] max-w-2xl">
                {tr(
                  "Survolez un run pour le supprimer, ou cliquez pour ouvrir son tableau de bord.",
                  "Hover over a run to delete it, or click to open its dashboard.",
                )}
              </p>
            </div>
            <RunHistory
              featured={false}
              onDelete={handleDelete}
              emptyHint={tr(
                "Lancez une première évaluation ci-dessus.",
                "Launch a first evaluation above.",
              )}
            />
          </section>
        )}
      </div>

      <AlertDialog
        open={pendingValues != null}
        onOpenChange={(open) => {
          if (!open) setPendingValues(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingValues?.dryRun
                ? tr("Lancer une simulation ?", "Launch a simulation?")
                : tr("Confirmer le lancement ?", "Confirm launch?")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                {pendingValues?.dryRun ? (
                  <p>
                    {tr(
                      "Mode simulation : aucun appel API réel, aucun crédit consommé.",
                      "Simulation mode: no real API calls, no credits consumed.",
                    )}
                  </p>
                ) : (
                  <>
                    <p>
                      {tr(
                        "Cette analyse va effectuer de vrais appels API et consommer des crédits.",
                        "This analysis will make real API calls and consume credits.",
                      )}
                    </p>
                    <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm space-y-1">
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          {tr("Modèles", "Models")}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {pendingValues?.models.length}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4">
                        <span className="text-muted-foreground">
                          {tr("Questions", "Questions")}
                        </span>
                        <span className="font-mono font-medium text-foreground">
                          {plannedQuestions}
                        </span>
                      </div>
                      <div className="flex justify-between gap-4 pt-1 border-t border-border">
                        <span className="text-muted-foreground">
                          {tr("Requêtes API estimées", "Estimated API requests")}
                        </span>
                        <span className="font-mono font-semibold text-foreground tabular-nums">
                          ~{estimatedRequests}
                        </span>
                      </div>
                      {judged && (
                        <p className="text-xs text-muted-foreground pt-1">
                          {tr(
                            "Inclut les appels de réponse et de notation par le juge.",
                            "Includes both answer and judge-scoring calls.",
                          )}
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tr("Annuler", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingValues) doLaunch(pendingValues);
                setPendingValues(null);
              }}
            >
              {pendingValues?.dryRun
                ? tr("Lancer la simulation", "Run simulation")
                : tr("Oui, lancer", "Yes, launch")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
