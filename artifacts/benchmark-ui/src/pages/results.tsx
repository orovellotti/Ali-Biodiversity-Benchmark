import { Link } from "wouter";
import { useI18n } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { RunHistory } from "@/components/run-history";
import { Button } from "@/components/ui/button";
import { ArrowRight, BarChart3 } from "lucide-react";

export function Results() {
  const { tr } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader maxWidth="max-w-[1200px]">
        <Button variant="outline" size="sm" asChild>
          <Link href="/console">
            <ArrowRight className="w-4 h-4 mr-2" /> Console
          </Link>
        </Button>
      </SiteHeader>

      <div className="max-w-[1200px] mx-auto px-6 py-10">
        <div className="mb-10">
          <div className="eyebrow mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />{" "}
            {tr("Résultats", "Results")}
          </div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">
            {tr(
              "Résultats & historique des runs",
              "Results & run history",
            )}
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px] max-w-2xl">
            {tr(
              "Comparez les performances des modèles, explorez les classements et l'historique des évaluations. Cliquez sur un run pour ouvrir son tableau de bord détaillé.",
              "Compare model performance, explore rankings and the evaluation history. Click a run to open its detailed dashboard.",
            )}
          </p>
        </div>

        <RunHistory
          featured
          emptyHint={tr(
            "Lancez une première évaluation depuis la console.",
            "Launch a first evaluation from the console.",
          )}
        />
      </div>
    </div>
  );
}
