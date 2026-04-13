import type { Instance, Anchor, HLColor } from "../types";
import { ROOT_WIN, ROOT_DOC, CONTENT_WIN, CONTENT_DOC } from "../dom/context";
import { nodeToPath } from "../dom/ranges";
import { packedRectsFromRange } from "../dom/rects";
import { getActiveSlideId, slideIdFromNode } from "../slides";
import { ensureScopeIds, scopeIdFromNode } from "./store";

function prefillInPresentation(): boolean {
  if ((ROOT_WIN as any).Reveal || (CONTENT_WIN as any).Reveal) return true;
  if (
    ROOT_DOC.querySelector("section.present") ||
    CONTENT_DOC.querySelector("section.present")
  ) return true;
  const h = (ROOT_WIN.location.hash || CONTENT_WIN.location.hash || "");
  if (h.startsWith("#/")) return true;
  const v = (
    (ROOT_DOC.documentElement.getAttribute("data-view") || "") +
    " " +
    (ROOT_DOC.body.className || "")
  ).toLowerCase();
  return v.includes("presentation");
}

function prefillScanRoot(): Document | Element {
  if (prefillInPresentation()) {
    return (
      CONTENT_DOC.querySelector("section.present") ||
      ROOT_DOC.querySelector("section.present") ||
      CONTENT_DOC
    );
  }
  return CONTENT_DOC;
}


export function ensurePrefills(I: Instance, renderFn: () => void): void {
  I.__prefillKeys = I.__prefillKeys || new Set();

  const root = prefillScanRoot();
  const els = Array.from((root as Element | Document).querySelectorAll(".lia-hl-prefill[data-hl-prefill]"));
  if (!els.length) return;

  ensureScopeIds();

  for (const el of els) {
    const color = ((el as HTMLElement).getAttribute("data-hl-prefill") || "yellow").toLowerCase() as HLColor;

    const r = CONTENT_DOC.createRange();
    try { r.selectNodeContents(el); } catch(e) { continue; }

    const anchor: Anchor = {
      sp: nodeToPath(r.startContainer),
      so: r.startOffset,
      ep: nodeToPath(r.endContainer),
      eo: r.endOffset
    };

    let scopeId = "global";
    try { scopeId = scopeIdFromNode(r.commonAncestorContainer); } catch(e){}

    let slideId = "global";
    try {
      slideId =
        (getActiveSlideId()) ||
        slideIdFromNode(r.commonAncestorContainer) ||
        "global";
    } catch(e){}

    const key = `P|${color}|${scopeId}|${slideId}|${anchor.sp}|${anchor.so}|${anchor.ep}|${anchor.eo}`;
    if (I.__prefillKeys!.has(key)) continue;

    let rects = [];
    try { rects = packedRectsFromRange(r) || []; } catch(e) { rects = []; }

    I.HL.push({
      id: I.nextId++,
      kind: "prefill",
      scope: scopeId,
      slide: slideId,
      color,
      anchor,
      rects
    });

    I.__prefillKeys!.add(key);
  }

  renderFn();
}
