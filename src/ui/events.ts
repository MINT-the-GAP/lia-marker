import { ROOT_WIN, ROOT_DOC, CONTENT_DOC } from "../dom/context";
import type { Instance } from "../types";
import { applyUI, positionPanelSmart } from "./panel";
import {
  detectNavStack, positionHLButton,
  scheduleHLRepositionBurst, scheduleHLRepositionBurstThrottled
} from "./button";
import { clearSlide } from "../highlight/store";
import { recalcAllHighlights } from "../highlight/render";

type RenderFn = () => void;

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
  const clearBtn  = ROOT_DOC.getElementById("hl-clear");

  toolMark?.addEventListener("click", () => {
    I.state.tool = "mark"; I.state.panelOpen = false; applyUI(I);
  });
  toolErase?.addEventListener("click", () => {
    I.state.tool = "erase"; I.state.panelOpen = false; applyUI(I);
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
  eraseAtPointFn: (x: number, y: number) => boolean
): void {
  CONTENT_DOC.addEventListener("mouseup", (e) => {
    const isForeign = !!(e.target as Element)?.closest?.([
      "[data-hlq-ignore='1']", "[data-lia-hlq-ignore='1']",
      ".lia-tool-menu", ".lia-annot-btn", ".lia-annot-toolbar"
    ].join(","));
    if (isForeign) return;
    if (!I.state.active) return;
    if (I.state.panelOpen) { I.state.panelOpen = false; applyUI(I); }
    if (I.state.tool !== "mark") return;
    addHighlightFn();
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
