import type { Rect } from "../types";
import { CONTENT_WIN, CONTENT_DOC } from "./context";
import { getScrollCtx } from "./scroll";

interface MergeOpts {
  yTol?: number;
  gapTol?: number;
  minW?: number;
  minH?: number;
  padX?: number;
  padY?: number;
}

export function mergeRectsToLines(rects: Rect[], opt?: MergeOpts): Rect[] {
  const yTol   = opt?.yTol   ?? 4;
  const gapTol = opt?.gapTol ?? 10;
  const minW   = opt?.minW   ?? 2;
  const minH   = opt?.minH   ?? 2;
  const padX   = opt?.padX   ?? 0;
  const padY   = opt?.padY   ?? 0;

  const a = rects.slice().sort((r1, r2) => (r1.y - r2.y) || (r1.x - r2.x));

  const lines: { cy: number; rects: Rect[] }[] = [];
  for (const r of a) {
    const cy = r.y + r.h / 2;
    let line: { cy: number; rects: Rect[] } | null = null;

    for (let i = lines.length - 1; i >= 0; i--) {
      const L = lines[i];
      if (Math.abs(cy - L.cy) <= yTol) {
        line = L;
        break;
      }
      if (cy < L.cy - (yTol * 2)) break;
    }

    if (!line) {
      line = { cy, rects: [] };
      lines.push(line);
    }
    line.rects.push(r);
    line.cy = (line.cy * (line.rects.length - 1) + cy) / line.rects.length;
  }

  const merged: Rect[] = [];
  for (const L of lines) {
    const rs = L.rects.sort((r1, r2) => r1.x - r2.x);
    let cur: { x1: number; x2: number; y1: number; y2: number } | null = null;

    for (const r of rs) {
      const x1 = r.x, x2 = r.x + r.w, y1 = r.y, y2 = r.y + r.h;

      if (!cur) { cur = { x1, x2, y1, y2 }; continue; }

      if (x1 <= cur.x2 + gapTol) {
        cur.x2 = Math.max(cur.x2, x2);
        cur.y1 = Math.min(cur.y1, y1);
        cur.y2 = Math.max(cur.y2, y2);
      } else {
        const w = cur.x2 - cur.x1, h = cur.y2 - cur.y1;
        if (w >= minW && h >= minH) {
          merged.push({ x: cur.x1 - padX, y: cur.y1 - padY, w: w + 2 * padX, h: h + 2 * padY });
        }
        cur = { x1, x2, y1, y2 };
      }
    }

    if (cur) {
      const w = cur.x2 - cur.x1, h = cur.y2 - cur.y1;
      if (w >= minW && h >= minH) {
        merged.push({ x: cur.x1 - padX, y: cur.y1 - padY, w: w + 2 * padX, h: h + 2 * padY });
      }
    }
  }

  return merged;
}

export function packedRectsFromRange(range: Range): Rect[] {
  const rects = Array.from(range.getClientRects ? range.getClientRects() : []);
  if (!rects.length) return [];

  const S = getScrollCtx();

  const raw = rects
    .filter(r => r.width > 0.5 && r.height > 0.5)
    .map(r => ({
      x: (r.left - S.ox) + S.sx,
      y: (r.top  - S.oy) + S.sy,
      w: r.width,
      h: r.height
    }));

  if (!raw.length) return [];

  return mergeRectsToLines(raw, { yTol: 4, gapTol: 10, minW: 2, minH: 2, padX: 0, padY: 0 });
}

export function getViewportRect(): { left: number; top: number; right: number; bottom: number; w: number; h: number } {
  const w = CONTENT_WIN.innerWidth  || CONTENT_DOC.documentElement.clientWidth  || 0;
  const h = CONTENT_WIN.innerHeight || CONTENT_DOC.documentElement.clientHeight || 0;
  return { left: 0, top: 0, right: w, bottom: h, w, h };
}

export function interAreaDOMRect(r: DOMRect, vp: { left: number; top: number; right: number; bottom: number }): number {
  const x1 = Math.max(r.left, vp.left);
  const y1 = Math.max(r.top,  vp.top);
  const x2 = Math.min(r.right, vp.right);
  const y2 = Math.min(r.bottom, vp.bottom);
  const w = x2 - x1, h = y2 - y1;
  return (w > 0 && h > 0) ? (w * h) : 0;
}
