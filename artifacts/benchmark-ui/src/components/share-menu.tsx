import type { ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/lib/i18n";
import { Share2, Link2 } from "lucide-react";

export function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z" />
    </svg>
  );
}

export function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.945C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.078 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413z" />
    </svg>
  );
}

export interface ShareMenuProps {
  /** Absolute URL to share. */
  url: string;
  /** Pre-composed share text (caller handles bilingual wording). */
  text: string;
  /** Title used by the native share sheet. */
  title?: string;
  /** Custom trigger element. Falls back to a "Share" text button. */
  trigger?: ReactNode;
  align?: "start" | "center" | "end";
}

/**
 * Reusable social share menu — native Web Share API (when available), X,
 * LinkedIn, Facebook, WhatsApp intent links, and copy-to-clipboard. No server
 * work; intent links pre-fill the post text. Shared by the Questions browser
 * and the run results page.
 */
export function ShareMenu({
  url,
  text,
  title = "ALI Biodiversity Benchmark",
  trigger,
  align = "start",
}: ShareMenuProps) {
  const { tr } = useI18n();

  const openIntent = (href: string) =>
    window.open(href, "_blank", "noopener,noreferrer");

  const nativeShareSupported =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title, text, url });
    } catch {
      /* user cancelled or unsupported — ignore */
    }
  };

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast({
        title: tr("Lien copié", "Link copied"),
        description: tr(
          "Le lien a été copié dans le presse-papiers.",
          "The link has been copied to your clipboard.",
        ),
      });
    } catch {
      toast({ title: tr("Échec de la copie", "Copy failed"), description: url });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <Share2 className="w-3.5 h-3.5" />
            {tr("Partager", "Share")}
          </button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-52">
        {nativeShareSupported && (
          <>
            <DropdownMenuItem onClick={handleNativeShare}>
              <Share2 className="w-4 h-4" />
              {tr("Partager…", "Share…")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem
          onClick={() =>
            openIntent(
              `https://twitter.com/intent/tweet?text=${encodeURIComponent(
                text,
              )}&url=${encodeURIComponent(url)}`,
            )
          }
        >
          <XIcon className="w-4 h-4" />
          {tr("Partager sur X", "Share on X")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openIntent(
              `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                url,
              )}`,
            )
          }
        >
          <LinkedInIcon className="w-4 h-4" />
          {tr("Partager sur LinkedIn", "Share on LinkedIn")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openIntent(
              `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                url,
              )}`,
            )
          }
        >
          <FacebookIcon className="w-4 h-4" />
          {tr("Partager sur Facebook", "Share on Facebook")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            openIntent(
              `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
            )
          }
        >
          <WhatsAppIcon className="w-4 h-4" />
          {tr("Partager sur WhatsApp", "Share on WhatsApp")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleCopy}>
          <Link2 className="w-4 h-4" />
          {tr("Copier le lien", "Copy link")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
