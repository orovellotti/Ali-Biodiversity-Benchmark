import { useState, useMemo } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { useTranslateMap } from "@/lib/use-translate";
import { Run, RunResults } from "@workspace/api-client-react";
import { Download, CheckCircle2, AlertTriangle, Award, ShieldCheck, Compass, ChevronUp, ChevronDown, ChevronsUpDown, Loader2, Lock, Unlock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const CHART_COLORS = [
  "#2f6b4f", // forest green
  "#c98a2b", // ochre
  "#c2603b", // terracotta
  "#3f6b8f", // slate blue
  "#7a5a93", // plum
  "#5b8c6e", // sage
];

const SCORE_LABEL_KEYS = [
  "overallScore",
  "accuracy",
  "uncertaintyHandling",
  "justificationQuality",
  "sourceAwareness",
  "regulatoryHallucinationRisk",
] as const;

function exportToCSV(filename: string, data: any[], headers: string[]) {
  if (data.length === 0) return;
  
  const csvContent = [
    headers.join(","),
    ...data.map((row) => 
      headers.map((header) => {
        let value = row[header];
        if (value === null || value === undefined) value = "";
        if (typeof value === "string") {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(",")
    )
  ].join("\n");
  
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ResultsDashboard({ results, run }: { results: RunResults; run: Run }) {
  const { tr, t } = useI18n();

  // Translate the dataset/answer text shown to the user when EN is active
  // (questions, model responses, judge verdicts). No-op in FR; cached otherwise.
  const translatable = useMemo(() => {
    const out: string[] = [];
    for (const r of results.rows) {
      if (r.question) out.push(r.question);
      if (r.rawResponse) out.push(r.rawResponse);
      if (r.verdict) out.push(r.verdict);
      if (r.strengths) out.push(r.strengths);
      if (r.weaknesses) out.push(r.weaknesses);
    }
    return out;
  }, [results.rows]);
  const {
    tr: trText,
    failed: trFailed,
    loading: trLoading,
  } = useTranslateMap(translatable);

  // Plain-language descriptions of each scoring dimension, written for a
  // scientific (non-ML) audience. Each note is rated from 0 to 5.
  const DIMENSION_GLOSSARY: { label: string; description: string }[] = useMemo(
    () => [
      {
        label: tr("Exactitude", "Accuracy"),
        description: tr(
          "La réponse est-elle juste sur le fond, conforme aux connaissances écologiques et réglementaires ?",
          "Is the answer factually correct and consistent with ecological and regulatory knowledge?",
        ),
      },
      {
        label: tr("Gestion de l'incertitude", "Uncertainty handling"),
        description: tr(
          "Le modèle reconnaît-il ses limites et nuance-t-il quand la question est ambiguë, plutôt que d'affirmer à tort ?",
          "Does the model acknowledge its limits and add nuance when the question is ambiguous, rather than asserting incorrectly?",
        ),
      },
      {
        label: tr("Qualité de la justification", "Justification quality"),
        description: tr(
          "Le raisonnement est-il clair, structuré et explicité, ou la réponse tombe-t-elle sans explication ?",
          "Is the reasoning clear, structured and explicit, or does the answer come without any explanation?",
        ),
      },
      {
        label: tr("Conscience des sources", "Source awareness"),
        description: tr(
          "Le modèle s'appuie-t-il sur des références pertinentes (textes, protocoles) au lieu d'inventer ?",
          "Does the model rely on relevant references (texts, protocols) instead of making things up?",
        ),
      },
      {
        label: tr("Risque d'hallucination (5 = aucun)", "Hallucination risk (5 = none)"),
        description: tr(
          "Mesure inversée : une note élevée signifie que le modèle invente peu de faits ou de références. C'est le critère de prudence le plus important.",
          "Inverted measure: a high score means the model invents few facts or references. This is the most important caution criterion.",
        ),
      },
    ],
    [tr],
  );

  const isDark = document.documentElement.classList.contains("dark");
  const gridColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e5e5";
  const tickColor = isDark ? "#98999C" : "#71717a";

  const [searchTerm, setSearchTerm] = useState("");
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterTopic, setFilterTopic] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");

  const filteredRows = useMemo(() => {
    let res = results.rows;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      res = res.filter(r => 
        (r.question || "").toLowerCase().includes(lower) || 
        (r.rawResponse || "").toLowerCase().includes(lower) ||
        (r.questionId || "").toLowerCase().includes(lower)
      );
    }
    if (filterModel !== "all") res = res.filter(r => r.model === filterModel);
    if (filterTopic !== "all") res = res.filter(r => r.topic === filterTopic);
    if (filterDifficulty !== "all") res = res.filter(r => r.difficulty === filterDifficulty);
    return res;
  }, [results.rows, searchTerm, filterModel, filterTopic, filterDifficulty]);

  type SortKey =
    | "questionId"
    | "question"
    | "model"
    | "topic"
    | "overallScore"
    | "regulatoryHallucinationRisk";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sortHead = (label: string, key: SortKey, className?: string) => {
    const active = sortKey === key;
    return (
      <TableHead
        className={className}
        aria-sort={
          active ? (sortDir === "asc" ? "ascending" : "descending") : "none"
        }
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className="group inline-flex items-center gap-1 -ml-1 px-1 py-0.5 rounded hover:text-foreground transition-colors"
          aria-label={`${tr("Trier par", "Sort by")} ${label}${
            active
              ? sortDir === "asc"
                ? tr(", ordre croissant", ", ascending order")
                : tr(", ordre décroissant", ", descending order")
              : ""
          }`}
        >
          {label}
          {active ? (
            sortDir === "asc" ? (
              <ChevronUp className="w-3.5 h-3.5 text-primary" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-primary" />
            )
          ) : (
            <ChevronsUpDown className="w-3.5 h-3.5 opacity-40 group-hover:opacity-70" />
          )}
        </button>
      </TableHead>
    );
  };

  const sortedRows = useMemo(() => {
    if (!sortKey) return filteredRows;
    const dir = sortDir === "asc" ? 1 : -1;
    const isNumeric =
      sortKey === "overallScore" || sortKey === "regulatoryHallucinationRisk";
    return [...filteredRows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      // Always push empty/null values to the bottom regardless of direction.
      const aEmpty = av == null || av === "";
      const bEmpty = bv == null || bv === "";
      if (aEmpty && bEmpty) return 0;
      if (aEmpty) return 1;
      if (bEmpty) return -1;
      if (isNumeric) return ((av as number) - (bv as number)) * dir;
      return String(av).localeCompare(String(bv), "fr", { numeric: true }) * dir;
    });
  }, [filteredRows, sortKey, sortDir]);

  // Radar: one axis per scoring dimension, one polygon per model. Only models
  // that actually have scores are plotted (a fully-failed model would be empty).
  const RADAR_DIMS: { key: (typeof SCORE_LABEL_KEYS)[number]; label: string }[] = [
    { key: "accuracy", label: tr("Exactitude", "Accuracy") },
    { key: "uncertaintyHandling", label: tr("Incertitude", "Uncertainty") },
    { key: "justificationQuality", label: tr("Justification", "Justification") },
    { key: "sourceAwareness", label: tr("Sources", "Sources") },
    { key: "regulatoryHallucinationRisk", label: tr("Anti-hallucination", "Anti-hallucination") },
  ];
  const radarModels = useMemo(
    () => results.summaryByModel.filter((m) => m.overallScore != null),
    [results.summaryByModel],
  );
  const radarData = useMemo(
    () =>
      RADAR_DIMS.map((dim) => {
        const row: Record<string, string | number | null> = { dimension: dim.label };
        radarModels.forEach((m) => {
          row[m.model] = (m[dim.key as keyof typeof m] as number | null) ?? null;
        });
        return row;
      }),
    [radarModels, tr],
  );

  const uniqueTopics = useMemo(() => [...new Set(results.rows.map(r => r.topic).filter(Boolean) as string[])], [results.rows]);
  const uniqueDifficulties = useMemo(() => [...new Set(results.rows.map(r => r.difficulty).filter(Boolean) as string[])], [results.rows]);

  const showVerdict = !run.noEval && !run.dryRun && results.summaryByModel.length > 0;

  // How many models share each final rank, so ex æquo (ties) can be flagged.
  const rankCounts = useMemo(() => {
    const counts = new Map<number, number>();
    for (const m of results.summaryByModel) {
      if (m.rank != null) counts.set(m.rank, (counts.get(m.rank) ?? 0) + 1);
    }
    return counts;
  }, [results.summaryByModel]);

  // Best overall = first ranked model. Best at prudence = highest (inverted)
  // hallucination score, since that is the dimension an ecologist cares about
  // most when relying on the answers.
  const bestOverall = showVerdict ? results.summaryByModel[0] : null;
  const safestModel = useMemo(() => {
    if (!showVerdict) return null;
    return results.summaryByModel.reduce((best, m) =>
      (m.regulatoryHallucinationRisk ?? -1) > (best.regulatoryHallucinationRisk ?? -1) ? m : best
    );
  }, [results.summaryByModel, showVerdict]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    return (
      <div className="bg-background border rounded-md shadow-md p-3 text-sm">
        <div className="font-semibold mb-2">{label}</div>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium">
              {typeof entry.value === "number" ? entry.value.toFixed(2) : entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Reading guide & verdict — for a non-technical, scientific audience */}
      {showVerdict && bestOverall && (
        <Card className="hairline-top border-primary/40 bg-primary/[0.03]">
          <CardContent className="p-6">
            <div className="eyebrow mb-1.5 flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5" />
              {tr("Comment lire ces résultats", "How to read these results")}
            </div>
            <h2 className="font-display text-2xl font-semibold tracking-tight mb-3">
              {tr("Synthèse de l'évaluation", "Evaluation summary")}
            </h2>
            <p className="text-[15px] text-muted-foreground max-w-3xl leading-relaxed">
              {tr("Chaque modèle d'IA a répondu à un échantillon de questions du jeu de données « jugement biodiversité ». Un modèle juge indépendant a ensuite noté les réponses sur cinq critères, de 0 à 5. Le", "Each AI model answered a sample of questions from the “biodiversity judgment” dataset. An independent judge model then scored the answers on five criteria, from 0 to 5. The")}{" "}
              <strong className="text-foreground">{tr("score global", "overall score")}</strong> {tr("(sur 100) combine ces critères : plus il est élevé, plus le modèle est fiable. En matière d'écologie, l'essentiel n'est pas seulement d'avoir raison, mais de", "(out of 100) combines these criteria: the higher it is, the more reliable the model. In ecology, what matters is not only being right, but also")}{" "}
              <strong className="text-foreground">
                {tr("ne pas inventer", "not making things up")}
              </strong>{" "}
              {tr("et de signaler ses incertitudes.", "and flagging its uncertainties.")}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
              <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                <Award className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs text-muted-foreground">
                    {tr("Modèle le plus fiable", "Most reliable model")}
                  </div>
                  <div className="font-display font-semibold text-lg leading-tight">
                    {bestOverall.model}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {tr("Meilleur classement comparatif", "Best comparative ranking")}
                    {bestOverall.meanRank != null && (
                      <span className="font-mono text-foreground">
                        {" "}
                        — {tr("rang moyen", "mean rank")} {bestOverall.meanRank.toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {safestModel && (
                <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
                  <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs text-muted-foreground">
                      {tr("Le plus prudent (anti-hallucination)", "Most cautious (anti-hallucination)")}
                    </div>
                    <div className="font-display font-semibold text-lg leading-tight">
                      {safestModel.model}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {tr("Invente le moins de faits", "Invents the fewest facts")}
                      {safestModel.regulatoryHallucinationRisk != null && (
                        <span className="font-mono text-foreground">
                          {" "}
                          — {safestModel.regulatoryHallucinationRisk.toFixed(1)}/5
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="text-sm font-medium mb-3">
                {tr("Les cinq critères de notation (chacun de 0 à 5)", "The five scoring criteria (each from 0 to 5)")}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                {DIMENSION_GLOSSARY.map((dim) => (
                  <div key={dim.label} className="flex items-start gap-2.5">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                    <div>
                      <span className="text-sm font-medium">{dim.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {" — "}
                        {dim.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Model ranking — compact, screenshot-friendly leaderboard */}
      <div>
        <div className="eyebrow mb-1.5">{tr("Classement", "Ranking")}</div>
        <h2 className="font-display text-2xl font-semibold tracking-tight mb-1">
          {tr("Classement des modèles", "Model ranking")}
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {tr(
            `${results.summaryByModel.length} modèles · classés par rang moyen (plus bas = meilleur)`,
            `${results.summaryByModel.length} models · ranked by mean rank (lower = better)`,
          )}
        </p>
        <Card className="overflow-hidden hairline-top">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-center">#</TableHead>
                  <TableHead>{tr("Modèle", "Model")}</TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    {tr("Rang moyen", "Mean rank")}
                  </TableHead>
                  {showVerdict && (
                    <TableHead className="min-w-[150px]">
                      {tr("Score global", "Overall score")}
                    </TableHead>
                  )}
                  <TableHead className="text-right whitespace-nowrap">
                    {tr("Échecs", "Failed")}
                  </TableHead>
                  <TableHead className="text-right whitespace-nowrap">
                    {tr("Latence", "Latency")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.summaryByModel.map((m) => {
                  const finalRank = m.rank;
                  const isTop = finalRank === 1;
                  const isTie =
                    finalRank != null && (rankCounts.get(finalRank) ?? 0) > 1;
                  const sizeLabel = m.size
                    ? t(`size_${m.size}`)
                    : m.params ?? "";
                  const sizeSuffix =
                    m.size && m.params ? ` · ${m.params}` : "";
                  return (
                    <TableRow
                      key={m.model}
                      className={isTop ? "bg-primary/[0.06]" : undefined}
                    >
                      <TableCell className="text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-semibold tabular-nums ${isTop ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}
                        >
                          {finalRank ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 flex-wrap">
                          {isTop && (
                            <Award className="w-4 h-4 text-primary shrink-0" />
                          )}
                          <span className="font-display font-semibold leading-tight">
                            {m.model}
                          </span>
                          {m.openSource ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                              <Unlock className="w-3 h-3" />
                              {tr("Open source", "Open source")}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">
                              <Lock className="w-3 h-3" />
                              {tr("Propriétaire", "Proprietary")}
                            </span>
                          )}
                          {isTie && (
                            <span className="text-[10px] text-primary">
                              {tr("(ex æquo)", "(tied)")}
                            </span>
                          )}
                        </div>
                        {(m.provider || sizeLabel) && (
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            {m.provider}
                            {sizeLabel && ` · ${sizeLabel}${sizeSuffix}`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium whitespace-nowrap">
                        {m.meanRank != null ? m.meanRank.toFixed(2) : "N/A"}
                      </TableCell>
                      {showVerdict && (
                        <TableCell>
                          {m.overallScore != null ? (
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[60px]">
                                <div
                                  className="h-full rounded-full bg-primary"
                                  style={{
                                    width: `${Math.max(0, Math.min(100, m.overallScore))}%`,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-mono tabular-nums font-medium w-12 text-right">
                                {m.overallScore.toFixed(1)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell
                        className={`text-right font-mono tabular-nums whitespace-nowrap ${m.nErrors > 0 ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {m.nErrors} / {m.nQuestions}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-muted-foreground whitespace-nowrap">
                        {m.avgLatency != null
                          ? `${m.avgLatency.toFixed(1)}s`
                          : "N/A"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>

      {!run.noEval && !run.dryRun && (
        <>
          {/* Detailed Scores Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="font-display tracking-tight">{tr("Dimensions d'évaluation (0-5)", "Evaluation dimensions (0-5)")}</CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => exportToCSV("scores-dimensions.csv", results.summaryByModel, ["model", "size", "params", "accuracy", "uncertaintyHandling", "justificationQuality", "sourceAwareness", "regulatoryHallucinationRisk"])}
              >
                <Download className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {radarModels.length === 0 ? (
                <div className="flex h-[420px] items-center justify-center text-center">
                  <p className="text-sm text-muted-foreground">
                    {tr("Aucune note exploitable pour ce run.", "No usable scores for this run.")}
                  </p>
                </div>
              ) : (
              <ResponsiveContainer width="100%" height={420} debounce={0}>
                <RadarChart data={radarData} margin={{ top: 20, right: 40, bottom: 20, left: 40 }}>
                  <PolarGrid stroke={gridColor} />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: tickColor }} />
                  <PolarRadiusAxis domain={[0, 5]} tickCount={6} tick={{ fontSize: 11, fill: tickColor }} stroke={gridColor} />
                  <RechartsTooltip content={<CustomTooltip />} isAnimationActive={false} />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                  {radarModels.map((m, i) => (
                    <Radar
                      key={m.model}
                      name={m.model}
                      dataKey={m.model}
                      stroke={CHART_COLORS[i % CHART_COLORS.length]}
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      fillOpacity={0.12}
                      strokeWidth={2}
                      isAnimationActive={false}
                    />
                  ))}
                </RadarChart>
              </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Topic */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-display tracking-tight">{tr("Score par famille", "Score by family")}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => exportToCSV("scores-topic.csv", results.summaryByTopic, ["group", "model", "overallScore"])}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300} debounce={0}>
                  <BarChart 
                    data={uniqueTopics.map(t_id => {
                      const row: any = { topic: t(t_id) };
                      results.summaryByModel.forEach(m => {
                        const s = results.summaryByTopic.find(x => x.group === t_id && x.model === m.model);
                        if (s) row[m.model] = s.overallScore;
                      });
                      return row;
                    })}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="topic" tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} />
                    <RechartsTooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                    <Legend wrapperStyle={{ fontSize: "13px" }} />
                    {results.summaryByModel.map((m, i) => (
                      <Bar 
                        key={m.model} 
                        dataKey={m.model} 
                        name={m.model} 
                        fill={CHART_COLORS[i % CHART_COLORS.length]} 
                        radius={[2, 2, 0, 0]}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* By Difficulty */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="font-display tracking-tight">{tr("Score par difficulté", "Score by difficulty")}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8"
                  onClick={() => exportToCSV("scores-difficulty.csv", results.summaryByDifficulty, ["group", "model", "overallScore"])}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300} debounce={0}>
                  <BarChart 
                    data={uniqueDifficulties.map(d_id => {
                      const row: any = { difficulty: t(d_id) };
                      results.summaryByModel.forEach(m => {
                        const s = results.summaryByDifficulty.find(x => x.group === d_id && x.model === m.model);
                        if (s) row[m.model] = s.overallScore;
                      });
                      return row;
                    })}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="difficulty" tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} />
                    <RechartsTooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                    <Legend wrapperStyle={{ fontSize: "13px" }} />
                    {results.summaryByModel.map((m, i) => (
                      <Bar 
                        key={m.model} 
                        dataKey={m.model} 
                        name={m.model} 
                        fill={CHART_COLORS[i % CHART_COLORS.length]} 
                        radius={[2, 2, 0, 0]}
                        isAnimationActive={false}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Drill-down Table */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
            <CardTitle className="font-display tracking-tight">{tr("Détail des questions", "Question details")}</CardTitle>
            <div className="flex flex-wrap gap-3">
              <Input 
                placeholder={tr("Rechercher...", "Search...")} 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-48"
              />
              <Select value={filterModel} onValueChange={setFilterModel}>
                <SelectTrigger className="w-32"><SelectValue placeholder={tr("Modèle", "Model")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("Tous les modèles", "All models")}</SelectItem>
                  {results.summaryByModel.map(m => <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTopic} onValueChange={setFilterTopic}>
                <SelectTrigger className="w-32"><SelectValue placeholder={tr("Topic", "Topic")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("Tous les topics", "All topics")}</SelectItem>
                  {uniqueTopics.map(t_id => <SelectItem key={t_id} value={t_id}>{t(t_id)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                <SelectTrigger className="w-36"><SelectValue placeholder={tr("Difficulté", "Difficulty")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("Toutes diff.", "All difficulties")}</SelectItem>
                  {uniqueDifficulties.map(d_id => <SelectItem key={d_id} value={d_id}>{t(d_id)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button 
                variant="outline"
                className="w-full md:w-auto"
                onClick={() => exportToCSV("drill-down.csv", filteredRows, ["questionId", "question", "model", "topic", "difficulty", "overallScore", "accuracy", "uncertaintyHandling", "justificationQuality", "sourceAwareness", "regulatoryHallucinationRisk", "error"])}
              >
                <Download className="w-4 h-4 mr-2" /> {tr("Exporter CSV", "Export CSV")}
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {tr(`Affichage de ${filteredRows.length} résultats sur ${results.rows.length}`, `Showing ${filteredRows.length} of ${results.rows.length} results`)}
            {trLoading && (
              <span className="ml-2 inline-flex items-center gap-1.5 text-primary">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {tr("· Traduction en cours…", "· Translating…")}
              </span>
            )}
            {trFailed && (
              <span className="ml-2 text-destructive">
                {tr("· Traduction indisponible (français)", "· Translation unavailable (French)")}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {sortHead(tr("ID", "ID"), "questionId", "w-24")}
                  {sortHead(tr("Question", "Question"), "question", "min-w-[18rem]")}
                  {sortHead(tr("Modèle", "Model"), "model")}
                  {sortHead(tr("Topic / Diff.", "Topic / Diff."), "topic")}
                  {sortHead(tr("Score", "Score"), "overallScore")}
                  {sortHead(tr("Hallucination", "Hallucination"), "regulatoryHallucinationRisk")}
                  <TableHead>{tr("Détails", "Details")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRows.slice(0, 100).map((row, i) => (
                  <TableRow key={`${row.questionId}-${row.model}-${i}`}>
                    <TableCell className="font-mono text-xs">{row.questionId}</TableCell>
                    <TableCell className="max-w-md">
                      <span className="block text-sm line-clamp-2" title={trText(row.question) || undefined}>
                        {trText(row.question)}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{row.model}</TableCell>
                    <TableCell>
                      <div className="text-sm">{t(row.topic)}</div>
                      <div className="text-xs text-muted-foreground">{t(row.difficulty)}</div>
                    </TableCell>
                    <TableCell>
                      {row.error ? (
                        <Badge variant="destructive">{tr("Erreur API", "API error")}</Badge>
                      ) : row.overallScore != null ? (
                        <div className="font-bold text-primary">{row.overallScore.toFixed(0)}</div>
                      ) : (
                        <span className="text-muted-foreground">N/A</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.regulatoryHallucinationRisk != null ? (
                        <div className="flex items-center gap-1">
                          {row.regulatoryHallucinationRisk < 3 ? 
                            <AlertTriangle className="w-4 h-4 text-destructive" /> : 
                            row.regulatoryHallucinationRisk === 5 ?
                            <CheckCircle2 className="w-4 h-4 text-green-600" /> : null
                          }
                          <span>{row.regulatoryHallucinationRisk}/5</span>
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">{tr("Voir", "View")}</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              {tr("Question", "Question")} {row.questionId} - {row.model}
                            </DialogTitle>
                          </DialogHeader>
                          
                          <div className="space-y-6 mt-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-2">{tr("Question", "Question")}</h4>
                              <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                                {trText(row.question)}
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex justify-between">
                                <span>{tr("Réponse du modèle", "Model response")}</span>
                                {row.latencySeconds && <span className="font-normal text-muted-foreground">{tr("Latence:", "Latency:")} {row.latencySeconds.toFixed(1)}s</span>}
                              </h4>
                              {row.error ? (
                                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm font-mono whitespace-pre-wrap">
                                  {row.error}
                                </div>
                              ) : (
                                <div className="p-3 border rounded-md text-sm whitespace-pre-wrap">
                                  {trText(row.rawResponse) || tr("Aucune réponse générée", "No response generated")}
                                </div>
                              )}
                            </div>

                            {row.overallScore != null && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">{tr("Évaluation par le juge", "Judge evaluation")} ({run.judgeModel})</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                                  <div className="p-2 bg-muted/50 rounded flex flex-col">
                                    <span className="text-xs text-muted-foreground">{tr("Score Global", "Overall score")}</span>
                                    <span className="font-bold text-primary">{row.overallScore}/100</span>
                                  </div>
                                  <div className="p-2 bg-muted/50 rounded flex flex-col">
                                    <span className="text-xs text-muted-foreground">{tr("Exactitude", "Accuracy")}</span>
                                    <span className="font-bold">{row.accuracy}/5</span>
                                  </div>
                                  <div className="p-2 bg-muted/50 rounded flex flex-col">
                                    <span className="text-xs text-muted-foreground">{tr("Risque d'hallucination", "Hallucination risk")}</span>
                                    <span className={`font-bold ${row.regulatoryHallucinationRisk! < 3 ? 'text-destructive' : ''}`}>
                                      {row.regulatoryHallucinationRisk}/5
                                    </span>
                                  </div>
                                </div>
                                
                                {row.verdict && (
                                  <div className="space-y-3">
                                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-sm">
                                      <span className="font-semibold block mb-1">{tr("Verdict", "Verdict")}</span>
                                      {trText(row.verdict)}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {row.strengths && (
                                        <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-md text-sm">
                                          <span className="font-semibold text-green-800 dark:text-green-300 block mb-1">{tr("Points forts", "Strengths")}</span>
                                          <div className="whitespace-pre-wrap">{trText(row.strengths)}</div>
                                        </div>
                                      )}
                                      {row.weaknesses && (
                                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md text-sm">
                                          <span className="font-semibold text-red-800 dark:text-red-300 block mb-1">{tr("Points faibles", "Weaknesses")}</span>
                                          <div className="whitespace-pre-wrap">{trText(row.weaknesses)}</div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredRows.length > 100 && (
              <div className="p-4 text-center text-sm text-muted-foreground border-t">
                {tr("Seuls les 100 premiers résultats sont affichés. Utilisez l'export CSV pour voir tous les résultats.", "Only the first 100 results are shown. Use the CSV export to see all results.")}
              </div>
            )}
            {filteredRows.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                {tr("Aucun résultat ne correspond à vos filtres.", "No results match your filters.")}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
