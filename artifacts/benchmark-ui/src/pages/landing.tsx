import { useMemo } from "react";
import { Link } from "wouter";
import { useGetBenchmarkConfig } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { useI18n } from "@/lib/i18n";
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
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

function SectionLabel({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="eyebrow mb-4">
      <span className="text-primary">§{n}</span>
      <span className="w-8 h-px bg-border" />
      {children}
    </div>
  );
}

export function Landing() {
  const { tr, t } = useI18n();
  const { data: config } = useGetBenchmarkConfig();

  const SECTION_META = useMemo<
    Record<string, { icon: typeof Leaf; description: string }>
  >(
    () => ({
      factual_easy: {
        icon: BookOpen,
        description: tr(
          "Connaissances de base : définitions, concepts clés et vocabulaire écologique. On vérifie la justesse pédagogique, sans surinterprétation réglementaire.",
          "Foundational knowledge: definitions, key concepts and ecological vocabulary. We check educational accuracy, without over-interpreting regulations.",
        ),
      },
      factual_expert: {
        icon: ShieldCheck,
        description: tr(
          "Expertise métier et réglementaire (études d'impact, statuts de protection). On évalue la précision et la prudence sur les statuts juridiques.",
          "Professional and regulatory expertise (impact assessments, protection statuses). We assess precision and caution on legal statuses.",
        ),
      },
      bias_and_dilemmas: {
        icon: Scale,
        description: tr(
          "Détection des biais socio-écologiques et capacité à poser un arbitrage équilibré, sans imposer une conclusion unique.",
          "Detecting socio-ecological biases and the ability to strike a balanced trade-off, without imposing a single conclusion.",
        ),
      },
      knowledge_graph_reasoning: {
        icon: Network,
        description: tr(
          "Raisonnement strictement à partir d'un graphe de connaissances fourni : on teste la fidélité aux faits donnés et la résistance à l'invention.",
          "Reasoning strictly from a provided knowledge graph: we test fidelity to the given facts and resistance to fabrication.",
        ),
      },
      moral_dilemmas: {
        icon: Heart,
        description: tr(
          "Arbitrages éthiques (ex. énergie bas-carbone contre habitat protégé). On évalue la prise en compte des parties prenantes, le pluralisme des valeurs et la transparence de la décision.",
          "Ethical trade-offs (e.g. low-carbon energy versus protected habitat). We assess the consideration of stakeholders, the plurality of values and the transparency of the decision.",
        ),
      },
    }),
    [tr],
  );

  const STEPS = useMemo(
    () => [
      {
        icon: Database,
        title: tr("Un jeu de questions discriminant", "A discriminating question set"),
        description: tr(
          "Un jeu de questions en français, réparti en familles allant des connaissances de base aux dilemmes éthiques, conçu pour creuser l'écart entre les modèles.",
          "A set of questions in French, split into families ranging from foundational knowledge to ethical dilemmas, designed to widen the gap between models.",
        ),
      },
      {
        icon: MessageSquare,
        title: tr("Interrogation des modèles", "Querying the models"),
        description: tr(
          "Chaque modèle répond exactement aux mêmes questions, dans les mêmes conditions. Pour les questions sur graphe, on lui demande de ne s'appuyer que sur le graphe fourni.",
          "Each model answers exactly the same questions, under the same conditions. For graph questions, it is asked to rely solely on the provided graph.",
        ),
      },
      {
        icon: Gavel,
        title: tr("Évaluation par un juge LLM", "Evaluation by an LLM judge"),
        description: tr(
          "Un modèle « juge » note chaque réponse sur cinq dimensions, avec un verdict, des points forts et des points faibles — une notation homogène pour tous les modèles.",
          "A “judge” model scores each answer across five dimensions, with a verdict, strengths and weaknesses — consistent scoring for every model.",
        ),
      },
      {
        icon: BarChart3,
        title: tr("Rapports comparatifs", "Comparative reports"),
        description: tr(
          "Classements, graphiques par famille et par difficulté, détail question par question avec la réponse brute et le verdict du juge, et export CSV / PDF.",
          "Rankings, charts by family and difficulty, question-by-question detail with the raw answer and the judge's verdict, and CSV / PDF export.",
        ),
      },
    ],
    [tr],
  );

  const DIMENSIONS = useMemo<
    { key: string; description: string; inverted?: boolean }[]
  >(
    () => [
      {
        key: "accuracy",
        description: tr(
          "Justesse scientifique et factuelle de la réponse.",
          "Scientific and factual accuracy of the answer.",
        ),
      },
      {
        key: "uncertaintyHandling",
        description: tr(
          "Capacité à reconnaître ses limites, à nuancer et à éviter les affirmations péremptoires.",
          "The ability to acknowledge its limits, to qualify statements and to avoid peremptory claims.",
        ),
      },
      {
        key: "justificationQuality",
        description: tr(
          "Clarté, structure et solidité du raisonnement.",
          "Clarity, structure and soundness of the reasoning.",
        ),
      },
      {
        key: "sourceAwareness",
        description: tr(
          "Renvoi aux sources officielles pertinentes.",
          "References to relevant official sources.",
        ),
      },
      {
        key: "regulatoryHallucinationRisk",
        description: tr(
          "Absence d'invention de statuts ou de règles. Score inversé : 5 = aucun risque, 0 = risque élevé.",
          "No fabrication of statuses or rules. Inverted score: 5 = no risk, 0 = high risk.",
        ),
        inverted: true,
      },
    ],
    [tr],
  );

  const totalQuestions = config?.totalQuestions ?? 100;
  const sections = config?.topics ?? Object.keys(SECTION_META);
  const judge = config?.judgeModel;
  const models =
    config?.providers?.filter((p) => p.available && p.id !== "ollama") ?? [];
  const modelsCount = config ? models.length : 5;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader maxWidth="max-w-[1180px]">
        <Button size="sm" asChild>
          <Link href="/resultats">
            <BarChart3 className="w-4 h-4 mr-2" /> {tr("Voir les résultats", "View the results")}
          </Link>
        </Button>
      </SiteHeader>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 paper-grid opacity-70 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background pointer-events-none" />
        <div className="max-w-[1180px] mx-auto px-6 py-20 md:py-28 relative">
          <div className="eyebrow mb-6">
            <Leaf className="w-3.5 h-3.5 text-primary" />
            {tr(
              "Évaluation rigoureuse des LLM · biodiversité",
              "Rigorous evaluation of LLMs · biodiversity",
            )}
          </div>
          <h1 className="font-display text-[2.7rem] md:text-6xl font-semibold tracking-[-0.02em] max-w-4xl leading-[1.05]">
            {tr(
              "Quel modèle de langage juge le mieux les enjeux de",
              "Which language model best judges the challenges of",
            )}{" "}
            <span className="italic text-primary">
              {tr("biodiversité", "biodiversity")}
            </span>
            {tr(" ?", "?")}
          </h1>
          <p className="text-lg text-muted-foreground mt-7 max-w-2xl leading-relaxed">
            {tr(
              "Sur les sujets de biodiversité et de réglementation environnementale, une réponse fausse ou une règle inventée peut coûter cher. Ce carnet de terrain mesure, de façon comparable et reproductible, la fiabilité des grands modèles de langage — leur exactitude, leur prudence et leur résistance à l'hallucination.",
              "On topics of biodiversity and environmental regulation, a wrong answer or a made-up rule can be costly. This field notebook measures, in a comparable and reproducible way, the reliability of large language models — their accuracy, their caution and their resistance to hallucination.",
            )}
          </p>
          <p className="text-base text-muted-foreground/90 mt-5 max-w-2xl leading-relaxed">
            {tr(
              "Au fond, une seule question : peut-on aligner l'IA sur les besoins des non-humains ? Évaluer comment les modèles traitent le vivant, c'est un premier pas pour qu'ils servent aussi les espèces et les écosystèmes qui n'ont pas voix au chapitre.",
              "At its core, a single question: can we align AI with the needs of non-humans? Measuring how models treat the living world is a first step toward making them serve the species and ecosystems that have no voice of their own.",
            )}
          </p>
          <div className="flex flex-wrap items-center gap-3 mt-9">
            <Button size="lg" asChild>
              <Link href="/resultats">
                <BarChart3 className="w-4 h-4 mr-2" /> {tr("Voir les résultats", "View the results")}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/questions">
                <BookOpen className="w-4 h-4 mr-2" /> {tr("Voir les questions", "View the questions")}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#demarche">
                {tr("Comprendre la démarche", "Understand the approach")} <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>

          {/* Stats — instrument readouts */}
          <div className="grid grid-cols-2 md:grid-cols-4 mt-16 border border-border rounded-xl bg-card/60 backdrop-blur-sm overflow-hidden divide-x divide-y md:divide-y-0 divide-border">
            {[
              { value: totalQuestions, label: tr("questions évaluées", "questions evaluated") },
              { value: sections.length, label: tr("familles de questions", "question families") },
              { value: modelsCount, label: tr("modèles comparés", "models compared") },
              { value: 5, label: tr("dimensions de notation", "scoring dimensions") },
            ].map((s, i) => (
              <div key={s.label} className="p-6">
                <div className="index-tag mb-2">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="font-display text-4xl font-semibold text-primary tabular-nums">
                  {s.value}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* §01 Démarche */}
      <section id="demarche" className="max-w-[1180px] mx-auto px-6 py-20 scroll-mt-20">
        <div className="max-w-2xl mb-12">
          <SectionLabel n="01">{tr("La démarche", "The approach")}</SectionLabel>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
            {tr("Un protocole simple, identique pour tous", "A simple protocol, identical for all")}
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            {tr(
              "Quatre étapes volontairement transparentes, pour que les comparaisons soient justes et que les résultats soient reproductibles.",
              "Four deliberately transparent steps, so that comparisons are fair and results are reproducible.",
            )}
          </p>
        </div>
        <div className="grid md:grid-cols-2 gap-px bg-border border border-border rounded-xl overflow-hidden">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <div key={step.title} className="bg-card p-7 flex gap-5">
                <div className="shrink-0">
                  <span className="flex items-center justify-center w-11 h-11 rounded-lg bg-primary/10 text-primary">
                    <Icon className="w-5 h-5" />
                  </span>
                </div>
                <div>
                  <div className="index-tag mb-1.5">
                    {tr("Étape", "Step")} {String(i + 1).padStart(2, "0")}
                  </div>
                  <h3 className="font-display font-semibold text-xl">
                    {step.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* §02 Familles de questions */}
      <section className="border-y border-border bg-secondary/30">
        <div className="max-w-[1180px] mx-auto px-6 py-20">
          <div className="max-w-2xl mb-12">
            <SectionLabel n="02">{tr("Le jeu de questions", "The question set")}</SectionLabel>
            <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              {tr("Les familles de questions", "The question families")}
            </h2>
            <p className="text-muted-foreground mt-4 leading-relaxed">
              {tr(
                "Chaque famille cible une compétence différente — de la simple restitution de connaissances jusqu'au jugement éthique sous contrainte.",
                "Each family targets a different skill — from the simple recall of knowledge to ethical judgment under constraint.",
              )}
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {sections.map((id, i) => {
              const meta = SECTION_META[id];
              const Icon = meta?.icon ?? Leaf;
              return (
                <div
                  key={id}
                  className="rounded-xl border border-card-border bg-card p-6 hairline-top relative"
                >
                  <span className="index-tag absolute top-5 right-5">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary mb-4">
                    <Icon className="w-5 h-5" />
                  </span>
                  <h3 className="font-display font-semibold text-lg">{t(id)}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {meta?.description ??
                      tr("Famille de questions du jeu de données.", "Question family from the dataset.")}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* §03 Dimensions */}
      <section className="max-w-[1180px] mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <SectionLabel n="03">{tr("La notation", "The scoring")}</SectionLabel>
          <h2 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
            {tr("Cinq dimensions, sur 100", "Five dimensions, out of 100")}
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            {tr(
              "Chaque réponse est notée de 0 à 5 sur cinq axes, agrégés en un score global sur 100. L'accent est mis sur la prudence et l'absence d'hallucination, pas seulement sur la justesse.",
              "Each answer is scored from 0 to 5 on five axes, aggregated into an overall score out of 100. The emphasis is on caution and the absence of hallucination, not only on accuracy.",
            )}
          </p>
        </div>
        <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
          {DIMENSIONS.map((d, i) => (
            <div
              key={d.key}
              className="bg-card p-5 flex items-start gap-4 hover:bg-secondary/30 transition-colors"
            >
              <span className="index-tag pt-1 w-8 shrink-0">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span
                className={`flex items-center justify-center w-9 h-9 rounded-lg shrink-0 ${
                  d.inverted
                    ? "bg-ochre/15 text-ochre"
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
                  <h3 className="font-display font-semibold text-lg">{t(d.key)}</h3>
                  {d.inverted && (
                    <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-ochre/15 text-ochre">
                      {tr("score inversé — 5 = idéal", "inverted score — 5 = ideal")}
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

      {/* §04 Le juge */}
      <section className="border-t border-border bg-secondary/30">
        <div className="max-w-[1180px] mx-auto px-6 py-20">
          <SectionLabel n="04">{tr("L'examen", "The assessment")}</SectionLabel>
          <div className="rounded-2xl border border-card-border bg-card p-8 md:p-10 flex flex-col md:flex-row gap-8 items-start">
            <span className="flex items-center justify-center w-14 h-14 rounded-xl bg-primary text-primary-foreground shrink-0">
              <Gavel className="w-6 h-6" />
            </span>
            <div>
              <h2 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                {tr("Une notation par « LLM-as-judge »", "Scoring with “LLM-as-judge”")}
              </h2>
              <p className="text-muted-foreground mt-3 leading-relaxed max-w-2xl">
                {tr(
                  "Plutôt qu'une grille rigide, c'est un modèle de langage dédié qui évalue chaque réponse selon une consigne stricte et la même rubrique pour tous. Il restitue un verdict argumenté, ce qui rend chaque note traçable et vérifiable dans le détail par question.",
                  "Rather than a rigid grid, a dedicated language model evaluates each answer following a strict prompt and the same rubric for all. It returns a reasoned verdict, making each score traceable and verifiable in detail, question by question.",
                )}
                {judge && (
                  <>
                    {" "}
                    {tr("Le juge utilisé par défaut est", "The default judge is")}{" "}
                    <span className="font-mono text-foreground">{judge}</span>.
                  </>
                )}
              </p>
              {models.length > 0 && (
                <div className="mt-6">
                  <div className="eyebrow mb-3">{tr("Modèles évalués par défaut", "Models evaluated by default")}</div>
                  <div className="flex flex-wrap gap-2">
                    {models.map((m) => (
                      <span
                        key={m.id}
                        className="text-xs font-mono px-2.5 py-1 rounded-full border border-border bg-background"
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
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 paper-grid opacity-60 pointer-events-none" />
        <div className="max-w-[1180px] mx-auto px-6 py-24 text-center relative">
          <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight max-w-2xl mx-auto leading-tight">
            {tr("Prêt à comparer les modèles ?", "Ready to compare the models?")}
          </h2>
          <p className="text-muted-foreground mt-5 max-w-xl mx-auto leading-relaxed">
            {tr(
              "Explorez les classements des modèles, les graphiques comparatifs par famille et difficulté, et le détail des réponses question par question.",
              "Explore the model rankings, the comparative charts by family and difficulty, and the answer details question by question.",
            )}
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/resultats">
                <BarChart3 className="w-4 h-4 mr-2" /> {tr("Voir les résultats", "View the results")}
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/questions">
                <BookOpen className="w-4 h-4 mr-2" /> {tr("Voir les questions", "View the questions")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="max-w-[1180px] mx-auto px-6 py-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Leaf className="w-4 h-4 text-primary" />
            ALI Biodiversity Benchmark
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://www.natural-solutions.eu"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:text-primary transition-colors underline-offset-4 hover:underline"
            >
              Natural Solutions
            </a>
            <div className="eyebrow">{tr("carnet de terrain", "field notebook")} · {totalQuestions} questions</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
