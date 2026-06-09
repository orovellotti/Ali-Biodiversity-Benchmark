import { useState, useEffect } from "react";
import { Sun, Moon, Printer, RefreshCw } from "lucide-react";

const CONTROL_CLASS =
  "flex items-center justify-center w-[30px] h-[30px] rounded-md bg-secondary text-secondary-foreground/80 hover:bg-secondary/70 transition-colors disabled:opacity-50";

export function DarkModeToggle() {
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
      aria-label="Basculer le mode sombre"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

export function PrintButton({ disabled }: { disabled?: boolean }) {
  return (
    <button
      onClick={() => window.print()}
      disabled={disabled}
      className={CONTROL_CLASS}
      aria-label="Exporter en PDF"
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
      Actualiser
    </button>
  );
}
