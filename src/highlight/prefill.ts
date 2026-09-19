import type { Instance, HLColor } from "../types";
import { ROOT_WIN, ROOT_DOC, CONTENT_WIN, CONTENT_DOC } from "../dom/context";
import { nodeToPath } from "../dom/ranges";
import { slideIdFromNode } from "../slides";
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


export function ensurePrefills(I: Instance): void {
  I.__prefillItems = I.__prefillItems || new WeakMap();

  // Prefills belong to authored DOM elements. LiaScript reuses DOM paths on
  // navigation, so a stored path alone may now point at unrelated (e.g. bold)
  // text. Rebuild the live set before every render, including an empty scan.
  // setHighlights callers rely on preserving the supplied array identity.
  for (let i = I.HL.length - 1; i >= 0; i--) {
    if (I.HL[i].kind === "prefill") I.HL.splice(i, 1);
  }

  const usedIds = new Set(I.HL.map(item => item.id));
  for (const id of usedIds) I.nextId = Math.max(I.nextId, id + 1);

  const root = prefillScanRoot();
  const els = Array.from((root as Element | Document).querySelectorAll(".lia-hl-prefill[data-hl-prefill]"));
  if (!els.length) return;

  ensureScopeIds();

  for (const el of els) {
    const color = ((el as HTMLElement).getAttribute("data-hl-prefill") || "yellow").toLowerCase() as HLColor;

    const r = CONTENT_DOC.createRange();
    try { r.selectNodeContents(el); } catch(e) { continue; }

    const anchor = {
      sp: nodeToPath(r.startContainer),
      so: r.startOffset,
      ep: nodeToPath(r.endContainer),
      eo: r.endOffset
    };

    let scopeId = "global";
    try { scopeId = scopeIdFromNode(r.commonAncestorContainer); } catch(e){}

    const slideId = slideIdFromNode(el);
    let item = I.__prefillItems.get(el);
    if (!item) {
      item = {
        id: I.nextId++, kind: "prefill", scope: scopeId, slide: slideId,
        color, anchor, rects: []
      };
      I.__prefillItems.set(el, item);
    } else {
      // Layout helpers may insert siblings or move the same element.
      // Keep its id, but refresh its serializable anchor and metadata.
      Object.assign(item, { scope: scopeId, slide: slideId, color, anchor, rects: [] });
    }
    // Restored user highlights may carry an id previously used by this node.
    if (usedIds.has(item.id)) item.id = I.nextId++;
    usedIds.add(item.id);
    I.nextId = Math.max(I.nextId, item.id + 1);
    I.HL.push(item);
  }
}
