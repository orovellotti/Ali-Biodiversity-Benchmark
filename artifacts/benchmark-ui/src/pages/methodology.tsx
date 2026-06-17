import { useMemo } from "react";
import { Link } from "wouter";
import { useGetBenchmarkConfig } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/site-header";
import { useI18n } from "@/lib/i18n";
import {
  FileText,
  BarChart3,
  Download,
  Github,
  ExternalLink,
} from "lucide-react";

function Cite({ ids }: { ids: number[] }) {
  return (
    <sup className="ml-0.5 font-mono text-[0.7em] text-primary">
      [
      {ids.map((n, i) => (
        <span key={n}>
          {i > 0 && ", "}
          <a href={`#ref-${n}`} className="hover:underline">
            {n}
          </a>
        </span>
      ))}
      ]
    </sup>
  );
}

function PaperSection({
  n,
  title,
  children,
}: {
  n: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 scroll-mt-24" id={`sec-${n}`}>
      <h2 className="font-display text-2xl md:text-[1.75rem] font-semibold tracking-tight flex items-baseline gap-3">
        <span className="font-mono text-base text-primary tabular-nums">
          {n}.
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[15px] leading-[1.75] text-foreground/90">
        {children}
      </div>
    </section>
  );
}

export function Methodology() {
  const { tr, t } = useI18n();
  const { data: config } = useGetBenchmarkConfig();

  const totalQuestions = config?.totalQuestions ?? 100;
  const families = config?.topics ?? [];
  const models =
    config?.providers?.filter((p) => p.available && p.id !== "ollama") ?? [];
  const modelsCount = config ? models.length : 5;
  const judgeList = (config?.judgeModel ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const criteria = useMemo(
    () => [
      {
        key: "accuracy",
        desc: tr(
          "Justesse scientifique et factuelle de la réponse.",
          "Scientific and factual accuracy of the answer.",
        ),
      },
      {
        key: "uncertaintyHandling",
        desc: tr(
          "Reconnaissance des limites, nuances et absence d'affirmations péremptoires.",
          "Acknowledgement of limits, nuance, and absence of peremptory claims.",
        ),
      },
      {
        key: "justificationQuality",
        desc: tr(
          "Clarté, structure et solidité du raisonnement.",
          "Clarity, structure and soundness of the reasoning.",
        ),
      },
      {
        key: "sourceAwareness",
        desc: tr(
          "Renvoi aux sources officielles pertinentes.",
          "References to relevant official sources.",
        ),
      },
      {
        key: "regulatoryHallucinationRisk",
        desc: tr(
          "Absence d'invention de statuts ou de règles. Score inversé : 5 = aucun risque.",
          "No fabrication of statuses or rules. Inverted score: 5 = no risk.",
        ),
        inverted: true,
      },
    ],
    [tr],
  );

  const references = useMemo(
    () => [
      {
        cite: "Zheng, L., Chiang, W.-L., Sheng, Y., et al. (2023). Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena. NeurIPS 2023, Datasets and Benchmarks Track.",
        url: "https://arxiv.org/abs/2306.05685",
      },
      {
        cite: "Chiang, W.-L., Zheng, L., Sheng, Y., et al. (2024). Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference. ICML 2024.",
        url: "https://arxiv.org/abs/2403.04132",
      },
      {
        cite: "Elo, A. E. (1978). The Rating of Chessplayers, Past and Present. Arco Publishing, New York.",
        url: "",
      },
      {
        cite: "Ji, Z., Lee, N., Frieske, R., et al. (2023). Survey of Hallucination in Natural Language Generation. ACM Computing Surveys, 55(12), 1–38.",
        url: "https://arxiv.org/abs/2202.03629",
      },
      {
        cite: "Liang, P., Bommasani, R., Lee, T., et al. (2023). Holistic Evaluation of Language Models (HELM). Transactions on Machine Learning Research.",
        url: "https://arxiv.org/abs/2211.09110",
      },
      {
        cite: "Hendrycks, D., Burns, C., Basart, S., et al. (2021). Measuring Massive Multitask Language Understanding (MMLU). ICLR 2021.",
        url: "https://arxiv.org/abs/2009.03300",
      },
      {
        cite: "Bommasani, R., Hudson, D. A., Adeli, E., et al. (2021). On the Opportunities and Risks of Foundation Models. Center for Research on Foundation Models, Stanford.",
        url: "https://arxiv.org/abs/2108.07258",
      },
      {
        cite: "IPBES (2019). Global Assessment Report on Biodiversity and Ecosystem Services. Intergovernmental Science-Policy Platform on Biodiversity and Ecosystem Services, Bonn.",
        url: "https://doi.org/10.5281/zenodo.3831673",
      },
    ],
    [],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader maxWidth="max-w-[1100px]">
        <Button size="sm" asChild>
          <Link href="/resultats">
            <BarChart3 className="w-4 h-4 mr-2" />{" "}
            {tr("Voir les résultats", "View the results")}
          </Link>
        </Button>
      </SiteHeader>

      <main className="max-w-[760px] mx-auto px-6 py-14 md:py-20">
        {/* Masthead */}
        <div className="eyebrow mb-5">
          <FileText className="w-3.5 h-3.5 text-primary" />
          {tr(
            "Document de travail · méthodologie",
            "Working paper · methodology",
          )}
        </div>
        <h1 className="font-display text-[2.1rem] md:text-[2.75rem] font-semibold tracking-[-0.02em] leading-[1.1]">
          {tr(
            "Évaluer les grands modèles de langage sur le jugement en biodiversité",
            "Evaluating Large Language Models on Biodiversity Judgment",
          )}
        </h1>
        <p className="font-display text-lg md:text-xl text-muted-foreground mt-3 italic">
          {tr(
            "Un protocole comparable, en aveugle et reproductible, centré sur la prudence et le risque d'invention",
            "A comparable, blind and reproducible protocol centred on caution and fabrication risk",
          )}
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground border-y border-border py-4">
          <span className="font-medium text-foreground">
            ALI · Natural Solutions
          </span>
          <span>
            {tr("Carnet de terrain — édition", "Field notebook — edition")} 2026
          </span>
          <span className="inline-flex items-center gap-1.5 text-xs font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {tr("document vivant", "living document")}
          </span>
        </div>

        {/* Abstract */}
        <div className="mt-8 rounded-xl border border-card-border bg-card p-6 hairline-top">
          <div className="eyebrow mb-3">{tr("Résumé", "Abstract")}</div>
          <p className="text-[15px] leading-[1.75] text-foreground/90">
            {tr(
              `Sur les sujets de biodiversité et de réglementation environnementale, une réponse erronée — ou une règle inventée mais crédible — peut induire en erreur des décisions à fort enjeu. Nous présentons un banc d'essai qui mesure, de façon comparable et vérifiable, la fiabilité de ${modelsCount} grands modèles de langage (propriétaires et ouverts) sur un jeu de ${totalQuestions} questions de jugement en français, réparties en ${families.length} familles allant des connaissances de base aux dilemmes éthiques. Chaque modèle répond aux mêmes questions dans les mêmes conditions ; les réponses sont ensuite notées à l'aveugle par un panel d'IA juges de fournisseurs différents, sur cinq critères dont un score inversé de risque d'invention réglementaire. Nous complétons la notation automatique par une arène de duels à préférence (classement Elo) et par une évaluation humaine communautaire ouverte. Ce document décrit le protocole, les métriques, et les limites de validité.`,
              `On topics of biodiversity and environmental regulation, a wrong answer — or a fabricated yet credible rule — can mislead high-stakes decisions. We present a benchmark that measures, in a comparable and verifiable way, the reliability of ${modelsCount} large language models (proprietary and open) on a set of ${totalQuestions} French-language judgment questions, split into ${families.length} families ranging from foundational knowledge to ethical dilemmas. Each model answers the same questions under the same conditions; answers are then scored blind by a panel of judge AIs from different providers, on five criteria including an inverted regulatory-fabrication-risk score. We complement automatic scoring with a preference-based duel arena (Elo rating) and an open community human evaluation. This document describes the protocol, the metrics, and the threats to validity.`,
            )}
          </p>
        </div>

        {/* 1. Introduction */}
        <PaperSection n="1" title={tr("Introduction", "Introduction")}>
          <p>
            {tr(
              "Les grands modèles de langage sont de plus en plus consultés comme des sources d'expertise, y compris sur des sujets environnementaux où l'exactitude factuelle et la prudence réglementaire sont critiques.",
              "Large language models are increasingly consulted as sources of expertise, including on environmental topics where factual accuracy and regulatory caution are critical.",
            )}
            <Cite ids={[7]} />{" "}
            {tr(
              "Les bancs d'essai généralistes existants mesurent surtout des connaissances à choix multiples",
              "Existing general-purpose benchmarks mostly measure multiple-choice knowledge",
            )}
            <Cite ids={[5, 6]} />
            {tr(
              ", et capturent mal le jugement nuancé, la gestion de l'incertitude et la tendance à inventer des statuts juridiques. Notre objectif est étroit et appliqué : sur le domaine du vivant, quel modèle juge le mieux — et lequel invente le moins ?",
              ", and poorly capture nuanced judgment, uncertainty handling, and the tendency to fabricate legal statuses. Our goal is narrow and applied: in the domain of the living world, which model judges best — and which fabricates least?",
            )}
          </p>
          <p>
            {tr(
              "Au-delà de la performance, une question d'alignement sous-tend ce travail : peut-on évaluer la manière dont les modèles traitent des entités non-humaines — espèces et écosystèmes sans voix au chapitre ?",
              "Beyond performance, an alignment question underpins this work: can we assess how models treat non-human entities — species and ecosystems that have no voice of their own?",
            )}
            <Cite ids={[8]} />
          </p>
        </PaperSection>

        {/* 2. Dataset */}
        <PaperSection n="2" title={tr("Jeu de données", "Dataset")}>
          <p>
            {tr(
              `Le jeu de données contient ${totalQuestions} questions de jugement rédigées en français, organisées en ${families.length} familles. Chaque famille cible une compétence distincte. Les questions à base de faits fournissent une fiche de faits que le modèle est tenu de ne pas dépasser, ce qui permet d'isoler le raisonnement de la mémorisation.`,
              `The dataset contains ${totalQuestions} French-language judgment questions, organised into ${families.length} families. Each family targets a distinct skill. Fact-based questions provide a fact sheet the model is required not to exceed, which isolates reasoning from memorisation.`,
            )}
          </p>
          {families.length > 0 && (
            <ul className="grid sm:grid-cols-2 gap-2 not-prose mt-2">
              {families.map((f, i) => (
                <li
                  key={f}
                  className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm"
                >
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="font-medium">{t(f)}</span>
                </li>
              ))}
            </ul>
          )}
        </PaperSection>

        {/* 3. Protocol */}
        <PaperSection
          n="3"
          title={tr("Protocole d'interrogation", "Querying protocol")}
        >
          <p>
            {tr(
              "Chaque modèle reçoit exactement le même message pour une question donnée, sans exemples (zéro-shot), à température basse pour limiter la variance. Aucune réponse n'est régénérée a posteriori : les sorties brutes sont archivées telles quelles, horodatées, et réutilisées par les vues d'analyse sans nouvel appel aux modèles.",
              "Each model receives exactly the same prompt for a given question, with no examples (zero-shot), at low temperature to limit variance. No answer is regenerated after the fact: raw outputs are archived as-is, timestamped, and reused by the analysis views without any further model call.",
            )}
          </p>
          <p>
            {tr(
              "Le banc d'essai confronte des modèles propriétaires (accessibles seulement via leur fournisseur) à des modèles ouverts (vérifiables et auto-hébergeables), une distinction qui importe pour la transparence et l'autonomie d'une mission d'intérêt général.",
              "The benchmark pits proprietary models (accessible only through their provider) against open models (inspectable and self-hostable), a distinction that matters for the transparency and independence of a public-interest mission.",
            )}
            <Cite ids={[7]} />
          </p>
        </PaperSection>

        {/* 4. Judging */}
        <PaperSection
          n="4"
          title={tr(
            "Notation par un panel de juges",
            "Scoring by a panel of judges",
          )}
        >
          <p>
            {tr(
              "Nous adoptons le paradigme « LLM-as-a-judge »",
              "We adopt the “LLM-as-a-judge” paradigm",
            )}
            <Cite ids={[1]} />
            {tr(
              ", en atténuant ses biais connus (préférence de position, auto-complaisance) par trois garde-fous : (i) les réponses d'une même question sont mélangées et anonymisées (étiquettes A, B, C…) ; (ii) la notation est confiée à plusieurs juges de fournisseurs différents, et un juge ne note jamais un modèle de sa propre famille ; (iii) chaque juge applique la même grille et rend un verdict argumenté, donc vérifiable.",
              ", mitigating its known biases (position preference, self-enhancement) with three safeguards: (i) answers to a given question are shuffled and anonymised (labels A, B, C…); (ii) scoring is entrusted to several judges from different providers, and a judge never scores a model from its own family; (iii) each judge applies the same grid and returns a reasoned, therefore verifiable, verdict.",
            )}
          </p>
          <div className="mt-3 overflow-hidden rounded-xl border border-border not-prose">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/50 text-left">
                  <th className="font-mono text-xs uppercase tracking-wider text-muted-foreground px-4 py-2.5">
                    {tr("Critère (0–5)", "Criterion (0–5)")}
                  </th>
                  <th className="font-mono text-xs uppercase tracking-wider text-muted-foreground px-4 py-2.5">
                    {tr("Définition", "Definition")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {criteria.map((c) => (
                  <tr key={c.key} className="align-top">
                    <td className="px-4 py-3 font-medium whitespace-nowrap">
                      {t(c.key)}
                      {c.inverted && (
                        <span className="ml-2 text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-ochre/15 text-ochre align-middle">
                          {tr("inversé", "inverted")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            {tr(
              "L'accent mis sur le risque d'invention reflète une priorité du domaine : une hallucination réglementaire plausible est plus dangereuse qu'une simple imprécision.",
              "The emphasis on fabrication risk reflects a domain priority: a plausible regulatory hallucination is more dangerous than a mere imprecision.",
            )}
            <Cite ids={[4]} />
          </p>
        </PaperSection>

        {/* 5. Ranking & Arena */}
        <PaperSection
          n="5"
          title={tr(
            "Classement comparatif et arène Elo",
            "Comparative ranking and Elo arena",
          )}
        >
          <p>
            {tr(
              "En un seul passage par question, le juge classe les réponses (1 = meilleure) face à une réponse de référence ; le classement final repose sur le rang moyen, le score global sur 100 départageant les ex æquo. Pour croiser cette notation absolue avec une mesure de préférence relative, une arène propose des duels en aveugle entre deux réponses stockées ; les votes alimentent un classement Elo",
              "In a single pass per question, the judge ranks the answers (1 = best) against a reference answer; the final ranking is based on mean rank, with the overall score out of 100 breaking ties. To cross-check this absolute scoring with a relative-preference measure, an arena offers blind duels between two stored answers; votes feed an Elo rating",
            )}
            <Cite ids={[2, 3]} />
            {tr(
              " (initialisation 1000, K = 24), rejoué de façon déterministe à partir d'un journal de votes append-only.",
              " (initialised at 1000, K = 24), replayed deterministically from an append-only vote log.",
            )}
          </p>
        </PaperSection>

        {/* 6. Human evaluation */}
        <PaperSection
          n="6"
          title={tr(
            "Évaluation humaine communautaire",
            "Community human evaluation",
          )}
        >
          <p>
            {tr(
              "La notation automatique est faillible ; nous l'auditons par une évaluation humaine ouverte. N'importe qui peut lire une question tirée au hasard et la réponse de chaque modèle, puis la noter sur les cinq mêmes critères — cette fois avec les noms des modèles visibles. Les notes humaines sont agrégées en un classement parallèle, à confronter au verdict des juges IA. Concevoir l'évaluation comme un processus continu, multi-juges et partiellement humain, suit l'esprit des cadres d'évaluation holistique.",
              "Automatic scoring is fallible; we audit it with an open human evaluation. Anyone can read a randomly drawn question and each model's answer, then score it on the same five criteria — this time with model names visible. Human scores are aggregated into a parallel ranking, to set against the AI judges' verdict. Designing evaluation as a continuous, multi-judge and partly human process follows the spirit of holistic evaluation frameworks.",
            )}
            <Cite ids={[5]} />
          </p>
        </PaperSection>

        {/* 7. Limitations */}
        <PaperSection
          n="7"
          title={tr("Limites et menaces à la validité", "Limitations and threats to validity")}
        >
          <ul className="list-disc pl-5 space-y-2">
            <li>
              {tr(
                "Biais du juge : malgré l'anonymisation et le panel multi-fournisseurs, des biais résiduels (verbosité, style) peuvent subsister.",
                "Judge bias: despite anonymisation and the multi-provider panel, residual biases (verbosity, style) may remain.",
              )}
              <Cite ids={[1]} />
            </li>
            <li>
              {tr(
                "Couverture du domaine : les familles ciblent des types de raisonnement, non une cartographie exhaustive des domaines écologiques ; les résultats ne se généralisent pas au-delà de ce périmètre.",
                "Domain coverage: families target reasoning types, not an exhaustive map of ecological domains; results do not generalise beyond this scope.",
              )}
            </li>
            <li>
              {tr(
                "Langue : le jeu est rédigé en français ; les performances peuvent différer dans d'autres langues.",
                "Language: the set is written in French; performance may differ in other languages.",
              )}
            </li>
            <li>
              {tr(
                "Dérive des modèles : les versions hébergées évoluent ; un résultat est valable pour la version et la date archivées.",
                "Model drift: hosted versions evolve; a result holds for the archived version and date.",
              )}
            </li>
            <li>
              {tr(
                "Vote communautaire : l'évaluation humaine est anonyme et ouverte, donc sensible au déséquilibre d'échantillon ; elle complète, sans remplacer, la notation par panel.",
                "Community voting: human evaluation is anonymous and open, hence sensitive to sample imbalance; it complements, rather than replaces, panel scoring.",
              )}
            </li>
          </ul>
        </PaperSection>

        {/* 8. Reproducibility */}
        <PaperSection
          n="8"
          title={tr("Reproductibilité", "Reproducibility")}
        >
          <p>
            {tr(
              "Le jeu de questions, le moteur d'exécution, les invites de notation et les résultats bruts sont publics. Le code source est ouvert et les tableaux comme les graphiques sont exportables en CSV ; la page de résultats est imprimable en PDF.",
              "The question set, the execution engine, the scoring prompts and the raw results are public. The source code is open and tables and charts are exportable as CSV; the results page is printable to PDF.",
            )}
          </p>
          {(judgeList.length > 0 || models.length > 0) && (
            <div className="grid sm:grid-cols-2 gap-4 mt-3 not-prose">
              {models.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="eyebrow mb-2.5">
                    {tr("Modèles évalués", "Models evaluated")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {models.map((m) => (
                      <span
                        key={m.id}
                        className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-border bg-background"
                      >
                        {m.defaultModel}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {judgeList.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-4">
                  <div className="eyebrow mb-2.5">
                    {tr("Panel de juges", "Judge panel")}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {judgeList.map((j) => (
                      <span
                        key={j}
                        className="text-[11px] font-mono px-2 py-0.5 rounded-full border border-primary/30 bg-primary/5"
                      >
                        {j}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-3 mt-4 not-prose">
            <Button asChild>
              <Link href="/resultats">
                <BarChart3 className="w-4 h-4 mr-2" />{" "}
                {tr("Voir les résultats", "View the results")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a
                href="https://github.com/orovellotti/Ali-Biodiversity-Benchmark"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="w-4 h-4 mr-2" />{" "}
                {tr("Code source", "Source code")}
              </a>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Download className="w-4 h-4 mr-2" />{" "}
              {tr("Imprimer / PDF", "Print / PDF")}
            </Button>
          </div>
        </PaperSection>

        {/* References */}
        <section className="mt-14 scroll-mt-24" id="references">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {tr("Références", "References")}
          </h2>
          <ol className="mt-4 space-y-3 text-sm text-foreground/85">
            {references.map((r, i) => (
              <li
                key={i}
                id={`ref-${i + 1}`}
                className="flex gap-3 scroll-mt-24 leading-relaxed"
              >
                <span className="font-mono text-primary tabular-nums shrink-0">
                  [{i + 1}]
                </span>
                <span>
                  {r.cite}
                  {r.url && (
                    <>
                      {" "}
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline underline-offset-2 break-all"
                      >
                        {r.url.replace(/^https?:\/\//, "")}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <p className="mt-12 pt-6 border-t border-border text-xs text-muted-foreground font-mono">
          {tr(
            "ALI Biodiversity Benchmark · Natural Solutions — Cette page est un résumé méthodologique, non une publication évaluée par les pairs.",
            "ALI Biodiversity Benchmark · Natural Solutions — This page is a methodological summary, not a peer-reviewed publication.",
          )}
        </p>
      </main>
    </div>
  );
}
