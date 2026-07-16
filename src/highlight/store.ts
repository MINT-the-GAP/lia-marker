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

function isWordChar(ch: string): boolean {
  return /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſƀ-ɏЀ-ӿ'’-]/.test(ch);
}

function elementFromNode(node: Node | null): Element | null {
  if (!node) return null;
  if (node.nodeType === 1) return node as Element;
  return (node as Node & { parentElement: Element | null }).parentElement;
}

function textPointsFromSelection(sel: Selection): Array<{ node: Text; offset: number }> {
  const pickFrom = (node: Node | null, offset: number): { node: Text; offset: number } | null => {
    if (!node) return null;
    if (node.nodeType === 3) {
      const t = node as Text;
      const len = (t.data || "").length;
      return { node: t, offset: Math.max(0, Math.min(offset, len)) };
    }

    if (node.nodeType !== 1) return null;
    const el = node as Element;
    const kids = el.childNodes;
    if (!kids.length) return null;

    const idx = Math.max(0, Math.min(offset, kids.length - 1));
    const direct = kids[idx];
    if (direct && direct.nodeType === 3) {
      const t = direct as Text;
      return { node: t, offset: Math.max(0, Math.min(t.data.length, 0)) };
    }

    const tw = CONTENT_DOC.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const first = tw.nextNode();
    if (first && first.nodeType === 3) {
      const t = first as Text;
      return { node: t, offset: 0 };
    }

    return null;
  };

  const out: Array<{ node: Text; offset: number }> = [];
  const seen = new Set<Node>();

  const a = pickFrom(sel.anchorNode, sel.anchorOffset);
  if (a && !seen.has(a.node)) {
    out.push(a);
    seen.add(a.node);
  }

  const b = pickFrom(sel.focusNode, sel.focusOffset);
  if (b && !seen.has(b.node)) {
    out.push(b);
    seen.add(b.node);
  }

  return out;
}

function recoverWordRangeFromSelection(sel: Selection): Range | null {
  const points = textPointsFromSelection(sel);
  if (!points.length) return null;

  const tryPoint = (p: { node: Text; offset: number }): Range | null => {
    const text = p.node.data || "";
    if (!text) return null;

    let i = Math.max(0, Math.min(p.offset, text.length - 1));
    if (!isWordChar(text[i]) && i > 0 && isWordChar(text[i - 1])) i = i - 1;
    if (!isWordChar(text[i])) return null;

    let s = i;
    let e = i + 1;
    while (s > 0 && isWordChar(text[s - 1])) s--;
    while (e < text.length && isWordChar(text[e])) e++;
    if (e <= s) return null;

    const r = CONTENT_DOC.createRange();
    try {
      r.setStart(p.node, s);
      r.setEnd(p.node, e);
      if (r.collapsed) return null;
      return r;
    } catch (e) {
      return null;
    }
  };

  // Prefer candidates outside forbidden interactive areas first.
  for (const p of points) {
    if (isForbiddenTarget(p.node)) continue;
    const r = tryPoint(p);
    if (r) return r;
  }

  // Fallback: accept forbidden candidates if nothing else is available.
  for (const p of points) {
    const r = tryPoint(p);
    if (r) return r;
  }

  return null;
}

function recoverWordRangeFromTargetElement(el: Element): Range | null {
  const tw = CONTENT_DOC.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      const pe = (node as Text).parentElement;
      if (!pe) return NodeFilter.FILTER_REJECT;
      if (pe.closest("[hidden], .hlq-proxy")) return NodeFilter.FILTER_REJECT;
      const txt = (node.nodeValue || "").trim();
      if (!txt) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });

  const wordRe = /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſƀ-ɏЀ-ӿ]+(?:[’'][A-Za-zÀ-ÖØ-öø-ÿĀ-ſƀ-ɏЀ-ӿ]+)*/g;
  let n: Node | null;
  while ((n = tw.nextNode())) {
    const t = n as Text;
    const txt = t.data || "";
    const m = wordRe.exec(txt);
    wordRe.lastIndex = 0;
    if (!m) continue;
    const s = m.index;
    const e = s + m[0].length;
    const r = CONTENT_DOC.createRange();
    try {
      r.setStart(t, s);
      r.setEnd(t, e);
      if (!r.collapsed) return r;
    } catch (e) {
      // continue searching
    }
  }

  return null;
}

function recoverWordRangeFromClosestTarget(range0: Range, sel: Selection): Range | null {
  const candidates: Array<Node | null> = [
    range0.startContainer,
    range0.endContainer,
    sel.anchorNode,
    sel.focusNode
  ];

  const visited = new Set<Element>();
  for (const node of candidates) {
    const host = elementFromNode(node);
    const target = host?.closest?.(".lia-hl-target") as Element | null;
    if (!target || visited.has(target)) continue;
    visited.add(target);
    const r = recoverWordRangeFromTargetElement(target);
    if (r) return r;
  }

  return null;
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
  if (!range0) return;

  const allowCollapsedRecover = Date.now() <= Number((I as any).__markDblClickPendingUntil || 0);

  let range: Range | null = null;
  if (!range0.collapsed) {
    range = range0.cloneRange();
  } else if (allowCollapsedRecover) {
    range = recoverWordRangeFromSelection(sel) || recoverWordRangeFromClosestTarget(range0, sel);
  }
  if (!range) return;

  // Recovery was consumed; do not keep stale dblclick allowance around.
  if (allowCollapsedRecover) (I as any).__markDblClickPendingUntil = 0;

  const touchesForbidden = isForbiddenTarget(range.startContainer) || isForbiddenTarget(range.endContainer);
  if (touchesForbidden) {
    const recovered = recoverWordRangeFromSelection(sel) || recoverWordRangeFromClosestTarget(range0, sel);
    if (!recovered) return;
    range = recovered;
    if (isForbiddenTarget(range.startContainer) || isForbiddenTarget(range.endContainer)) return;
  }

  ensureScopeIds();
  const scopeId = scopeIdFromNode(range.commonAncestorContainer);

  if (!trimRangeWhitespace(range)) {
    const recovered = recoverWordRangeFromSelection(sel) || recoverWordRangeFromClosestTarget(range0, sel);
    if (!recovered || !trimRangeWhitespace(recovered)) {
      try { sel.removeAllRanges(); } catch(e){}
      return;
    }
    range = recovered;
  }

  let packed = packedRectsFromRange(range);
  if (!packed.length) {
    const recovered = recoverWordRangeFromSelection(sel) || recoverWordRangeFromClosestTarget(range0, sel);
    if (recovered && trimRangeWhitespace(recovered)) {
      range = recovered;
      packed = packedRectsFromRange(range);
    }
  }
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

  const alreadyExists = I.HL.some((it) =>
    it.kind === "user" &&
    it.color === (I.state.color as HLColor) &&
    it.scope === scopeId &&
    it.anchor &&
    it.anchor.sp === anchor.sp &&
    it.anchor.so === anchor.so &&
    it.anchor.ep === anchor.ep &&
    it.anchor.eo === anchor.eo
  );
  if (alreadyExists) {
    try { sel.removeAllRanges(); } catch(e){}
    return;
  }

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
    if (item.kind !== "user") continue;
    if (activeSlide && item.slide !== activeSlide) continue;

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
        const sameSlide = it.slide === sid;
        if (!sameSlide) return true;
        return !removableKinds.has(it.kind);
      });
    } else {
      I.HL = I.HL.filter(it => !removableKinds.has(it.kind));
    }
  } else {
    I.HL = I.HL.filter(it => !removableKinds.has(it.kind));
  }
}
