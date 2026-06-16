// Generates a branded PNG "share card" of a benchmark run's leaderboard summary,
// drawn entirely on a <canvas> so it is self-contained (no external fonts/CORS
// or DOM-to-image quirks) and renders identically in FR and EN. The card is
// always drawn in the light "papier de terrain" palette for consistent branding
// regardless of the UI theme. Callers pass pre-localized strings so this module
// stays free of i18n concerns.

export interface ShareCardModel {
  rank?: number | null;
  model: string;
  provider: string;
  meanRank?: number | null;
  overallScore?: number | null;
}

export interface ShareCardData {
  /** Small uppercase eyebrow, e.g. "BIODIVERSITY BENCHMARK". */
  eyebrow: string;
  /** Brand title, e.g. "ALI Biodiversity Benchmark". */
  title: string;
  /** One-line stats summary, e.g. "8 AI models · 50 questions · judge: gpt-4o". */
  statsLine: string;
  /** Winner highlight (omitted when the run was not judged). */
  winnerLabel: string | null;
  winnerName: string | null;
  winnerSub: string | null;
  /** Ranking section eyebrow, e.g. "Model ranking". */
  rankingTitle: string;
  meanRankLabel: string;
  scoreLabel: string;
  /** Whether to draw the overall-score column (false for non-judged runs). */
  showScore: boolean;
  /** Top-N models, already ordered best-first. */
  models: ShareCardModel[];
  /** Footer line (date + url). */
  footer: string;
  /** Download filename (without forcing extension). */
  filename: string;
}

// Light "papier de terrain" palette (mirrors :root in index.css).
const COLORS = {
  paper: "hsl(42, 34%, 95%)",
  card: "hsl(44, 44%, 98%)",
  fg: "hsl(155, 28%, 13%)",
  primary: "hsl(155, 48%, 24%)",
  primaryFg: "hsl(44, 44%, 98%)",
  primarySoft: "hsla(155, 48%, 24%, 0.08)",
  primaryBorder: "hsla(155, 48%, 24%, 0.30)",
  muted: "hsl(42, 20%, 90%)",
  mutedFg: "hsl(150, 12%, 40%)",
  ochre: "hsl(30, 84%, 32%)",
  border: "hsla(155, 28%, 13%, 0.12)",
  dot: "hsla(155, 48%, 24%, 0.06)",
};

const FONT_SERIF = "'Fraunces', Georgia, serif";
const FONT_SANS = "'Inter', system-ui, sans-serif";
const FONT_MONO =
  "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace";

const WIDTH = 1200;
const PAD = 64;
const ROW_H = 76;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function setLetterSpacing(ctx: CanvasRenderingContext2D, px: number) {
  // letterSpacing is supported in all evergreen browsers; ignore if absent.
  try {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${px}px`;
  } catch {
    /* noop */
  }
}

/** Compute the full canvas height for the given data. */
function computeHeight(data: ShareCardData): number {
  let h = PAD; // top padding
  h += 36; // eyebrow
  h += 70; // title
  h += 42; // stats line
  h += 28; // gap
  if (data.winnerName) {
    h += 128 + 28; // winner box + gap
  }
  h += 44; // ranking eyebrow
  h += data.models.length * ROW_H;
  h += 24; // gap
  h += 40; // footer
  h += PAD; // bottom padding
  return h;
}

function drawPaperDots(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  ctx.fillStyle = COLORS.dot;
  const step = 24;
  for (let y = step; y < h; y += step) {
    for (let x = step; x < w; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

export async function downloadShareCard(data: ShareCardData): Promise<void> {
  // Ensure brand fonts are ready so canvas text uses Fraunces/Inter, not a
  // fallback (otherwise the first generation can render with serif/sans-serif).
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      /* continue with fallbacks */
    }
  }

  const dpr = 2; // crisp on retina + large enough for social previews
  const height = computeHeight(data);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH * dpr;
  canvas.height = height * dpr;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.scale(dpr, dpr);
  ctx.textBaseline = "alphabetic";

  // Background paper + subtle dotted grid + outer hairline frame.
  ctx.fillStyle = COLORS.paper;
  ctx.fillRect(0, 0, WIDTH, height);
  drawPaperDots(ctx, WIDTH, height);
  ctx.fillStyle = COLORS.card;
  roundRect(ctx, 20, 20, WIDTH - 40, height - 40, 20);
  ctx.fill();
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 1.5;
  roundRect(ctx, 20, 20, WIDTH - 40, height - 40, 20);
  ctx.stroke();
  // Accent rule along the top edge of the card.
  ctx.fillStyle = COLORS.primary;
  roundRect(ctx, 20, 20, WIDTH - 40, 6, 3);
  ctx.fill();

  let y = PAD + 8;

  // Eyebrow
  ctx.fillStyle = COLORS.ochre;
  ctx.font = `600 18px ${FONT_MONO}`;
  setLetterSpacing(ctx, 2);
  ctx.fillText(data.eyebrow.toUpperCase(), PAD, y + 16);
  setLetterSpacing(ctx, 0);
  y += 44;

  // Title
  ctx.fillStyle = COLORS.fg;
  ctx.font = `600 50px ${FONT_SERIF}`;
  ctx.fillText(data.title, PAD, y + 40);
  y += 66;

  // Stats line
  ctx.fillStyle = COLORS.mutedFg;
  ctx.font = `400 24px ${FONT_SANS}`;
  ctx.fillText(data.statsLine, PAD, y + 24);
  y += 56;

  // Winner highlight
  if (data.winnerName) {
    const boxX = PAD;
    const boxW = WIDTH - PAD * 2;
    const boxH = 128;
    ctx.fillStyle = COLORS.primarySoft;
    roundRect(ctx, boxX, y, boxW, boxH, 16);
    ctx.fill();
    ctx.strokeStyle = COLORS.primaryBorder;
    ctx.lineWidth = 1.5;
    roundRect(ctx, boxX, y, boxW, boxH, 16);
    ctx.stroke();

    // Medal circle
    const cx = boxX + 56;
    const cy = y + boxH / 2;
    ctx.fillStyle = COLORS.primary;
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.primaryFg;
    ctx.font = `600 30px ${FONT_SERIF}`;
    ctx.textAlign = "center";
    ctx.fillText("1", cx, cy + 11);
    ctx.textAlign = "left";

    const tx = boxX + 108;
    if (data.winnerLabel) {
      ctx.fillStyle = COLORS.mutedFg;
      ctx.font = `500 18px ${FONT_SANS}`;
      ctx.fillText(data.winnerLabel, tx, y + 42);
    }
    ctx.fillStyle = COLORS.primary;
    ctx.font = `600 34px ${FONT_SERIF}`;
    ctx.fillText(data.winnerName, tx, y + 80);
    if (data.winnerSub) {
      ctx.fillStyle = COLORS.mutedFg;
      ctx.font = `400 19px ${FONT_SANS}`;
      ctx.fillText(data.winnerSub, tx, y + 108);
    }
    y += boxH + 28;
  }

  // Ranking eyebrow
  ctx.fillStyle = COLORS.mutedFg;
  ctx.font = `600 16px ${FONT_MONO}`;
  setLetterSpacing(ctx, 1.5);
  ctx.fillText(data.rankingTitle.toUpperCase(), PAD, y + 16);
  setLetterSpacing(ctx, 0);
  y += 44;

  // Column geometry (right-aligned metrics).
  const rightEdge = WIDTH - PAD;
  const scoreColRight = rightEdge;
  const rankColRight = data.showScore ? rightEdge - 170 : rightEdge;

  // Leaderboard rows
  data.models.forEach((m, i) => {
    const rowY = y + i * ROW_H;
    const isTop = i === 0;
    const midY = rowY + ROW_H / 2;

    if (isTop) {
      ctx.fillStyle = COLORS.primarySoft;
      roundRect(ctx, PAD - 12, rowY + 6, WIDTH - (PAD - 12) * 2, ROW_H - 12, 12);
      ctx.fill();
    } else if (i < data.models.length) {
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(PAD, rowY + ROW_H);
      ctx.lineTo(rightEdge, rowY + ROW_H);
      ctx.stroke();
    }

    // Rank badge
    const badgeR = 20;
    const badgeX = PAD + badgeR;
    ctx.fillStyle = isTop ? COLORS.primary : COLORS.muted;
    ctx.beginPath();
    ctx.arc(badgeX, midY, badgeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = isTop ? COLORS.primaryFg : COLORS.fg;
    ctx.font = `600 18px ${FONT_MONO}`;
    ctx.textAlign = "center";
    ctx.fillText(m.rank != null ? String(m.rank) : "—", badgeX, midY + 6);
    ctx.textAlign = "left";

    // Model name + provider
    const nameX = badgeX + badgeR + 22;
    ctx.fillStyle = COLORS.fg;
    ctx.font = `600 26px ${FONT_SANS}`;
    ctx.fillText(m.model, nameX, midY - 2);
    if (m.provider) {
      ctx.fillStyle = COLORS.mutedFg;
      ctx.font = `400 16px ${FONT_MONO}`;
      ctx.fillText(m.provider, nameX, midY + 22);
    }

    // Mean rank value
    ctx.textAlign = "right";
    ctx.fillStyle = COLORS.fg;
    ctx.font = `600 24px ${FONT_MONO}`;
    ctx.fillText(
      m.meanRank != null ? m.meanRank.toFixed(2) : "N/A",
      rankColRight,
      midY + 8,
    );

    // Overall score
    if (data.showScore) {
      ctx.fillStyle = m.overallScore != null ? COLORS.primary : COLORS.mutedFg;
      ctx.font = `600 24px ${FONT_MONO}`;
      ctx.fillText(
        m.overallScore != null ? m.overallScore.toFixed(1) : "—",
        scoreColRight,
        midY + 8,
      );
    }
    ctx.textAlign = "left";
  });
  y += data.models.length * ROW_H;

  // Column headers (drawn after rows so they sit just above, subtly).
  ctx.textAlign = "right";
  ctx.fillStyle = COLORS.mutedFg;
  ctx.font = `500 14px ${FONT_SANS}`;
  // (Header labels intentionally omitted to keep the card uncluttered; the
  // footer documents the metrics instead.)
  ctx.textAlign = "left";

  y += 20;

  // Footer
  ctx.fillStyle = COLORS.mutedFg;
  ctx.font = `400 18px ${FONT_SANS}`;
  ctx.fillText(data.footer, PAD, y + 18);
  // Metric legend, right-aligned.
  ctx.textAlign = "right";
  ctx.font = `400 16px ${FONT_SANS}`;
  const legend = data.showScore
    ? `${data.meanRankLabel} · ${data.scoreLabel}`
    : data.meanRankLabel;
  ctx.fillText(legend, rightEdge, y + 18);
  ctx.textAlign = "left";

  // Export
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/png"),
  );
  if (!blob) throw new Error("Failed to encode PNG");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = data.filename.endsWith(".png")
    ? data.filename
    : `${data.filename}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so the download has time to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
