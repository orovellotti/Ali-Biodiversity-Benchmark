import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetArenaDuel,
  useSubmitArenaVote,
  useGetArenaLeaderboard,
  getGetArenaLeaderboardQueryKey,
  type ArenaVoteResult,
  type ArenaRanking,
} from "@workspace/api-client-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/lib/i18n";
import {
  Swords,
  Trophy,
  RefreshCw,
  Loader2,
  ArrowRight,
  Crown,
  Minus,
} from "lucide-react";

function formatRatingChange(change: number): string {
  const rounded = Math.round(change);
  const sign = rounded >= 0 ? "+" : "−";
  return `${sign}${Math.abs(rounded)}`;
}

export function Arena() {
  const { tr, t } = useI18n();
  const queryClient = useQueryClient();

  const {
    data: duel,
    isLoading: duelLoading,
    isError: duelError,
    refetch: refetchDuel,
    isFetching: duelFetching,
  } = useGetArenaDuel();

  const voteMutation = useSubmitArenaVote();
  const [result, setResult] = useState<ArenaVoteResult | null>(null);

  const handleVote = async (winner: "A" | "B" | "tie") => {
    if (!duel) return;
    try {
      const res = await voteMutation.mutateAsync({
        data: { duelToken: duel.duelToken, winner },
      });
      setResult(res);
      queryClient.invalidateQueries({
        queryKey: getGetArenaLeaderboardQueryKey(),
      });
    } catch {
      // surfaced via voteMutation.isError below
    }
  };

  const handleNext = async () => {
    setResult(null);
    voteMutation.reset();
    await refetchDuel();
  };

  const isVoting = voteMutation.isPending;
  const revealed = result !== null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader maxWidth="max-w-[1100px]">
        <Button variant="outline" size="sm" asChild>
          <Link href="/resultats">
            <ArrowRight className="w-4 h-4 mr-2" />
            {tr("Résultats", "Results")}
          </Link>
        </Button>
      </SiteHeader>

      <main className="max-w-[1100px] mx-auto px-6 py-10">
        <div className="mb-8">
          <div className="eyebrow mb-3 flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" />{" "}
            {tr("Arène des modèles", "Model arena")}
          </div>
          <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
            {tr("Duels à l'aveugle", "Blind duels")}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-[15px]">
            {tr(
              "Comparez deux réponses de modèles anonymes à une même question, puis votez pour la meilleure. Les identités sont révélées après le vote, et chaque duel met à jour le classement Elo communautaire.",
              "Compare two anonymous model answers to the same question, then vote for the best one. Identities are revealed after voting, and each duel updates the community Elo leaderboard.",
            )}
          </p>
        </div>

        <Tabs defaultValue="duel" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="duel">
              <Swords className="w-4 h-4 mr-2" />
              {tr("Duel", "Duel")}
            </TabsTrigger>
            <TabsTrigger value="leaderboard">
              <Trophy className="w-4 h-4 mr-2" />
              {tr("Classement", "Leaderboard")}
            </TabsTrigger>
          </TabsList>

          {/* ── Duel ────────────────────────────────────────────── */}
          <TabsContent value="duel">
            {duelLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-20 w-full rounded-lg" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Skeleton className="h-64 w-full rounded-lg" />
                  <Skeleton className="h-64 w-full rounded-lg" />
                </div>
              </div>
            ) : duelError || !duel ? (
              <Card className="hairline-top">
                <CardContent className="p-10 text-center">
                  <Swords className="w-8 h-8 text-muted-foreground/50 mx-auto mb-4" />
                  <h3 className="font-display text-lg font-semibold mb-2">
                    {tr("Pas assez de données", "Not enough data")}
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    {tr(
                      "Il faut au moins deux modèles ayant répondu à une même question pour lancer un duel. Lancez d'abord des évaluations depuis la console.",
                      "At least two models must have answered the same question to start a duel. Run some evaluations from the console first.",
                    )}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-6"
                    onClick={() => refetchDuel()}
                    disabled={duelFetching}
                  >
                    <RefreshCw
                      className={`w-4 h-4 mr-2 ${duelFetching ? "animate-spin" : ""}`}
                    />
                    {tr("Réessayer", "Retry")}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Question */}
                <Card className="hairline-top">
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className="index-tag">
                        {tr("question", "question")}
                      </span>
                      {duel.topic && (
                        <Badge variant="secondary">{t(duel.topic)}</Badge>
                      )}
                      {duel.difficulty && (
                        <Badge variant="outline">{t(duel.difficulty)}</Badge>
                      )}
                    </div>
                    <p className="text-[15px] leading-relaxed">
                      {duel.question}
                    </p>
                  </CardContent>
                </Card>

                {/* Answer cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(["A", "B"] as const).map((side) => {
                    const option =
                      side === "A" ? duel.optionA : duel.optionB;
                    const model =
                      result &&
                      (side === "A" ? result.modelA : result.modelB);
                    const ratingChange = result
                      ? side === "A"
                        ? result.ratingChangeA
                        : result.ratingChangeB
                      : null;
                    const isWinner = revealed && result?.winner === side;
                    return (
                      <Card
                        key={side}
                        className={`hairline-top transition-colors ${
                          isWinner ? "border-primary shadow-md" : ""
                        }`}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="flex items-center justify-center w-7 h-7 rounded-md bg-secondary font-display font-semibold text-sm">
                                {side}
                              </span>
                              {isWinner && (
                                <Crown className="w-4 h-4 text-primary" />
                              )}
                            </div>
                            {ratingChange != null && (
                              <span
                                className={`font-mono text-sm font-medium tabular-nums ${
                                  ratingChange > 0
                                    ? "text-primary"
                                    : ratingChange < 0
                                      ? "text-destructive"
                                      : "text-muted-foreground"
                                }`}
                              >
                                {formatRatingChange(ratingChange)}
                              </span>
                            )}
                          </div>

                          {model ? (
                            <div className="mb-3 pb-3 border-b border-border">
                              <div className="font-display font-semibold leading-tight">
                                {model.model}
                              </div>
                              <div className="text-xs font-mono text-muted-foreground mt-0.5">
                                {model.provider}
                              </div>
                            </div>
                          ) : (
                            <div className="mb-3 pb-3 border-b border-border">
                              <div className="text-xs font-mono text-muted-foreground">
                                {tr("Modèle masqué", "Hidden model")}
                              </div>
                            </div>
                          )}

                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {option.response}
                          </p>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {voteMutation.isError && (
                  <p className="text-sm text-destructive text-center">
                    {tr(
                      "Échec de l'enregistrement du vote. Réessayez.",
                      "Failed to record the vote. Please try again.",
                    )}
                  </p>
                )}

                {/* Vote / next controls */}
                {revealed ? (
                  <div className="flex flex-col items-center gap-3">
                    <p className="text-sm text-muted-foreground">
                      {result?.winner === "tie"
                        ? tr("Vous avez voté : égalité.", "You voted: tie.")
                        : tr(
                            `Vous avez choisi ${result?.winner}.`,
                            `You picked ${result?.winner}.`,
                          )}
                    </p>
                    <Button onClick={handleNext} disabled={duelFetching}>
                      {duelFetching ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4 mr-2" />
                      )}
                      {tr("Question suivante", "Next question")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => handleVote("A")}
                      disabled={isVoting}
                    >
                      {isVoting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      {tr("A est meilleure", "A is better")}
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      onClick={() => handleVote("tie")}
                      disabled={isVoting}
                    >
                      <Minus className="w-4 h-4 mr-2" />
                      {tr("Égalité", "Tie")}
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => handleVote("B")}
                      disabled={isVoting}
                    >
                      {isVoting ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : null}
                      {tr("B est meilleure", "B is better")}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── Leaderboard ─────────────────────────────────────── */}
          <TabsContent value="leaderboard">
            <Leaderboard />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Leaderboard() {
  const { tr } = useI18n();
  const {
    data: leaderboard,
    isLoading,
    isError,
  } = useGetArenaLeaderboard();

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError || !leaderboard) {
    return (
      <div className="p-8 text-center text-destructive text-sm">
        {tr(
          "Erreur lors du chargement du classement.",
          "Error loading the leaderboard.",
        )}
      </div>
    );
  }

  if (leaderboard.rankings.length === 0) {
    return (
      <Card className="hairline-top">
        <CardContent className="p-10 text-center">
          <Trophy className="w-8 h-8 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="font-display text-lg font-semibold mb-2">
            {tr("Aucun vote pour l'instant", "No votes yet")}
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            {tr(
              "Soyez le premier à voter dans l'arène pour faire émerger un classement Elo.",
              "Be the first to vote in the arena to build an Elo leaderboard.",
            )}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-xs text-muted-foreground font-mono">
        {tr(
          `${leaderboard.totalVotes} vote${leaderboard.totalVotes > 1 ? "s" : ""} au total`,
          `${leaderboard.totalVotes} total vote${leaderboard.totalVotes > 1 ? "s" : ""}`,
        )}
      </div>
      <Card className="hairline-top">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">{tr("Rang", "Rank")}</TableHead>
                <TableHead>{tr("Modèle", "Model")}</TableHead>
                <TableHead className="text-right">
                  {tr("Elo", "Elo")}
                </TableHead>
                <TableHead className="text-right">
                  {tr("Duels", "Games")}
                </TableHead>
                <TableHead className="text-right">
                  {tr("Taux de victoire", "Win rate")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.rankings.map((row: ArenaRanking, index) => (
                <TableRow key={`${row.provider}/${row.model}`}>
                  <TableCell>
                    <span className="index-tag">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="font-display font-semibold leading-tight">
                      {row.model}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-0.5">
                      {row.provider}
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono font-medium tabular-nums">
                    {Math.round(row.rating)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums text-muted-foreground">
                    {row.games}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums">
                    {row.winRate != null
                      ? `${Math.round(row.winRate)}%`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
