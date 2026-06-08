import { useState, useEffect } from "react";
import { Sun, Moon, Printer, RefreshCw } from "lucide-react";

export function DarkModeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // initialize from local storage if available
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
      className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors"
      style={{
        backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2",
        color: isDark ? "#c8c9cc" : "#4b5563",
      }}
      aria-label="Basculer le mode sombre"
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
  );
}

export function PrintButton({ disabled }: { disabled?: boolean }) {
  const isDark = document.documentElement.classList.contains("dark");
  return (
    <button
      onClick={() => window.print()}
      disabled={disabled}
      className="flex items-center justify-center w-[26px] h-[26px] rounded-[6px] transition-colors disabled:opacity-50"
      style={{
        backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2",
        color: isDark ? "#c8c9cc" : "#4b5563",
      }}
      aria-label="Exporter en PDF"
    >
      <Printer className="w-3.5 h-3.5" />
    </button>
  );
}

export function RefreshButton({ onClick, loading }: { onClick: () => void; loading: boolean }) {
  const [isSpinning, setIsSpinning] = useState(false);
  const isDark = document.documentElement.classList.contains("dark");

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
      className="flex items-center gap-1 px-2 h-[26px] rounded-[6px] text-[12px] hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-50"
      style={{
        backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "#F0F1F2",
        color: isDark ? "#c8c9cc" : "#4b5563",
      }}
    >
      <RefreshCw className={`w-3.5 h-3.5 ${isSpinning ? "animate-spin" : ""}`} />
      Actualiser
    </button>
  );
}
