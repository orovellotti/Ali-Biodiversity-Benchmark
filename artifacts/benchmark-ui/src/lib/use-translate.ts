import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { translateTexts } from "@workspace/api-client-react";
import { useI18n } from "./i18n";

// Keep each request comfortably under the server's hard limits (600 texts /
// 300k chars) so large datasets/runs are translated across several batches
// instead of being rejected.
const CHUNK_MAX_TEXTS = 200;
const CHUNK_MAX_CHARS = 200_000;

/** Small stable hash of the unique source list, for the React Query key. */
function hashList(items: string[]): string {
  let h = 0x811c9dc5;
  for (const s of items) {
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x0a;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16) + ":" + items.length;
}

function chunk(texts: string[]): string[][] {
  const chunks: string[][] = [];
  let current: string[] = [];
  let chars = 0;
  for (const t of texts) {
    if (
      current.length > 0 &&
      (current.length >= CHUNK_MAX_TEXTS || chars + t.length > CHUNK_MAX_CHARS)
    ) {
      chunks.push(current);
      current = [];
      chars = 0;
    }
    current.push(t);
    chars += t.length;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export interface TranslateMap {
  /** Translate a source string to the active language (identity when FR). */
  tr: (text: string | null | undefined) => string;
  /** True while English translations are still being fetched. */
  loading: boolean;
  /** True if the translation request failed (UI stays on French). */
  failed: boolean;
}

/**
 * Translate a batch of French source strings to English when the active
 * language is EN. French is the source of truth, so in FR mode this is a no-op
 * identity. Translations are cached server-side (permanent) and client-side
 * (React Query), and the original French text shows until EN data arrives.
 */
export function useTranslateMap(texts: (string | null | undefined)[]): TranslateMap {
  const { lang } = useI18n();

  const unique = useMemo(() => {
    const set = new Set<string>();
    for (const t of texts) {
      if (typeof t === "string" && t.trim() !== "") set.add(t);
    }
    return [...set];
  }, [texts]);

  const enabled = lang === "en" && unique.length > 0;
  const key = useMemo(() => hashList(unique), [unique]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["translate", "en", key],
    queryFn: async () => {
      const batches = chunk(unique);
      const results: string[] = [];
      for (const batch of batches) {
        const res = await translateTexts({ texts: batch, target: "en" });
        results.push(...res.translations);
      }
      return results;
    },
    enabled,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });

  const map = useMemo(() => {
    const m = new Map<string, string>();
    if (data) {
      unique.forEach((src, i) => {
        const out = data[i];
        if (out) m.set(src, out);
      });
    }
    return m;
  }, [data, unique]);

  return {
    tr: (text) => {
      if (!text) return "";
      if (lang !== "en") return text;
      return map.get(text) ?? text;
    },
    loading: enabled && isLoading,
    failed: enabled && isError,
  };
}
