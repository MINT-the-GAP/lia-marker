import { ROOT_WIN, ROOT_DOC, CONTENT_WIN, CONTENT_DOC } from "../dom/context";
import type { Instance } from "../types";
import { applyUI, positionPanelSmart } from "./panel";
import {
  detectNavStack, positionHLButton,
  scheduleHLRepositionBurst, scheduleHLRepositionBurstThrottled
} from "./button";
import { clearSlide } from "../highlight/store";
import { recalcAllHighlights } from "../highlight/render";

type RenderFn = () => void;

function isWordChar(ch: string): boolean {
  return /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſƀ-ɏЀ-ӿ'’-]/.test(ch);
}

function wordRangeFromPoint(x: number, y: number): Range | null {
  let node: Node | null = null;
  let offset = 0;

  const anyDoc = CONTENT_DOC as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };

  if (typeof anyDoc.caretPositionFromPoint === "function") {
    const pos = anyDoc.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (typeof anyDoc.caretRangeFromPoint === "function") {
    const r = anyDoc.caretRangeFromPoint(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  }

  if (!node) return null;
  if (node.nodeType !== 3) {
    const el = node as Element;
    const txt = el.firstChild;
    if (!txt || txt.nodeType !== 3) return null;
    node = txt;
    offset = 0;
  }

  const textNode = node as Text;
  const text = textNode.data || "";
  if (!text) return null;

  let i = Math.max(0, Math.min(offset, text.length - 1));
  if (!isWordChar(text[i]) && i > 0 && isWordChar(text[i - 1])) i--;
  if (!isWordChar(text[i])) return null;

  let s = i;
  let e = i + 1;
  while (s > 0 && isWordChar(text[s - 1])) s--;
  while (e < text.length && isWordChar(text[e])) e++;

  const r = CONTENT_DOC.createRange();
  try {
    r.setStart(textNode, s);
    r.setEnd(textNode, e);
    if (r.collapsed) return null;
    return r;
  } catch (e) {
    return null;
  }
}

function runHLPositionNow(I: Instance): void {
  detectNavStack();
  positionHLButton();
  positionPanelSmart(I);
}

export function wireRootDelegationOnce(I: Instance, renderFn: RenderFn): void {
  if (I.__rootDelegated) return;
  I.__rootDelegated = true;

  let last = 0;
  function safeToggle(): void {
    const now = Date.now();
    if (now - last < 250) return;
    last = now;
    try {
      I.state.active    = !I.state.active;
      I.state.panelOpen = I.state.active;
      I.state.tool      = "mark";
      applyUI(I);
      renderFn();
    } catch(err) {
      console.error("[HL] toggle failed", err);
      I.state.active    = false;
      I.state.panelOpen = false;
      I.state.tool      = "mark";
      try { applyUI(I); } catch(e){}
    }
  }

  ROOT_DOC.addEventListener("click", (e) => {
    if (!(e.target as Element)?.closest?.("#lia-hl-btn")) return;
    e.preventDefault();
    e.stopPropagation();
    safeToggle();
  }, true);

  ROOT_DOC.addEventListener("touchend", (e) => {
    if (!(e.target as Element)?.closest?.("#lia-hl-btn")) return;
    e.preventDefault();
    e.stopPropagation();
    safeToggle();
  }, { capture: true, passive: false });

  ROOT_DOC.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!I.state.active) return;
    I.state.active    = false;
    I.state.panelOpen = false;
    I.state.tool      = "mark";
    try { applyUI(I); renderFn(); } catch(err){}
  }, true);
}

export function wireUIOnce(I: Instance, renderFn: RenderFn): void {
  const btn = ROOT_DOC.getElementById("lia-hl-btn") as HTMLElement & { __liaHLWired?: boolean } | null;
  if (!btn || btn.__liaHLWired) return;
  btn.__liaHLWired = true;

  if (!I.__hlTOCWired) {
    I.__hlTOCWired = true;

    ROOT_DOC.addEventListener("click", (e) => {
      if (!(e.target as Element)?.closest?.("#lia-btn-toc")) return;
      scheduleHLRepositionBurst(I, () => runHLPositionNow(I));
    }, true);

    const toc = ROOT_DOC.getElementById("lia-toc");
    if (toc) {
      for (const evt of ["transitionrun", "transitionstart", "transitionend"]) {
        toc.addEventListener(evt, () => scheduleHLRepositionBurstThrottled(I, () => runHLPositionNow(I)), true);
      }
    }
  }

  btn.addEventListener("click", () => {
    if (!I.state.active) {
      I.state.active    = true;
      I.state.panelOpen = true;
      I.state.tool      = "mark";
    } else {
      I.state.active    = false;
      I.state.panelOpen = false;
      I.state.tool      = "mark";
    }
    applyUI(I);
  });

  btn.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (!I.state.active) return;
    I.state.panelOpen = !I.state.panelOpen;
    applyUI(I);
  });

  const toolMark  = ROOT_DOC.getElementById("hl-tool-mark");
  const toolErase = ROOT_DOC.getElementById("hl-tool-erase");
  const toolExplain = ROOT_DOC.getElementById("hl-tool-explain");
  const clearBtn  = ROOT_DOC.getElementById("hl-clear");

  toolMark?.addEventListener("click", () => {
    I.state.tool = "mark"; I.state.panelOpen = false; applyUI(I);
  });
  toolErase?.addEventListener("click", () => {
    I.state.tool = "erase"; I.state.panelOpen = false; applyUI(I);
  });
  toolExplain?.addEventListener("click", () => {
    I.state.tool = "explain"; I.state.panelOpen = false; applyUI(I);
  });

  clearBtn?.addEventListener("click", () => {
    clearSlide(I);
    renderFn();
    I.state.panelOpen = false;
    I.state.tool      = "mark";
    applyUI(I);
  });

  ROOT_DOC.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && I.state.active) {
      I.state.panelOpen = false;
      I.state.tool      = "mark";
      applyUI(I);
    }
  });

  ROOT_WIN.addEventListener("resize", () => {
    scheduleHLRepositionBurstThrottled(I, () => runHLPositionNow(I));
  });

  if (ROOT_WIN.visualViewport) {
    ROOT_WIN.visualViewport.addEventListener("resize", () => {
      scheduleHLRepositionBurstThrottled(I, () => runHLPositionNow(I));
    });
    ROOT_WIN.visualViewport.addEventListener("scroll", () => {
      scheduleHLRepositionBurstThrottled(I, () => runHLPositionNow(I));
    });
  }
}

export function wireContentEvents(
  I: Instance,
  renderFn: RenderFn,
  addHighlightFn: () => void,
  explainSelectionFn: () => void,
  eraseAtPointFn: (x: number, y: number) => boolean
): void {
  let markSingleTimer: number | null = null;

  CONTENT_DOC.addEventListener("mouseup", (e) => {
    const isForeign = !!(e.target as Element)?.closest?.([
      "[data-hlq-ignore='1']", "[data-lia-hlq-ignore='1']",
      ".lia-tool-menu", ".lia-annot-btn", ".lia-annot-toolbar"
    ].join(","));
    if (isForeign) return;
    if (!I.state.active) return;
    if (I.state.panelOpen) { I.state.panelOpen = false; applyUI(I); }
    if (I.state.tool === "mark") {
      const clickDetail = (e as MouseEvent).detail || 0;
      // Let dblclick handler own the double-click path to avoid racing selection finalization.
      if (clickDetail >= 2) return;

      if (markSingleTimer !== null) {
        ROOT_WIN.clearTimeout(markSingleTimer);
        markSingleTimer = null;
      }

      // Delay single-click/drag commit briefly so a possible second click can cancel it.
      markSingleTimer = ROOT_WIN.setTimeout(() => {
        markSingleTimer = null;
        addHighlightFn();
        ROOT_WIN.requestAnimationFrame(() => {
          addHighlightFn();
        });
      }, 220);
      return;
    }
    if (I.state.tool === "explain") {
      // Selection is often not finalized yet during capture-phase mouseup.
      // Defer once to next frame and once via short timeout for reliability.
      ROOT_WIN.requestAnimationFrame(() => {
        explainSelectionFn();
        ROOT_WIN.setTimeout(() => { explainSelectionFn(); }, 90);
      });
      return;
    }
  }, true);

  CONTENT_DOC.addEventListener("dblclick", (e) => {
    const isForeign = !!(e.target as Element)?.closest?.([
      "[data-hlq-ignore='1']", "[data-lia-hlq-ignore='1']",
      ".lia-tool-menu", ".lia-annot-btn", ".lia-annot-toolbar"
    ].join(","));
    if (isForeign) return;
    if (!I.state.active) return;
    if (I.state.tool !== "mark") return;

    (I as any).__markDblClickPendingUntil = Date.now() + 500;

    if (markSingleTimer !== null) {
      ROOT_WIN.clearTimeout(markSingleTimer);
      markSingleTimer = null;
    }

    const forced = wordRangeFromPoint((e as MouseEvent).clientX, (e as MouseEvent).clientY);
    if (forced) {
      const sel = CONTENT_WIN.getSelection ? CONTENT_WIN.getSelection() : null;
      try {
        sel?.removeAllRanges();
        sel?.addRange(forced);
      } catch (err) {}
    }

    // Dblclick fires after the browser has finalized word selection.
    addHighlightFn();
    ROOT_WIN.requestAnimationFrame(() => {
      addHighlightFn();
      ROOT_WIN.setTimeout(() => { addHighlightFn(); }, 60);
    });
  }, true);

  CONTENT_DOC.addEventListener("pointerdown", (e) => {
    const isForeign = !!(e.target as Element)?.closest?.([
      "[data-hlq-ignore='1']", "[data-lia-hlq-ignore='1']",
      ".lia-tool-menu", ".lia-annot-btn", ".lia-annot-toolbar"
    ].join(","));
    if (isForeign) return;
    if (!I.state.active) return;
    if (I.state.tool !== "erase") return;
    recalcAllHighlights(I);
    const hit = eraseAtPointFn(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    renderFn();
  }, true);
}
