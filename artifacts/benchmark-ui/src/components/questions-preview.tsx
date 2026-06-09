import { useMemo, useState } from "react";
import { useListQuestions, getListQuestionsQueryKey } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { t } from "@/lib/format";
import { BookOpen, Search } from "lucide-react";

export function QuestionsPreview() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");

  const { data: questions, isLoading, isError } = useListQuestions({
    query: {
      enabled: open,
      queryKey: getListQuestionsQueryKey(),
      staleTime: 5 * 60 * 1000,
    },
  });

  const topics = useMemo(
    () => [...new Set((questions ?? []).map((q) => q.topic).filter(Boolean) as string[])].sort(),
    [questions],
  );
  const difficulties = useMemo(
    () => [...new Set((questions ?? []).map((q) => q.difficulty).filter(Boolean) as string[])],
    [questions],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (questions ?? []).filter((q) => {
      if (topic && q.topic !== topic) return false;
      if (difficulty && q.difficulty !== difficulty) return false;
      if (term) {
        const haystack = `${q.id} ${q.question} ${q.expectedAnswerShort ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [questions, search, topic, difficulty]);

  const selectClass =
    "flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <BookOpen className="w-4 h-4 mr-2" /> Aperçu des questions
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display tracking-tight text-xl">Aperçu de la base de questions</DialogTitle>
          <DialogDescription>
            Parcourir les questions du jeu de données de biodiversité avant de lancer un run.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Rechercher (ID, texte, réponse attendue)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select className={selectClass} value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">Tous les topics</option>
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
            <option value="">Toutes difficultés</option>
            {difficulties.map((id) => (
              <option key={id} value={id}>
                {t(id)}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-muted-foreground">
          {isLoading
            ? "Chargement..."
            : `${filtered.length} question${filtered.length > 1 ? "s" : ""} sur ${questions?.length ?? 0}`}
        </div>

        <ScrollArea className="flex-1 -mx-2 px-2 min-h-0">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          ) : isError ? (
            <div className="p-8 text-center text-red-500">
              Erreur lors du chargement des questions.
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              Aucune question ne correspond à ces filtres.
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((q) => (
                <div key={q.id} className="border border-card-border rounded-lg p-4 bg-card">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-semibold text-primary">{q.id}</span>
                    {q.topic && <Badge variant="secondary">{t(q.topic)}</Badge>}
                    {q.difficulty && <Badge variant="outline">{t(q.difficulty)}</Badge>}
                    {q.questionType && <Badge variant="outline">{t(q.questionType)}</Badge>}
                    {q.countryScope && (
                      <span className="text-xs text-muted-foreground">{q.countryScope}</span>
                    )}
                  </div>
                  <p className="text-sm">{q.question}</p>
                  {q.expectedAnswerShort && (
                    <p className="text-xs text-muted-foreground mt-2">{q.expectedAnswerShort}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
