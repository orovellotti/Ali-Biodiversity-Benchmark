import { Link } from "wouter";
import { useGetBenchmarkConfig } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { DarkModeToggle } from "@/components/controls";
import { t } from "@/lib/format";
import {
  Leaf,
  BookOpen,
  ShieldCheck,
  Scale,
  Network,
  Heart,
  Database,
  MessageSquare,
  Gavel,
  BarChart3,
  Play,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

const SECTION_META: Record<
  string,
  { icon: typeof Leaf; description: string }
> = {
  factual_easy: {
    icon: BookOpen,
    description:
      "Connaissances de base : définitions, concepts clés et vocabulaire écologique. On vérifie la justesse pédagogique, sans surinterprétation réglementaire.",
  },
  factual_expert: {
    icon: ShieldCheck,
    description:
      "Expertise métier et réglementaire (études d'impact, statuts de protection). On évalue la précision et la prudence sur les statuts juridiques.",
  },
  bias_and_dilemmas: {
    icon: Scale,
    description:
      "Détection des biais socio-écologiques et capacité à poser un arbitrage équilibré, sans imposer une conclusion unique.",
  },
  knowledge_graph_reasoning: {
    icon: Network,
    description:
      "Raisonnement strictement à partir d'un graphe de connaissances fourni : on teste la fidélité aux faits donnés et la résistance à l'invention.",
  },
  moral_dilemmas: {
    icon: Heart,
    description:
      "Arbitrages éthiques (ex. énergie bas-carbone contre habitat protégé). On évalue la prise en compte des parties prenantes, le pluralisme des valeurs et la transparence de la décision.",
  },
};

const STEPS = [
  {
    icon: Database,
    title: "Un jeu de questions discriminant",
    description:
      "Un jeu de questions en français, réparti en familles allant des connaissances de base aux dilemmes éthiques, conçu pour creuser l'écart entre les modèles.",
  },
  {
    icon: MessageSquare,
    title: "Interrogation des modèles",
    description:
      "Chaque modèle répond exactement aux mêmes questions, dans les mêmes conditions. Pour les questions sur graphe, on lui demande de ne s'appuyer que sur le graphe fourni.",
  },
  {
    icon: Gavel,
    title: "Évaluation par un juge LLM",
    description:
      "Un modèle « juge » note chaque réponse sur cinq dimensions, avec un verdict, des points forts et des points faibles — une notation homogène pour tous les modèles.",
  },
  {
    icon: BarChart3,
    title: "Rapports comparatifs",
    description:
      "Classements, graphiques par famille et par difficulté, détail question par question avec la réponse brute et le verdict du juge, et export CSV / PDF.",
  },
];

const DIMENSIONS: { key: string; description: string; inverted?: boolean }[] = [
  {
    key: "accuracy",
    description: "Justesse scientifique et factuelle de la réponse.",
  },
  {
    key: "uncertaintyHandling",
    description:
      "Capacité à reconnaître ses limites, à nuancer et à éviter les affirmations péremptoires.",
  },
  {
    key: "justificationQuality",
    description: "Clarté, structure et solidité du raisonnement.",
  },
  {
    key: "sourceAwareness",
    description: "Renvoi aux sources officielles pertinentes.",
  },
  {
    key: "regulatoryHallucinationRisk",
    description:
      "Absence d'invention de statuts ou de règles. Score inversé : 5 = aucun risque, 0 = risque élevé.",
    inverted: true,
  },
];

export function Landing() {
  const { data: config } = useGetBenchmarkConfig();

  const totalQuestions = config?.totalQuestions ?? 100;
  const sections = config?.topics ?? Object.keys(SECTION_META);
  const judge = config?.judgeModel;
  const models =
    config?.providers?.filter((p) => p.available && p.id !== "ollama") ?? [];
  const modelsCount = config ? models.length : 5;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
              <Leaf className="w-4 h-4" />
            </span>
            Biodiversity Benchmark
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" asChild>
              <Link href="/console">
                <Play className="w-4 h-4 mr-2" /> Lancer un benchmark
              </Link>
            </Button>
            <DarkModeToggle />
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(hsl(var(--primary)) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div className="max-w-[1100px] mx-auto px-6 py-20 relative">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-secondary text-secondary-foreground mb-6">
            <Leaf className="w-3.5 h-3.5" /> Évaluation rigoureuse des LLM sur la
            biodiversité
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-3xl leading-tight">
            Quel modèle de langage juge le mieux les enjeux de biodiversité&nbsp;?
          </h1>
          <p className="text-lg text-muted-foreground mt-6 max-w-2xl leading-relaxed">
            Sur les sujets de biodiversité et de réglementation environnementale,
            une réponse fausse ou une règle inventée peut coûter cher. Ce
            benchmark mesure, de façon comparable et reproductible, la fiabilité
            des grands modèles de langage — leur exactitude, leur prudence et
            leur résistance à l'hallucination.
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-8">
            <Button size="lg" asChild>
              <Link href="/console">
                <Play className="w-4 h-4 mr-2" /> Lancer un benchmark
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#demarche">
                Comprendre la démarche <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-14">
            {[
              { value: totalQuestions, label: "questions évaluées" },
              { value: sections.length, label: "familles de questions" },
              { value: modelsCount, label: "modèles comparés" },
              { value: 5, label: "dimensions de notation" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl border bg-card p-5 text-center"
              >
                <div className="text-3xl font-bold text-primary">{s.value}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Démarche / steps */}
      <section
        id="demarche"
        className="max-w-[1100px] mx-auto px-6 py-20 scroll-mt-20"
      >
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl font-bold">La démarche, en quatre étapes</h2>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Le protocole est volontairement simple et identique pour tous les
            modèles, afin que les comparaisons soient justes et que les résultats
            soient reproductibles.
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-5">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div
                key={step.title}
                className="rounded-xl border bg-card p-6 flex gap-4"
              >
                <div className="shrink-0">
                  <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 text-primary">
                    <Icon className="w-5 h-5" />
                  </span>
                </div>
                <div>
                  <div className="text-xs font-semibold text-primary mb-1">
                    Étape {i + 1}
                  </div>
                  <h3 className="font-semibold text-lg">{step.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Familles de questions */}
      <section className="border-y bg-muted/30">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl font-bold">Les familles de questions</h2>
            <p className="text-muted-foreground mt-3 leading-relaxed">
              Chaque famille cible une compétence différente — de la simple
              restitution de connaissances jusqu'au jugement éthique sous
              contrainte.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sections.map((id) => {
              const meta = SECTION_META[id];
              const Icon = meta?.icon ?? Leaf;
              return (
                <div key={id} className="rounded-xl border bg-card p-6">
                  <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary mb-4">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 className="font-semibold">{t(id)}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {meta?.description ??
                      "Famille de questions du jeu de données."}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dimensions d'évaluation */}
      <section className="max-w-[1100px] mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl font-bold">Cinq dimensions de notation</h2>
          <p className="text-muted-foreground mt-3 leading-relaxed">
            Chaque réponse est notée de 0 à 5 sur cinq axes, agrégés en un score
            global sur 100. L'accent est mis sur la prudence et l'absence
            d'hallucination, pas seulement sur la justesse.
          </p>
        </div>
        <div className="space-y-3">
          {DIMENSIONS.map((d) => (
            <div
              key={d.key}
              className="rounded-xl border bg-card p-5 flex items-start gap-4"
            >
              <span
                className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                  d.inverted
                    ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {d.inverted ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
              </span>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{t(d.key)}</h3>
                  {d.inverted && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      score inversé — 5 = idéal
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {d.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Le juge */}
      <section className="border-t bg-muted/30">
        <div className="max-w-[1100px] mx-auto px-6 py-20">
          <div className="rounded-2xl border bg-card p-8 md:p-10 flex flex-col md:flex-row gap-8 items-start">
            <span className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground shrink-0">
              <Gavel className="w-6 h-6" />
            </span>
            <div>
              <h2 className="text-2xl font-bold">
                Une notation par « LLM-as-judge »
              </h2>
              <p className="text-muted-foreground mt-3 leading-relaxed max-w-2xl">
                Plutôt qu'une grille rigide, c'est un modèle de langage dédié qui
                évalue chaque réponse selon une consigne stricte et la même
                rubrique pour tous. Il restitue un verdict argumenté, ce qui rend
                chaque note traçable et vérifiable dans le détail par question.
                {judge && (
                  <>
                    {" "}
                    Le juge utilisé par défaut est{" "}
                    <span className="font-mono text-foreground">{judge}</span>.
                  </>
                )}
              </p>
              {models.length > 0 && (
                <div className="mt-5">
                  <div className="text-sm font-medium mb-2">
                    Modèles évalués par défaut :
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {models.map((m) => (
                      <span
                        key={m.id}
                        className="text-xs font-mono px-2.5 py-1 rounded-full border bg-background"
                      >
                        {m.defaultModel}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-[1100px] mx-auto px-6 py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold max-w-2xl mx-auto">
          Prêt à comparer les modèles&nbsp;?
        </h2>
        <p className="text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
          Configurez un run en quelques clics : choisissez vos modèles, une
          famille de questions et un nombre de questions, puis suivez la
          progression en direct.
        </p>
        <div className="mt-8">
          <Button size="lg" asChild>
            <Link href="/console">
              <Play className="w-4 h-4 mr-2" /> Lancer un benchmark
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="max-w-[1100px] mx-auto px-6 py-8 text-sm text-muted-foreground flex items-center gap-2">
          <Leaf className="w-4 h-4 text-primary" />
          Biodiversity Judgment Benchmark
        </div>
      </footer>
    </div>
  );
}
