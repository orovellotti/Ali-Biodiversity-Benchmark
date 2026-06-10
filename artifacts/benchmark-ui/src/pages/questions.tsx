import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListQuestions,
  getListQuestionsQueryKey,
} from "@workspace/api-client-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/lib/i18n";
import { BookOpen, Search, MessageSquare } from "lucide-react";

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
              {filtered.map((q) => (
                <div
                  key={q.id}
                  className="border border-card-border rounded-lg p-4 bg-card"
                >
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold text-primary">
                      {q.id}
                    </span>
                    {q.topic && <Badge variant="secondary">{t(q.topic)}</Badge>}
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
                  <p className="text-sm">{q.question}</p>
                  {q.expectedAnswerShort && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {q.expectedAnswerShort}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
