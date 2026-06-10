import { useState, useEffect } from "react";
import { Sun, Moon, Printer, RefreshCw } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const CONTROL_CLASS =
  "flex items-center justify-center w-[30px] h-[30px] rounded-md bg-secondary text-secondary-foreground/80 hover:bg-secondary/70 transition-colors disabled:opacity-50";

export function DarkModeToggle() {
  const { tr } = useI18n();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setIsDark(true);
    }
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("theme", isDark ? "dark" : "light");
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark((d) => !d)}
      className={CONTROL_CLASS}
      aria-label={tr("Basculer le mode sombre", "Toggle dark mode")}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <button
      onClick={() => setLang(lang === "fr" ? "en" : "fr")}
      className="flex items-center justify-center min-w-[34px] h-[30px] px-2 rounded-md bg-secondary text-secondary-foreground/80 hover:bg-secondary/70 transition-colors text-[12px] font-mono font-medium uppercase tracking-wide"
      aria-label={lang === "fr" ? "Switch to English" : "Passer en français"}
      title={lang === "fr" ? "Switch to English" : "Passer en français"}
    >
      {lang === "fr" ? "EN" : "FR"}
    </button>
  );
}

export function PrintButton({ disabled }: { disabled?: boolean }) {
  const { tr } = useI18n();
  return (
    <button
      onClick={() => window.print()}
      disabled={disabled}
      className={CONTROL_CLASS}
      aria-label={tr("Exporter en PDF", "Export to PDF")}
    >
      <Printer className="w-4 h-4" />
    </button>
  );
}

export function RefreshButton({
  onClick,
  loading,
}: {
  onClick: () => void;
  loading: boolean;
}) {
  const { tr } = useI18n();
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    if (loading) {
      setIsSpinning(true);
      return;
    }
    const t = setTimeout(() => setIsSpinning(false), 600);
    return () => clearTimeout(t);
  }, [loading]);

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center gap-1.5 px-2.5 h-[30px] rounded-md bg-secondary text-secondary-foreground/80 hover:bg-secondary/70 transition-colors disabled:opacity-50 text-[12px]"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin" : ""}`} />
      {tr("Actualiser", "Refresh")}
    </button>
  );
}
