import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type Lang = "fr" | "en";

const STORAGE_KEY = "benchmark-lang";

// Bilingual dictionary for dynamic data labels coming from the API
// (sections/topics, scores, difficulty, question types, status, phases).
// The benchmark dataset content itself (questions/answers/verdicts) is the
// source of truth in French; in EN mode it is translated display-only via the
// server /benchmark/translate endpoint (see use-translate.ts), not this dict.
const DATA_LABELS: Record<string, { fr: string; en: string }> = {
  // Sections (jeu V2/V3 Discriminant)
  factual_easy: { fr: "Factuel facile", en: "Factual (easy)" },
  factual_expert: { fr: "Factuel expert", en: "Factual (expert)" },
  bias_and_dilemmas: { fr: "Biais & dilemmes", en: "Bias & dilemmas" },
  knowledge_graph_reasoning: { fr: "Raisonnement sur graphe", en: "Graph reasoning" },
  implicit_knowledge_graph_reasoning: {
    fr: "Raisonnement relationnel implicite",
    en: "Implicit relational reasoning",
  },
  moral_dilemmas: { fr: "Dilemmes moraux", en: "Moral dilemmas" },

  // Anciens topics (jeu 800 questions)
  taxonomie: { fr: "Taxonomie", en: "Taxonomy" },
  statuts_reglementaires: { fr: "Statuts réglementaires", en: "Regulatory status" },
  sequence_erc: { fr: "Séquence ERC", en: "ERC sequence" },
  etude_impact: { fr: "Étude d'impact", en: "Impact assessment" },
  restauration_ecologique: { fr: "Restauration écologique", en: "Ecological restoration" },
  especes_protegees: { fr: "Espèces protégées", en: "Protected species" },
  services_ecosystemiques: { fr: "Services écosystémiques", en: "Ecosystem services" },
  arbitrages_socio_ecologiques: {
    fr: "Arbitrages socio-écologiques",
    en: "Socio-ecological trade-offs",
  },

  // Scores
  accuracy: { fr: "Exactitude", en: "Accuracy" },
  uncertaintyHandling: { fr: "Gestion de l'incertitude", en: "Uncertainty handling" },
  justificationQuality: { fr: "Qualité de la justification", en: "Justification quality" },
  sourceAwareness: { fr: "Mention des sources", en: "Source awareness" },
  regulatoryHallucinationRisk: {
    fr: "Risque d'hallucination réglementaire",
    en: "Regulatory hallucination risk",
  },
  overallScore: { fr: "Score global", en: "Overall score" },

  // Difficulty
  easy: { fr: "Facile", en: "Easy" },
  medium: { fr: "Moyen", en: "Medium" },
  hard: { fr: "Difficile", en: "Hard" },
  expert: { fr: "Expert", en: "Expert" },

  // Model size tiers
  size_small: { fr: "Petit", en: "Small" },
  size_medium: { fr: "Moyen", en: "Medium" },
  size_large: { fr: "Grand", en: "Large" },

  // Question types (jeu V2/V3 Discriminant)
  domain_knowledge: { fr: "Connaissance du domaine", en: "Domain knowledge" },
  expert_domain_knowledge: { fr: "Expertise du domaine", en: "Expert domain knowledge" },
  graph_reasoning: { fr: "Raisonnement sur graphe", en: "Graph reasoning" },
  tradeoff_and_bias_detection: {
    fr: "Arbitrage & détection de biais",
    en: "Trade-off & bias detection",
  },
  ethical_tradeoff: { fr: "Arbitrage éthique", en: "Ethical trade-off" },
  implicit_relational_reasoning: {
    fr: "Raisonnement relationnel implicite",
    en: "Implicit relational reasoning",
  },

  // Question types (ancien jeu)
  factuel: { fr: "Factuel", en: "Factual" },
  raisonnement: { fr: "Raisonnement", en: "Reasoning" },
  arbitrage: { fr: "Arbitrage", en: "Trade-off" },
  critique: { fr: "Critique", en: "Critique" },

  // Status
  queued: { fr: "En attente", en: "Queued" },
  running: { fr: "En cours", en: "Running" },
  completed: { fr: "Terminé", en: "Completed" },
  failed: { fr: "Échec", en: "Failed" },
  interrupted: { fr: "Interrompu", en: "Interrupted" },

  // Phases
  empty: { fr: "Vide", en: "Empty" },
  query: { fr: "Interrogation des modèles", en: "Querying models" },
  evaluate: { fr: "Évaluation par le juge", en: "Judge evaluation" },
  report: { fr: "Génération du rapport", en: "Generating report" },
  done: { fr: "Terminé", en: "Done" },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  /** Inline translation: returns the string for the current language. */
  tr: (fr: string, en: string) => string;
  /** Translate a dynamic data key (topic/status/score…) to the current language. */
  t: (key: string | null | undefined) => string;
  /** Locale-aware short date/time. */
  formatDateTime: (dateStr: string | null | undefined) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function readInitialLang(): Lang {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return saved === "fr" ? "fr" : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readInitialLang);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nContextValue>(() => {
    return {
      lang,
      setLang: setLangState,
      tr: (fr, en) => (lang === "en" ? en : fr),
      t: (key) => {
        if (!key) return "";
        const entry = DATA_LABELS[key];
        return entry ? entry[lang] : key;
      },
      formatDateTime: (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        return d.toLocaleString(lang === "en" ? "en-GB" : "fr-FR", {
          day: "2-digit",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within a LanguageProvider");
  }
  return ctx;
}
