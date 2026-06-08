import { useState, useMemo } from "react";
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell 
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/format";
import { Run, RunResults, ResultRow } from "@workspace/api-client-react";
import { Download, Info, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const CHART_COLORS = [
  "#0079F2", // blue
  "#795EFF", // purple
  "#009118", // green
  "#A60808", // red
  "#ec4899", // pink
  "#f59e0b", // amber
];

const SCORE_LABELS = {
  overallScore: t("overallScore"),
  accuracy: t("accuracy"),
  uncertaintyHandling: t("uncertaintyHandling"),
  justificationQuality: t("justificationQuality"),
  sourceAwareness: t("sourceAwareness"),
  regulatoryHallucinationRisk: "Risque d'hallucination (5 = aucun)",
};

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

  const uniqueTopics = useMemo(() => [...new Set(results.rows.map(r => r.topic).filter(Boolean) as string[])], [results.rows]);
  const uniqueDifficulties = useMemo(() => [...new Set(results.rows.map(r => r.difficulty).filter(Boolean) as string[])], [results.rows]);

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
    <div className="space-y-6">
      {/* Overview Rankings */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Classement des modèles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {results.summaryByModel.map((modelSummary, index) => (
            <Card key={modelSummary.model} className={index === 0 ? "border-primary shadow-sm" : ""}>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-bold text-lg">{modelSummary.model}</div>
                  <Badge variant={index === 0 ? "default" : "secondary"}>#{index + 1}</Badge>
                </div>
                <div className="text-sm text-muted-foreground mb-4">{modelSummary.provider}</div>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Score Global</span>
                    <span className="font-bold text-primary">{modelSummary.overallScore !== null ? `${modelSummary.overallScore?.toFixed(1)}/100` : "N/A"}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Erreurs API</span>
                    <span className={`text-sm font-medium ${modelSummary.nErrors > 0 ? "text-destructive" : ""}`}>
                      {modelSummary.nErrors} / {modelSummary.nQuestions}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Latence moy.</span>
                    <span className="text-sm font-medium">{modelSummary.avgLatency !== null ? `${modelSummary.avgLatency?.toFixed(1)}s` : "N/A"}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {!run.noEval && !run.dryRun && (
        <>
          {/* Detailed Scores Chart */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle>Dimensions d'évaluation (0-5)</CardTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8"
                onClick={() => exportToCSV("scores-dimensions.csv", results.summaryByModel, ["model", "accuracy", "uncertaintyHandling", "justificationQuality", "sourceAwareness", "regulatoryHallucinationRisk"])}
              >
                <Download className="w-4 h-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350} debounce={0}>
                <BarChart data={results.summaryByModel} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                  <XAxis dataKey="model" tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 12, fill: tickColor }} stroke={tickColor} />
                  <RechartsTooltip content={<CustomTooltip />} isAnimationActive={false} cursor={{ fill: 'rgba(0,0,0,0.05)' }} />
                  <Legend wrapperStyle={{ fontSize: "13px" }} />
                  {['accuracy', 'uncertaintyHandling', 'justificationQuality', 'sourceAwareness', 'regulatoryHallucinationRisk'].map((key, i) => (
                    <Bar 
                      key={key} 
                      dataKey={key} 
                      name={SCORE_LABELS[key as keyof typeof SCORE_LABELS]} 
                      fill={CHART_COLORS[i % CHART_COLORS.length]} 
                      radius={[2, 2, 0, 0]}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Topic */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle>Score par Topic</CardTitle>
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
                <CardTitle>Score par Difficulté</CardTitle>
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
            <CardTitle>Détail des questions</CardTitle>
            <div className="flex flex-wrap gap-3">
              <Input 
                placeholder="Rechercher..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full md:w-48"
              />
              <Select value={filterModel} onValueChange={setFilterModel}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Modèle" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les modèles</SelectItem>
                  {results.summaryByModel.map(m => <SelectItem key={m.model} value={m.model}>{m.model}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterTopic} onValueChange={setFilterTopic}>
                <SelectTrigger className="w-32"><SelectValue placeholder="Topic" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les topics</SelectItem>
                  {uniqueTopics.map(t_id => <SelectItem key={t_id} value={t_id}>{t(t_id)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterDifficulty} onValueChange={setFilterDifficulty}>
                <SelectTrigger className="w-36"><SelectValue placeholder="Difficulté" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes diff.</SelectItem>
                  {uniqueDifficulties.map(d_id => <SelectItem key={d_id} value={d_id}>{t(d_id)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button 
                variant="outline"
                className="w-full md:w-auto"
                onClick={() => exportToCSV("drill-down.csv", filteredRows, ["questionId", "model", "topic", "difficulty", "overallScore", "accuracy", "uncertaintyHandling", "justificationQuality", "sourceAwareness", "regulatoryHallucinationRisk", "error"])}
              >
                <Download className="w-4 h-4 mr-2" /> Exporter CSV
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            Affichage de {filteredRows.length} résultats sur {results.rows.length}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">ID</TableHead>
                  <TableHead>Modèle</TableHead>
                  <TableHead>Topic / Diff.</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Hallucination</TableHead>
                  <TableHead>Détails</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.slice(0, 100).map((row, i) => (
                  <TableRow key={`${row.questionId}-${row.model}-${i}`}>
                    <TableCell className="font-mono text-xs">{row.questionId}</TableCell>
                    <TableCell className="font-medium">{row.model}</TableCell>
                    <TableCell>
                      <div className="text-sm">{t(row.topic)}</div>
                      <div className="text-xs text-muted-foreground">{t(row.difficulty)}</div>
                    </TableCell>
                    <TableCell>
                      {row.error ? (
                        <Badge variant="destructive">Erreur API</Badge>
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
                          <Button variant="outline" size="sm">Voir</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              Question {row.questionId} - {row.model}
                            </DialogTitle>
                          </DialogHeader>
                          
                          <div className="space-y-6 mt-4">
                            <div>
                              <h4 className="text-sm font-semibold mb-2">Question</h4>
                              <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                                {row.question}
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-semibold mb-2 flex justify-between">
                                <span>Réponse du modèle</span>
                                {row.latencySeconds && <span className="font-normal text-muted-foreground">Latence: {row.latencySeconds.toFixed(1)}s</span>}
                              </h4>
                              {row.error ? (
                                <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm font-mono whitespace-pre-wrap">
                                  {row.error}
                                </div>
                              ) : (
                                <div className="p-3 border rounded-md text-sm whitespace-pre-wrap">
                                  {row.rawResponse || "Aucune réponse générée"}
                                </div>
                              )}
                            </div>

                            {row.overallScore !== null && (
                              <div>
                                <h4 className="text-sm font-semibold mb-2">Évaluation par le juge ({run.judgeModel})</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                                  <div className="p-2 bg-muted/50 rounded flex flex-col">
                                    <span className="text-xs text-muted-foreground">Score Global</span>
                                    <span className="font-bold text-primary">{row.overallScore}/100</span>
                                  </div>
                                  <div className="p-2 bg-muted/50 rounded flex flex-col">
                                    <span className="text-xs text-muted-foreground">Exactitude</span>
                                    <span className="font-bold">{row.accuracy}/5</span>
                                  </div>
                                  <div className="p-2 bg-muted/50 rounded flex flex-col">
                                    <span className="text-xs text-muted-foreground">Risque d'hallucination</span>
                                    <span className={`font-bold ${row.regulatoryHallucinationRisk! < 3 ? 'text-destructive' : ''}`}>
                                      {row.regulatoryHallucinationRisk}/5
                                    </span>
                                  </div>
                                </div>
                                
                                {row.verdict && (
                                  <div className="space-y-3">
                                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-md text-sm">
                                      <span className="font-semibold block mb-1">Verdict</span>
                                      {row.verdict}
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      {row.strengths && (
                                        <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-md text-sm">
                                          <span className="font-semibold text-green-800 dark:text-green-300 block mb-1">Points forts</span>
                                          <div className="whitespace-pre-wrap">{row.strengths}</div>
                                        </div>
                                      )}
                                      {row.weaknesses && (
                                        <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-md text-sm">
                                          <span className="font-semibold text-red-800 dark:text-red-300 block mb-1">Points faibles</span>
                                          <div className="whitespace-pre-wrap">{row.weaknesses}</div>
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
                Seuls les 100 premiers résultats sont affichés. Utilisez l'export CSV pour voir tous les résultats.
              </div>
            )}
            {filteredRows.length === 0 && (
              <div className="p-8 text-center text-muted-foreground">
                Aucun résultat ne correspond à vos filtres.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
