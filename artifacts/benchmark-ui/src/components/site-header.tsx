import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Leaf } from "lucide-react";
import { DarkModeToggle, LanguageToggle } from "@/components/controls";
import { useI18n } from "@/lib/i18n";

export function SiteHeader({
  children,
  maxWidth = "max-w-[1280px]",
}: {
  children?: ReactNode;
  maxWidth?: string;
}) {
  const [loc] = useLocation();
  const { tr } = useI18n();

  const nav = [
    { href: "/", label: tr("Démarche", "About") },
    { href: "/resultats", label: tr("Résultats", "Results") },
    { href: "/questions", label: tr("Questions", "Questions") },
    { href: "/arena", label: tr("Arène", "Arena") },
    { href: "/console", label: tr("Console", "Console") },
    { href: "/contact", label: tr("Contact", "Contact") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md print:hidden">
      <div
        className={`${maxWidth} mx-auto px-6 h-16 flex items-center justify-between gap-4`}
      >
        <Link
          href="/"
          className="flex items-center gap-2.5 shrink-0"
          aria-label={tr("Accueil", "Home")}
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-md bg-primary text-primary-foreground">
            <Leaf className="w-4 h-4" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-[15px] font-semibold tracking-tight">
              ALI Biodiversity Benchmark
            </span>
            <span className="text-[9px] uppercase tracking-[0.28em] text-muted-foreground font-mono mt-1">
              {tr("carnet de terrain", "field notebook")}
            </span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          {nav.map((item) => {
            const active =
              item.href === "/" ? loc === "/" : loc.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? "text-foreground font-medium bg-secondary"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          {children}
          <LanguageToggle />
          <DarkModeToggle />
        </div>
      </div>
    </header>
  );
}
