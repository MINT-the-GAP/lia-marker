import { CONTENT_DOC } from "../dom/context";
import { ensureScopeIds } from "../highlight/store";
import type { Instance, Rect } from "../types";
import { nodeToPath, rangeFromAnchor } from "../dom/ranges";
import { packedRectsFromRange, mergeRectsToLines } from "../dom/rects";
import { recalcAllHighlights } from "../highlight/render";
import { getActiveSlideId, slideIdFromNode } from "../slides";

const HLQ_OK    = 0.95;
const HLQ_WRONG = 0.10;
const HLQ_PREC  = 0.55;
const HLQ_PAD   = 2;
const HLQ_EXTRA_OUT_FRAC = 0.22;
const HLQ_EXTRA_OUT_ABS  = 80;

export function rectArea(rs: Rect[]): number {
  return (rs || []).reduce((a, r) => a + Math.max(0, r.w) * Math.max(0, r.h), 0);
}

function interArea(a: Rect, b: Rect): number {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const w = x2 - x1, h = y2 - y1;
  return (w > 0 && h > 0) ? w * h : 0;
}

function expandRect(r: Rect, p: number): Rect {
  return { x: r.x - p, y: r.y - p, w: r.w + 2 * p, h: r.h + 2 * p };
}

function interSum(targetRects: Rect[], userRects: Rect[]): number {
  let inter = 0;
  for (const tr of (targetRects || [])) for (const ur of (userRects || [])) inter += interArea(tr, ur);
  return inter;
}

export function subsetRectsByTarget(userRects: Rect[], targetRects: Rect[], pad = HLQ_PAD): Rect[] {
  const out: Rect[] = [];
  const tExp = (targetRects || []).map(r => expandRect(r, pad));
  for (const ur of (userRects || [])) {
    if (tExp.some(tr => interArea(tr, ur) > 0)) out.push(ur);
  }
  return out;
}

function splitRangeOnWhitespace(range: Range): Range[] {
  // Split a range into multiple ranges, one for each non-whitespace sequence.
  // This allows "Highlight this, using any color." to match individual word markups.
  
  if (!range || range.collapsed) return [];
  
  const root = range.commonAncestorContainer.nodeType === 1
    ? range.commonAncestorContainer as Element
    : range.commonAncestorContainer.parentNode as Element;
  
  if (!root) return [range];
  
  const WS = (ch: string) =>
    ch === " "  || ch === "\t" || ch === "\n" || ch === "\r" ||
    ch === "\u00A0" || ch === "\u2009" || ch === "\u202F";
  
  const tw = CONTENT_DOC.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      try {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      } catch(e) {
        return NodeFilter.FILTER_REJECT;
      }
    }
  });
  
  const segs: { node: Node; s: number; e: number; text: string }[] = [];
  let n: Node | null;
  while ((n = tw.nextNode())) {
    const text = n.nodeValue || "";
    if (!text.length) continue;
    
    let s = 0;
    let e = text.length;
    
    if (n === range.startContainer) s = range.startOffset;
    if (n === range.endContainer)   e = range.endOffset;
    
    s = Math.max(0, Math.min(s, text.length));
    e = Math.max(0, Math.min(e, text.length));
    if (e <= s) continue;
    
    segs.push({ node: n, s, e, text: text.slice(s, e) });
  }
  
  if (!segs.length) return [range];
  
  const results: Range[] = [];
  let inNonWS = false;
  let segStart: { node: Node; offset: number } | null = null;
  
  for (let si = 0; si < segs.length; si++) {
    const seg = segs[si];
    const t = seg.text;
    
    for (let ci = 0; ci < t.length; ci++) {
      const isWS = WS(t[ci]);
      
      if (!isWS && !inNonWS) {
        // Start of non-whitespace sequence
        inNonWS = true;
        segStart = { node: seg.node, offset: seg.s + ci };
      } else if (isWS && inNonWS) {
        // End of non-whitespace sequence
        inNonWS = false;
        if (segStart) {
          const r = CONTENT_DOC.createRange();
          try {
            r.setStart(segStart.node, segStart.offset);
            r.setEnd(seg.node, seg.s + ci);
            if (!r.collapsed) results.push(r);
          } catch(e) {}
          segStart = null;
        }
      }
    }
  }
  
  // Handle final non-whitespace sequence
  if (inNonWS && segStart) {
    const lastSeg = segs[segs.length - 1];
    const r = CONTENT_DOC.createRange();
    try {
      r.setStart(segStart.node, segStart.offset);
      r.setEnd(lastSeg.node, lastSeg.s + lastSeg.text.length);
      if (!r.collapsed) results.push(r);
    } catch(e) {}
  }
  
  return results.length > 0 ? results : [range];
}

export function collectTargetsInScope(scopeEl: Element | null): { el: Element; color: string; anchor: ReturnType<typeof nodeToPath> extends string ? any : any }[] {
  const root = scopeEl || CONTENT_DOC;
  const els = Array.from((root as Element | Document).querySelectorAll(".lia-hl-target[data-hl-expected]"));

  const result: { el: Element; color: string; anchor: any }[] = [];
  
  for (const el of els) {
    const color = el.getAttribute("data-hl-expected") || "yellow";
    const r = CONTENT_DOC.createRange();
    r.selectNodeContents(el);
    
    // Split the range into non-whitespace sequences
    const splitRanges = splitRangeOnWhitespace(r);
    
    for (const range of splitRanges) {
      const anchor = {
        sp: nodeToPath(range.startContainer),
        so: range.startOffset,
        ep: nodeToPath(range.endContainer),
        eo: range.endOffset
      };
      result.push({ el, color, anchor });
    }
  }
  
  return result;
}


export function hlqActiveSlideId(scopeEl: Element | null): string {
  try { return slideIdFromNode(scopeEl as Node) || "global"; } catch(e){}
  try { return getActiveSlideId() || "global"; } catch(e){}
  return "global";
}

export function mergedUserRects(
  I: Instance,
  scopeId: string,
  slideId: string,
  mode: "all" | "only" | "except",
  refColor?: string
): Rect[] {
  const out: Rect[] = [];
  const OPT = { yTol: 4, gapTol: 12, minW: 2, minH: 2, padX: 0, padY: 0 };

  for (const h of I.HL) {
    if (h.kind !== "user") continue;
    if (h.scope !== scopeId) continue;
    if (h.slide !== slideId) continue;
    if (mode === "only"   && h.color !== refColor) continue;
    if (mode === "except" && h.color === refColor) continue;

    const rs = h.rects;
    if (!rs.length) continue;

    out.push(...mergeRectsToLines(rs, OPT));
  }

  return out;
}

export function matchTarget(
  I: Instance,
  scopeId: string,
  slideId: string,
  expectedColor: string,
  targetRects: Rect[]
): { pass: boolean; sGood: number; sBad: number; sPrec: number } {
  const wantAny = (expectedColor === "any" || expectedColor === "*" || !expectedColor);

  const goodAll  = wantAny
    ? mergedUserRects(I, scopeId, slideId, "all")
    : mergedUserRects(I, scopeId, slideId, "only", expectedColor);

  const goodNear = subsetRectsByTarget(goodAll, targetRects, HLQ_PAD);
  const tA = rectArea(targetRects);
  const uA = rectArea(goodNear);
  const inter = (tA > 0 && uA > 0) ? interSum(targetRects, goodNear) : 0;

  const sGood = (tA > 0) ? (inter / tA) : 0;
  const sPrec = (uA > 0) ? (inter / uA) : 0;

  if (wantAny) return { pass: (sGood >= HLQ_OK) && (sPrec >= HLQ_PREC), sGood, sBad: 0, sPrec };

  const badAll  = mergedUserRects(I, scopeId, slideId, "except", expectedColor);
  const badNear = subsetRectsByTarget(badAll, targetRects, HLQ_PAD);
  const badInter = (tA > 0) ? interSum(targetRects, badNear) : 0;
  const sBad = (tA > 0) ? (badInter / tA) : 0;

  const pass = (sGood >= HLQ_OK) && (sPrec >= HLQ_PREC) && (sBad <= HLQ_WRONG);
  return { pass, sGood, sBad, sPrec };
}

export function evalScope(
  I: Instance,
  scopeEl: Element | null
): { ok: number; total: number; pass: boolean; badColor: number; tooWide: number; extra: number } {
  ensureScopeIds();
  const scopeId = (scopeEl as HTMLElement | null)?.dataset?.hlScope || "global";
  const slideId = hlqActiveSlideId(scopeEl);

  const targets = collectTargetsInScope(scopeEl);
  if (!targets.length) return { ok: 0, total: 0, pass: false, badColor: 0, tooWide: 0, extra: 0 };

  recalcAllHighlights(I);

  const allTargetRects: Rect[] = [];
  let ok = 0, badColor = 0, tooWide = 0;

  for (const t of targets) {
    const r = rangeFromAnchor(t.anchor);
    if (!r) continue;

    const tRects = packedRectsFromRange(r);
    if (tRects?.length) allTargetRects.push(...tRects);

    const m = matchTarget(I, scopeId, slideId, t.color, tRects);
    if (m.sBad  > HLQ_WRONG) badColor++;
    if (m.sPrec < HLQ_PREC)  tooWide++;
    if (m.pass) ok++;
  }

  let extra = 0;
  const allTargetRectsExp = allTargetRects.map(r => expandRect(r, HLQ_PAD));

  for (const h of I.HL) {
    if (h.kind !== "user") continue;
    if (h.scope !== scopeId) continue;
    if (h.slide !== slideId) continue;
    if (!h.rects.length) continue;

    const uA = rectArea(h.rects);
    if (uA <= 0) continue;

    const inter = interSum(allTargetRectsExp, h.rects);
    if (inter <= 0) { extra++; continue; }

    const outA    = Math.max(0, uA - inter);
    const outFrac = outA / uA;
    if (outA > HLQ_EXTRA_OUT_ABS && outFrac > HLQ_EXTRA_OUT_FRAC) extra++;
  }

  const pass = (ok === targets.length) && (badColor === 0) && (tooWide === 0) && (extra === 0);
  return { ok, total: targets.length, pass, badColor, tooWide, extra };
}
