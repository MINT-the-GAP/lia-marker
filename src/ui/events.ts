import { ROOT_WIN, ROOT_DOC, CONTENT_WIN, CONTENT_DOC } from "../dom/context";
import type { Instance } from "../types";
import { applyUI } from "./panel";
import { clearSlide } from "../highlight/store";
import { recalcAllHighlights } from "../highlight/render";

type RenderFn = () => void;

function isHighlighterUI(target: EventTarget | null): boolean {
  const node = target as Node | null;
  const element = node?.nodeType === 1 ? node as Element : node?.parentElement;
  return !!element?.closest("#lia-hl-btn, #lia-hl-panel, #lia-hl-explain-tip");
}

function isForeignUI(target: EventTarget | null): boolean {
  const node = target as Node | null;
  const element = node?.nodeType === 1 ? node as Element : node?.parentElement;
  return !!element?.closest([
    "[data-hlq-ignore='1']", "[data-lia-hlq-ignore='1']",
    ".lia-tool-menu", ".lia-annot-btn", ".lia-annot-toolbar"
  ].join(","));
}

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

export function wireRootDelegationOnce(I: Instance, renderFn: RenderFn): void {
  if (I.__rootDelegated) return;
  I.__rootDelegated = true;

  let last = 0;
  function safeToggle(): void {
    if (!I.__alive) return;
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
    if (!I.__alive || e.key !== "Escape") return;
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

}

export function wireContentEvents(
  I: Instance,
  renderFn: RenderFn,
  addHighlightFn: () => void,
  explainSelectionFn: () => void,
  eraseAtPointFn: (x: number, y: number) => boolean
): void {
  let markSingleTimer: number | null = null;
  let suppressMouseUntil = 0;
  type Tap = { id: number; x: number; y: number; time: number; range: Range; tool: Instance["state"]["tool"] };
  let touchStart: Tap | null = null;
  let lastTap: Tap | null = null;

  function canSelectWord(): boolean {
    return I.__alive && I.state.active && (I.state.tool === "mark" || I.state.tool === "explain");
  }

  function cancelPendingMark(): void {
    if (markSingleTimer === null) return;
    ROOT_WIN.clearTimeout(markSingleTimer);
    markSingleTimer = null;
  }

  function selectWord(range: Range): boolean {
    const sel = CONTENT_WIN.getSelection();
    if (!sel) return false;
    try {
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch (_) {
      return false;
    }
  }

  function explainSelectedWord(): void {
    if (!canSelectWord() || I.state.tool !== "explain" || Date.now() < suppressMouseUntil) return;
    // Do not start the explainer's selection retries for a collapsed first
    // click: they can race the subsequent double-click and duplicate lookups.
    const sel = CONTENT_WIN.getSelection();
    if (sel && !sel.isCollapsed) explainSelectionFn();
  }

  function resetTouch(): void {
    touchStart = null;
    lastTap = null;
  }

  // Mobile browsers do not reliably emit dblclick or select a word on a
  // double tap. Resolve the word at the touch point, as for mouse double-clicks.
  CONTENT_DOC.addEventListener("touchstart", (e) => {
    touchStart = null;
    if (!canSelectWord() || isHighlighterUI(e.target) || isForeignUI(e.target)) {
      lastTap = null;
      return;
    }
    suppressMouseUntil = Date.now() + 800;
    cancelPendingMark();
    if (e.touches.length !== 1) { resetTouch(); return; }
    const target = e.target as Element;
    if (target.closest?.("input, textarea, select, button, a, code, pre, .hlq-proxy, [contenteditable]:not([contenteditable='false'])")) {
      lastTap = null;
      return;
    }
    const touch = e.touches[0];
    const range = wordRangeFromPoint(touch.clientX, touch.clientY);
    // Caret hit testing may return nearby text even when tapping blank space.
    if (!range || !Array.from(range.getClientRects()).some(rect =>
      touch.clientX >= rect.left - 2 && touch.clientX <= rect.right + 2 &&
      touch.clientY >= rect.top - 2 && touch.clientY <= rect.bottom + 2
    )) {
      lastTap = null;
      return;
    }
    touchStart = {
      id: touch.identifier, x: touch.clientX, y: touch.clientY,
      time: Date.now(), range, tool: I.state.tool
    };
  }, { capture: true, passive: true });

  CONTENT_DOC.addEventListener("touchmove", (e) => {
    if (!touchStart) return;
    const touch = e.touches[0];
    if (e.touches.length !== 1 || touch.identifier !== touchStart.id ||
        Math.hypot(touch.clientX - touchStart.x, touch.clientY - touchStart.y) > 12) resetTouch();
  }, { capture: true, passive: true });

  CONTENT_DOC.addEventListener("touchcancel", resetTouch, { capture: true, passive: true });
  CONTENT_DOC.addEventListener("scroll", resetTouch, { capture: true, passive: true });

  CONTENT_DOC.addEventListener("touchend", (e) => {
    const start = touchStart;
    touchStart = null;
    if (!start) return;
    const now = Date.now();
    suppressMouseUntil = now + 800;
    const touch = e.changedTouches[0];
    if (!canSelectWord() || I.state.tool !== start.tool || e.touches.length ||
        !touch || touch.identifier !== start.id || now - start.time > 350 ||
        Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 12) {
      lastTap = null;
      return;
    }
    const previous = lastTap;
    lastTap = { ...start, time: now };
    if (!previous || previous.tool !== start.tool || now - previous.time > 350 ||
        Math.hypot(start.x - previous.x, start.y - previous.y) > 24 ||
        previous.range.startContainer !== start.range.startContainer ||
        previous.range.startOffset !== start.range.startOffset ||
        previous.range.endContainer !== start.range.endContainer ||
        previous.range.endOffset !== start.range.endOffset) return;

    lastTap = null;
    if (!selectWord(start.range)) return;
    // Cancel native double-tap zoom and the compatibility mouse events for
    // this gesture only; ordinary scrolling and pinch zoom retain their defaults.
    e.preventDefault();
    if (I.state.panelOpen) { I.state.panelOpen = false; applyUI(I); }
    if (I.state.tool === "explain") explainSelectionFn();
    else addHighlightFn();
  }, { capture: true, passive: false });

  CONTENT_DOC.addEventListener("mouseup", (e) => {
    // UI controls handle their own clicks. In Firefox contextmenu can precede
    // right-button mouseup; that release must not close the palette or mark text.
    if (e.button !== 0 || isHighlighterUI(e.target) || isForeignUI(e.target)) return;
    if (!I.__alive || !I.state.active || Date.now() < suppressMouseUntil) return;
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
      if (e.detail >= 2) return;
      // Selection is often not finalized yet during capture-phase mouseup.
      // Defer once to next frame and once via short timeout for reliability.
      ROOT_WIN.requestAnimationFrame(() => {
        explainSelectedWord();
        ROOT_WIN.setTimeout(explainSelectedWord, 90);
      });
      return;
    }
  }, true);

  CONTENT_DOC.addEventListener("dblclick", (e) => {
    if (e.button !== 0 || isHighlighterUI(e.target) || isForeignUI(e.target)) return;
    if (!canSelectWord() || Date.now() < suppressMouseUntil) return;
    cancelPendingMark();

    const sel = CONTENT_WIN.getSelection();
    // Native word selection can span inline formatting such as <b>Ap</b>fel.
    // Preserve that range for explanations; use hit testing only as a fallback.
    if (I.state.tool === "mark" || !sel || sel.isCollapsed) {
      const forced = wordRangeFromPoint(e.clientX, e.clientY);
      if (forced) selectWord(forced);
    }
    if (I.state.tool === "explain") {
      explainSelectedWord();
      return;
    }

    (I as any).__markDblClickPendingUntil = Date.now() + 500;

    // Dblclick fires after the browser has finalized word selection.
    addHighlightFn();
    ROOT_WIN.requestAnimationFrame(() => {
      addHighlightFn();
      ROOT_WIN.setTimeout(() => { addHighlightFn(); }, 60);
    });
  }, true);

  CONTENT_DOC.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || isHighlighterUI(e.target) || isForeignUI(e.target)) return;
    if (!I.__alive || !I.state.active) return;
    if (I.state.tool !== "erase") return;
    recalcAllHighlights(I);
    const hit = eraseAtPointFn(e.clientX, e.clientY);
    if (!hit) return;
    e.preventDefault();
    e.stopPropagation();
    renderFn();
  }, true);
}
