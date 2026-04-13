import type { Instance, HighlightItem, HLColor, Anchor } from "../types";
import { getScrollCtx } from "../dom/scroll";
import { getActiveSlideId, shouldFilterBySlide, slideIdFromNode, ensureItemSlide } from "../slides";
import { nodeToPath, trimRangeWhitespace } from "../dom/ranges";
import { packedRectsFromRange } from "../dom/rects";
import { CONTENT_WIN, CONTENT_DOC } from "../dom/context";

function isForbiddenTarget(node: Node): boolean {
  const el = (node && node.nodeType === 1) ? node as Element : (node as Node & { parentElement: Element | null }).parentElement;
  if (!el) return false;
  return !!el.closest("input, textarea, select, button, a, code, pre, .hlq-proxy");
}

export function ensureScopeIds(): void {
  const scopes = Array.from(CONTENT_DOC.querySelectorAll(".markerquiz"));
  for (let i = 0; i < scopes.length; i++) {
    const s = scopes[i] as HTMLElement;
    if (!s.dataset.hlScope) s.dataset.hlScope = "S" + (i + 1);
  }
}

export function scopeIdFromNode(node: Node): string {
  ensureScopeIds();
  const el = (node && node.nodeType === 1) ? node as Element : (node as Node & { parentElement: Element | null }).parentElement;
  const s = el?.closest?.(".markerquiz") as HTMLElement | null;
  return (s && s.dataset.hlScope) ? s.dataset.hlScope : "global";
}

export function addHighlightFromSelection(I: Instance, renderFn: () => void): void {
  const sel = CONTENT_WIN.getSelection ? CONTENT_WIN.getSelection() : null;
  if (!sel || sel.rangeCount === 0) return;

  const range0 = sel.getRangeAt(0);
  if (!range0 || range0.collapsed) return;

  if (isForbiddenTarget(range0.startContainer) || isForbiddenTarget(range0.endContainer)) return;

  ensureScopeIds();
  const scopeId = scopeIdFromNode(range0.commonAncestorContainer);

  const range = range0.cloneRange();

  if (!trimRangeWhitespace(range)) {
    try { sel.removeAllRanges(); } catch(e){}
    return;
  }

  const packed = packedRectsFromRange(range);
  if (!packed.length) {
    try { sel.removeAllRanges(); } catch(e){}
    return;
  }

  const anchor: Anchor = {
    sp: nodeToPath(range.startContainer),
    so: range.startOffset,
    ep: nodeToPath(range.endContainer),
    eo: range.endOffset
  };

  const slideId =
    (typeof getActiveSlideId === "function" && getActiveSlideId()) ||
    slideIdFromNode(range.commonAncestorContainer);

  I.HL.push({
    id: I.nextId++,
    kind: "user",
    scope: scopeId,
    slide: slideId || "global",
    color: I.state.color as HLColor,
    anchor,
    rects: packed
  });

  try { sel.removeAllRanges(); } catch(e){}
  renderFn();
}

export function findUserHighlightAtPoint(I: Instance, clientX: number, clientY: number): HighlightItem | null {
  const S = getScrollCtx();
  const x = (clientX - S.ox) + S.sx;
  const y = (clientY - S.oy) + S.sy;

  const activeSlide = shouldFilterBySlide() ? getActiveSlideId() : null;

  for (let i = I.HL.length - 1; i >= 0; i--) {
    const item = I.HL[i];
    if (!item) continue;
    if ((item.kind || "user") !== "user") continue;
    if (activeSlide && (item.slide || "global") !== activeSlide) continue;

    for (const r of (item.rects || [])) {
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return item;
    }
  }

  return null;
}

export function clearSlide(I: Instance): void {
  for (const it of I.HL) ensureItemSlide(it);

  const removableKinds = new Set(["user", "solution"]);

  if (shouldFilterBySlide()) {
    const sid = getActiveSlideId();
    if (sid) {
      I.HL = I.HL.filter(it => {
        const sameSlide = (it.slide || "global") === sid;
        if (!sameSlide) return true;
        return !removableKinds.has(it.kind || "user");
      });
    } else {
      I.HL = I.HL.filter(it => !removableKinds.has(it.kind || "user"));
    }
  } else {
    I.HL = I.HL.filter(it => !removableKinds.has(it.kind || "user"));
  }
}
