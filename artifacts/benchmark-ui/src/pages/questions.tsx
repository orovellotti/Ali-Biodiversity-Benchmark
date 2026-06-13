import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListQuestions,
  getListQuestionsQueryKey,
  useListQuestionVotes,
  getListQuestionVotesQueryKey,
  useSubmitQuestionVote,
  useGetQuestionAnswers,
  getGetQuestionAnswersQueryKey,
  type QuestionVoteCount,
  type QuestionAnswer,
} from "@workspace/api-client-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { useTranslateMap } from "@/lib/use-translate";
import {
  BookOpen,
  Search,
  MessageSquare,
  ArrowBigUp,
  ArrowBigDown,
  Loader2,
  ChevronDown,
  Sparkles,
  Share2,
  Link2,
} from "lucide-react";

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

/** Build an absolute, shareable deep link to one question (auto-opens answers). */
function questionShareUrl(id: string): string {
  const base = import.meta.env.BASE_URL;
  const prefix = base.endsWith("/") ? base : `${base}/`;
  return `${window.location.origin}${prefix}questions?q=${encodeURIComponent(id)}`;
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.078 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
    </svg>
  );
}

/** Per-question social share menu — deep link + intent links + copy. */
function ShareMenu({
  questionId,
  questionText,
  tr,
}: {
  questionId: string;
  questionText: string;
  tr: (fr: string, en: string) => string;
}) {
  const url = questionShareUrl(questionId);
  const trimmed =
    questionText.length > 180 ? `${questionText.slice(0, 177)}…` : questionText;
  const text = tr(
    `« ${trimmed} » — les réponses des modèles d'IA sur le Benchmark Biodiversité ALI.`,
    `"${trimmed}" — see how AI models answer on the ALI Biodiversity Benchmark.`,
  );

  const openIntent = (href: string) =>
    window.open(href, "_blank", "noopener,noreferrer");

  const nativeShareSupported =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: "Benchmark Biodiversité ALI", text, url });
    } catch {
      /* user cancelled or unsupported — ignore */
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast({
        title: tr("Lien copié", "Link copied"),
        description: tr(
          "Le lien vers cette question a été copié.",
          "The link to this question has been copied.",
        ),
      });
    } catch {
      toast({ title: tr("Échec de la copie", "Copy failed"), description: url });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <Share2 className="w-3.5 h-3.5" />
          {tr("Partager", "Share")}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {nativeShareSupported && (
          <>
            <DropdownMenuItem onClick={handleNativeShare}>
              <Share2 className="w-4 h-4" />
              {tr("Partager…", "Share…")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={() =>
            openIntent(
              `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                text,
              )}&url=${encodeURIComponent(url)}`,
            )
          }
        >
          <XIcon className="w-4 h-4" />
          {tr("Partager sur X", "Share on X")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openIntent(
              `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                url,
              )}`,
            )
          }
        >
          <LinkedInIcon className="w-4 h-4" />
          {tr("Partager sur LinkedIn", "Share on LinkedIn")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openIntent(
              `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                url,
              )}`,
            )
          }
        >
          <FacebookIcon className="w-4 h-4" />
          {tr("Partager sur Facebook", "Share on Facebook")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openIntent(
              `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
            )
          }
        >
          <WhatsAppIcon className="w-4 h-4" />
          {tr("Partager sur WhatsApp", "Share on WhatsApp")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy}>
          <Link2 className="w-4 h-4" />
          {tr("Copier le lien", "Copy link")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Questions() {
  const { tr, t } = useI18n();
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  // Deep link: /questions?q=<id> auto-opens that question's model answers.
  const deepLinkId = useMemo(
    () => new URLSearchParams(window.location.search).get("q"),
    [],
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(deepLinkId ? [deepLinkId] : []),
  );

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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

  // Scroll a deep-linked question into view once the list has loaded.
  useEffect(() => {
    if (!deepLinkId || isLoading) return;
    const el = document.getElementById(`question-${deepLinkId}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [deepLinkId, isLoading]);

  // Translate visible question text + expected answers to EN (cached, no-op in FR).
  const translatable = useMemo(() => {
    const out: string[] = [];
    for (const q of filtered) {
      out.push(q.question);
      if (q.expectedAnswerShort) out.push(q.expectedAnswerShort);
    }
    return out;
  }, [filtered]);
  const {
    tr: trText,
    failed: trFailed,
    loading: trLoading,
  } = useTranslateMap(translatable);

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

        <div className="text-xs text-muted-foreground mt-4 flex items-center gap-2">
          {isLoading
            ? tr("Chargement...", "Loading...")
            : tr(
                `${filtered.length} question${filtered.length > 1 ? "s" : ""} sur ${questions?.length ?? 0}`,
                `${filtered.length} of ${questions?.length ?? 0} question${(questions?.length ?? 0) > 1 ? "s" : ""}`,
              )}
          {trLoading && (
            <span className="inline-flex items-center gap-1.5 text-primary">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {tr("Traduction en cours…", "Translating…")}
            </span>
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
                  id={`question-${q.id}`}
                  className={`border rounded-lg p-4 bg-card flex gap-4 ${
                    deepLinkId === q.id
                      ? "border-primary ring-1 ring-primary/40"
                      : "border-card-border"
                  }`}
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
                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(q.id)}
                        aria-expanded={expanded.has(q.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {expanded.has(q.id)
                          ? tr(
                              "Masquer les réponses des modèles",
                              "Hide model answers",
                            )
                          : tr(
                              "Voir les réponses des modèles",
                              "Show model answers",
                            )}
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${
                            expanded.has(q.id) ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                      <ShareMenu
                        questionId={q.id}
                        questionText={trText(q.question)}
                        tr={tr}
                      />
                    </div>
                    {expanded.has(q.id) && <ModelAnswers questionId={q.id} />}
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

function scoreClass(score: number): string {
  if (score >= 80) return "text-primary";
  if (score >= 50) return "text-foreground";
  return "text-destructive";
}

function ModelAnswers({ questionId }: { questionId: string }) {
  const { tr } = useI18n();
  const { data, isLoading, isError } = useGetQuestionAnswers(questionId, {
    query: {
      queryKey: getGetQuestionAnswersQueryKey(questionId),
      staleTime: 5 * 60 * 1000,
    },
  });

  const answers = data?.answers ?? [];

  // Translate answer text + judge verdicts to EN (cached, no-op in FR).
  const translatable = useMemo(() => {
    const out: string[] = [];
    for (const a of answers) {
      out.push(a.response);
      if (a.verdict) out.push(a.verdict);
    }
    return out;
  }, [answers]);
  const { tr: trText, loading: trLoading } = useTranslateMap(translatable);

  if (isLoading) {
    return (
      <div className="mt-3 space-y-2">
        <Skeleton className="h-16 w-full rounded-md" />
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    );
  }
  if (isError) {
    return (
      <p className="mt-3 text-xs text-destructive">
        {tr(
          "Erreur lors du chargement des réponses.",
          "Error loading answers.",
        )}
      </p>
    );
  }
  if (answers.length === 0) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        {tr(
          "Aucun modèle n'a encore répondu à cette question.",
          "No model has answered this question yet.",
        )}
      </p>
    );
  }

  return (
    <div className="mt-3 border-t border-card-border pt-3">
      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground font-mono mb-3">
        {tr(
          `Réponses des modèles (${answers.length})`,
          `Model answers (${answers.length})`,
        )}
        {trLoading && (
          <span className="inline-flex items-center gap-1.5 text-primary normal-case tracking-normal">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {tr("Traduction…", "Translating…")}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {answers.map((a: QuestionAnswer) => (
          <div
            key={`${a.provider}::${a.model}`}
            className="rounded-md border border-card-border bg-background/60 p-3"
          >
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <span className="font-mono text-xs font-semibold text-foreground break-all">
                {a.model}
              </span>
              {a.overallScore != null && (
                <span
                  className={`font-mono text-sm font-semibold tabular-nums shrink-0 ${scoreClass(
                    a.overallScore,
                  )}`}
                >
                  {Math.round(a.overallScore)}
                  <span className="text-muted-foreground text-xs">/100</span>
                </span>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {trText(a.response)}
            </p>
            {a.verdict && (
              <p className="text-xs text-muted-foreground italic mt-2 border-l-2 border-card-border pl-2">
                {trText(a.verdict)}
              </p>
            )}
          </div>
        ))}
      </div>
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
