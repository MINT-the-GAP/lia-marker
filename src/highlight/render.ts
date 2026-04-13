import { ROOT_WIN, ROOT_DOC, CONTENT_WIN, CONTENT_DOC } from "../dom/context";
// ROOT_DOC, CONTENT_WIN used in layoutSignature
import type { Instance } from "../types";
import { getScrollCtx } from "../dom/scroll";
import { packedRectsFromRange } from "../dom/rects";
import { rangeFromAnchor } from "../dom/ranges";
import { getSlideCandidates, ensureSlideIds, getActiveSlideId, shouldFilterBySlide, slideIdFromNode } from "../slides";

const DEBUG = false;
function dbg(...args: unknown[]): void {
  if (!DEBUG) return;
  try { console.log("[HLDBG]", ...args); } catch(e){}
}

export function drawRects(item: Instance["HL"][number], overlay: Element, S: ReturnType<typeof getScrollCtx>): void {
  for (const rr of item.rects) {
    const el = CONTENT_DOC.createElement("div");
    el.className = "lia-hl-rect";
    el.setAttribute("data-hl", item.color);
    el.setAttribute("data-id", String(item.id));
    el.setAttribute("data-kind", item.kind);
    el.style.left   = `${Math.round(S.ox + (rr.x - S.sx))}px`;
    el.style.top    = `${Math.round(S.oy + (rr.y - S.sy))}px`;
    el.style.width  = `${Math.round(rr.w)}px`;
    el.style.height = `${Math.round(rr.h)}px`;
    overlay.appendChild(el);
  }
}

export function render(I: Instance, overlay: Element): void {
  overlay.innerHTML = "";

  ensureSlideIds();

  const filter   = shouldFilterBySlide();
  const activeId = filter ? getActiveSlideId() : null;

  dbg("render:start", {
    filter,
    activeId,
    slides: getSlideCandidates().map(s => (s as HTMLElement).dataset.hlSlideid),
    total: (I.HL || []).length
  });

  if (filter && !activeId) {
    I.__activeSlide = null;
    dbg("render:no-active-slide");
    return;
  }

  I.__activeSlide = activeId || null;
  const S = getScrollCtx();

  for (const item of (I.HL || [])) {
    if (!item || !item.anchor) continue;

    const r = rangeFromAnchor(item.anchor);
    if (!r) {
      dbg("item:range-null", { id: item.id, stored: item.slide, kind: item.kind });
      continue;
    }

    const liveId = slideIdFromNode(r.commonAncestorContainer);
    if (liveId) item.slide = liveId;

    dbg("item:check", { id: item.id, kind: item.kind, stored: item.slide, live: liveId, active: activeId });

    if (filter && liveId !== activeId) continue;

    const packed = packedRectsFromRange(r);
    if (!packed?.length) {
      dbg("item:packed-empty", { id: item.id, stored: item.slide, live: liveId, active: activeId });
      continue;
    }

    item.rects = packed;
    drawRects(item, overlay, S);
  }

  dbg("render:end", { activeId, overlayChildren: overlay.childElementCount });
}

export function recalcAllHighlights(I: Instance): void {
  for (const item of I.HL) {
    if (!item.anchor) continue;
    const r = rangeFromAnchor(item.anchor);
    if (!r) { item.rects = []; continue; }
    item.rects = packedRectsFromRange(r) || [];
  }
}

export function layoutSignature(): string {
  const main = CONTENT_DOC.querySelector("main") || CONTENT_DOC.body;
  const csMain = CONTENT_WIN.getComputedStyle(main);
  const csRoot = CONTENT_WIN.getComputedStyle(CONTENT_DOC.documentElement);

  const rootClass = (ROOT_DOC.documentElement.className || "") + "|" + (ROOT_DOC.body.className || "");
  const contClass = (CONTENT_DOC.documentElement.className || "") + "|" + (CONTENT_DOC.body.className || "");

  const rootDE = ROOT_DOC.documentElement;
  const rootBody = ROOT_DOC.body;
  const rootData =
    (rootDE?.getAttribute("data-mode")||"") + "|" +
    (rootDE?.getAttribute("data-view")||"") + "|" +
    (rootDE?.getAttribute("data-layout")||"") + "|" +
    (rootBody?.getAttribute("data-mode")||"") + "|" +
    (rootBody?.getAttribute("data-view")||"") + "|" +
    (rootBody?.getAttribute("data-layout")||"");

  const contDE = CONTENT_DOC.documentElement;
  const contBody = CONTENT_DOC.body;
  const contData =
    (contDE?.getAttribute("data-mode")||"") + "|" +
    (contDE?.getAttribute("data-view")||"") + "|" +
    (contDE?.getAttribute("data-layout")||"") + "|" +
    (contBody?.getAttribute("data-mode")||"") + "|" +
    (contBody?.getAttribute("data-view")||"") + "|" +
    (contBody?.getAttribute("data-layout")||"");

  const mr = (main as HTMLElement).getBoundingClientRect();
  const mainGeo = [mr.left, mr.top, mr.width].map(v => Math.round(v)).join(",");

  const header =
    ROOT_DOC.querySelector("header#lia-toolbar-nav") ||
    ROOT_DOC.querySelector("#lia-toolbar-nav") ||
    ROOT_DOC.querySelector("header.lia-header");
  let headerGeo = "nohdr";
  if (header) {
    const hr = header.getBoundingClientRect();
    headerGeo = [hr.left, hr.top, hr.width, hr.height].map(v => Math.round(v)).join(",");
  }

  const vv = ROOT_WIN.visualViewport;
  const vpGeo = vv
    ? [vv.width, vv.height, vv.offsetLeft||0, vv.offsetTop||0].map(v => Math.round(v)).join(",")
    : [(ROOT_DOC.documentElement.clientWidth||0), (ROOT_DOC.documentElement.clientHeight||0), 0, 0].map(v => Math.round(v)).join(",");

  return [
    csRoot.fontSize, csMain.fontSize, csMain.lineHeight,
    csMain.width, csMain.paddingLeft, csMain.paddingRight,
    rootClass, contClass, rootData, contData,
    mainGeo, headerGeo, vpGeo
  ].join("§");
}

export function checkLayoutAndRecalc(I: Instance, renderFn: (I: Instance, overlay: Element) => void, overlay: Element): void {
  const sig = layoutSignature();
  if (sig !== I.__layoutSig) {
    I.__layoutSig = sig;
    recalcAllHighlights(I);
    renderFn(I, overlay);
  }
}

export function scheduleForcedRecalc(I: Instance, renderFn: (I: Instance, overlay: Element) => void, overlay: Element): void {
  if (I.roPending) return;
  I.roPending = true;
  ROOT_WIN.requestAnimationFrame(() => {
    I.roPending = false;
    if (!I.__alive) return;
    if (!I.HL || I.HL.length === 0) return;
    recalcAllHighlights(I);
    renderFn(I, overlay);
  });
}

export function ensureLayoutResizeObserver(I: Instance, renderFn: (I: Instance, overlay: Element) => void, overlay: Element): void {
  if (!("ResizeObserver" in ROOT_WIN)) return;

  if (!I.roLayout) {
    I.roLayout = new (ROOT_WIN as any).ResizeObserver(() => {
      scheduleForcedRecalc(I, renderFn, overlay);
    });
  }

  const want = new Set<Element>();
  const main = CONTENT_DOC.querySelector("main") || CONTENT_DOC.body;
  if (main) want.add(main);
  CONTENT_DOC.querySelectorAll(".dynFlex, .flex-child").forEach(el => want.add(el));

  for (const el of want) {
    if (!I.roNodes.has(el)) {
      try { I.roLayout!.observe(el); } catch(e){}
      I.roNodes.add(el);
    }
  }

  for (const el of Array.from(I.roNodes)) {
    if (!want.has(el)) {
      try { I.roLayout!.unobserve(el); } catch(e){}
      I.roNodes.delete(el);
    }
  }
}
