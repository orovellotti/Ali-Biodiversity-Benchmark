export const TRANSLATIONS: Record<string, string> = {
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
