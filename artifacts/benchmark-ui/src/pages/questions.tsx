import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListQuestions,
  getListQuestionsQueryKey,
  useListQuestionVotes,
  getListQuestionVotesQueryKey,
  useSubmitQuestionVote,
  type QuestionVoteCount,
} from "@workspace/api-client-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { useTranslateMap } from "@/lib/use-translate";
import { BookOpen, Search, MessageSquare, ArrowBigUp, ArrowBigDown } from "lucide-react";

type MyVote = "up" | "down";

/** Stable anonymous per-browser id so a voter can change/clear their vote. */
function getVoterId(): string {
  const KEY = "benchmark-voter-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

const MY_VOTES_KEY = "benchmark-question-votes";

function loadMyVotes(): Record<string, MyVote> {
  try {
    const raw = localStorage.getItem(MY_VOTES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, MyVote>) : {};
  } catch {
    return {};
  }
}

export function Questions() {
  const { tr, t } = useI18n();
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const { data: questions, isLoading, isError } = useListQuestions({
    query: {
      queryKey: getListQuestionsQueryKey(),
      staleTime: 5 * 60 * 1000,
    },
  });

  const topics = useMemo(
    () =>
      [
        ...new Set(
          (questions ?? []).map((q) => q.topic).filter(Boolean) as string[],
        ),
      ].sort(),
    [questions],
  );
  const difficulties = useMemo(
    () => [
      ...new Set(
        (questions ?? []).map((q) => q.difficulty).filter(Boolean) as string[],
      ),
    ],
    [questions],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (questions ?? []).filter((q) => {
      if (topic && q.topic !== topic) return false;
      if (difficulty && q.difficulty !== difficulty) return false;
      if (term) {
        const haystack =
          `${q.id} ${q.question} ${q.expectedAnswerShort ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [questions, search, topic, difficulty]);

  // Translate visible question text + expected answers to EN (cached, no-op in FR).
  const translatable = useMemo(() => {
    const out: string[] = [];
    for (const q of filtered) {
      out.push(q.question);
      if (q.expectedAnswerShort) out.push(q.expectedAnswerShort);
    }
    return out;
  }, [filtered]);
  const { tr: trText, failed: trFailed } = useTranslateMap(translatable);

  // --- Community voting --------------------------------------------------
  const queryClient = useQueryClient();
  const voterId = useMemo(() => getVoterId(), []);
  const [myVotes, setMyVotes] = useState<Record<string, MyVote>>(() =>
    loadMyVotes(),
  );
  const { data: votesData } = useListQuestionVotes({
    query: { queryKey: getListQuestionVotesQueryKey() },
  });
  const voteCounts = useMemo(() => {
    const m = new Map<string, QuestionVoteCount>();
    for (const v of votesData?.votes ?? []) m.set(v.questionId, v);
    return m;
  }, [votesData]);

  const voteMutation = useSubmitQuestionVote();
  const pendingId = voteMutation.isPending
    ? voteMutation.variables?.data.questionId
    : null;

  const handleVote = (questionId: string, dir: MyVote) => {
    const next: "up" | "down" | "none" =
      myVotes[questionId] === dir ? "none" : dir;
    voteMutation.mutate(
      { data: { questionId, voterId, vote: next } },
      {
        onSuccess: () => {
          setMyVotes((prev) => {
            const copy = { ...prev };
            if (next === "none") delete copy[questionId];
            else copy[questionId] = next;
            localStorage.setItem(MY_VOTES_KEY, JSON.stringify(copy));
            return copy;
          });
          queryClient.invalidateQueries({
            queryKey: getListQuestionVotesQueryKey(),
          });
        },
      },
    );
  };

  const selectClass =
    "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader maxWidth="max-w-[1200px]">
        <Button variant="outline" size="sm" asChild>
          <Link href="/contact">
            <MessageSquare className="w-4 h-4 mr-2" /> Contact
          </Link>
        </Button>
      </SiteHeader>

      <main className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground font-mono mb-3">
          <BookOpen className="w-4 h-4 text-primary" />{" "}
          {tr("Base de questions", "Question bank")}
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
          {tr("Parcourir les questions", "Browse questions")}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl">
          {tr(
            "Explorez l'ensemble du jeu de données de biodiversité utilisé pour évaluer les modèles : énoncés, topics, niveaux de difficulté et réponses attendues.",
            "Explore the entire biodiversity dataset used to evaluate the models: questions, topics, difficulty levels and expected answers.",
          )}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-8">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder={tr(
                "Rechercher (ID, texte, réponse attendue)...",
                "Search (ID, text, expected answer)...",
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className={selectClass}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          >
            <option value="">{tr("Tous les topics", "All topics")}</option>
            {topics.map((id) => (
              <option key={id} value={id}>
                {t(id)}
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value)}
          >
            <option value="">
              {tr("Toutes difficultés", "All difficulties")}
            </option>
            {difficulties.map((id) => (
              <option key={id} value={id}>
                {t(id)}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-muted-foreground mt-4">
          {isLoading
            ? tr("Chargement...", "Loading...")
            : tr(
                `${filtered.length} question${filtered.length > 1 ? "s" : ""} sur ${questions?.length ?? 0}`,
                `${filtered.length} of ${questions?.length ?? 0} question${(questions?.length ?? 0) > 1 ? "s" : ""}`,
              )}
        </div>

        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-red-500">
              {tr(
                "Erreur lors du chargement des questions.",
                "Error loading questions.",
              )}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {tr(
                "Aucune question ne correspond à ces filtres.",
                "No question matches these filters.",
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {trFailed && (
                <p className="text-xs text-destructive">
                  {tr(
                    "Traduction indisponible — affichage en français.",
                    "Translation unavailable — showing French.",
                  )}
                </p>
              )}
              {filtered.map((q) => (
                <div
                  key={q.id}
                  className="border border-card-border rounded-lg p-4 bg-card flex gap-4"
                >
                  <VoteControl
                    count={voteCounts.get(q.id) ?? null}
                    myVote={myVotes[q.id] ?? null}
                    pending={pendingId === q.id}
                    onVote={(dir) => handleVote(q.id, dir)}
                    tr={tr}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono text-xs font-semibold text-primary">
                        {q.id}
                      </span>
                      {q.topic && (
                        <Badge variant="secondary">{t(q.topic)}</Badge>
                      )}
                      {q.difficulty && (
                        <Badge variant="outline">{t(q.difficulty)}</Badge>
                      )}
                      {q.questionType && (
                        <Badge variant="outline">{t(q.questionType)}</Badge>
                      )}
                      {q.countryScope && (
                        <span className="text-xs text-muted-foreground">
                          {q.countryScope}
                        </span>
                      )}
                    </div>
                    <p className="text-sm">{trText(q.question)}</p>
                    {q.expectedAnswerShort && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {trText(q.expectedAnswerShort)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function VoteControl({
  count,
  myVote,
  pending,
  onVote,
  tr,
}: {
  count: QuestionVoteCount | null;
  myVote: MyVote | null;
  pending: boolean;
  onVote: (dir: MyVote) => void;
  tr: (fr: string, en: string) => string;
}) {
  const score = count?.score ?? 0;
  return (
    <div className="flex flex-col items-center gap-0.5 shrink-0 select-none">
      <button
        type="button"
        onClick={() => onVote("up")}
        disabled={pending}
        aria-pressed={myVote === "up"}
        aria-label={tr("Voter pour cette question", "Upvote this question")}
        title={tr("Question pertinente", "Relevant question")}
        className={`rounded-md p-1 transition-colors disabled:opacity-50 hover:bg-secondary ${
          myVote === "up" ? "text-primary" : "text-muted-foreground"
        }`}
      >
        <ArrowBigUp
          className="w-5 h-5"
          fill={myVote === "up" ? "currentColor" : "none"}
        />
      </button>
      <span
        className={`font-mono text-sm font-semibold tabular-nums ${
          score > 0
            ? "text-primary"
            : score < 0
              ? "text-destructive"
              : "text-muted-foreground"
        }`}
      >
        {score}
      </span>
      <button
        type="button"
        onClick={() => onVote("down")}
        disabled={pending}
        aria-pressed={myVote === "down"}
        aria-label={tr("Voter contre cette question", "Downvote this question")}
        title={tr("Question peu pertinente", "Less relevant question")}
        className={`rounded-md p-1 transition-colors disabled:opacity-50 hover:bg-secondary ${
          myVote === "down" ? "text-destructive" : "text-muted-foreground"
        }`}
      >
        <ArrowBigDown
          className="w-5 h-5"
          fill={myVote === "down" ? "currentColor" : "none"}
        />
      </button>
    </div>
  );
}
