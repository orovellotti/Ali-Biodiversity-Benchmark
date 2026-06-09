export const TRANSLATIONS: Record<string, string> = {
  // Sections (jeu V2 Discriminant)
  factual_easy: "Factuel facile",
  factual_expert: "Factuel expert",
  bias_and_dilemmas: "Biais & dilemmes",
  knowledge_graph_reasoning: "Raisonnement sur graphe",

  // Anciens topics (jeu 800 questions)
  taxonomie: "Taxonomie",
  statuts_reglementaires: "Statuts réglementaires",
  sequence_erc: "Séquence ERC",
  etude_impact: "Étude d'impact",
  restauration_ecologique: "Restauration écologique",
  especes_protegees: "Espèces protégées",
  services_ecosystemiques: "Services écosystémiques",
  arbitrages_socio_ecologiques: "Arbitrages socio-écologiques",

  // Scores
  accuracy: "Exactitude",
  uncertaintyHandling: "Gestion de l'incertitude",
  justificationQuality: "Qualité de la justification",
  sourceAwareness: "Mention des sources",
  regulatoryHallucinationRisk: "Risque d'hallucination réglementaire",
  overallScore: "Score global",

  // Difficulty
  easy: "Facile",
  medium: "Moyen",
  hard: "Difficile",
  expert: "Expert",

  // Question types (jeu V2 Discriminant)
  domain_knowledge: "Connaissance du domaine",
  expert_domain_knowledge: "Expertise du domaine",
  graph_reasoning: "Raisonnement sur graphe",
  tradeoff_and_bias_detection: "Arbitrage & détection de biais",

  // Question types (ancien jeu)
  factuel: "Factuel",
  raisonnement: "Raisonnement",
  arbitrage: "Arbitrage",
  critique: "Critique",

  // Status
  queued: "En attente",
  running: "En cours",
  completed: "Terminé",
  failed: "Échec",
  interrupted: "Interrompu",

  // Phases
  empty: "Vide",
  query: "Interrogation des modèles",
  evaluate: "Évaluation par le juge",
  report: "Génération du rapport",
  done: "Terminé"
};

export function t(key: string | null | undefined): string {
  if (!key) return "";
  return TRANSLATIONS[key] || key;
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}
