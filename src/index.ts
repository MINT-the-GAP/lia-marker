import { ROOT_WIN, ROOT_DOC, CONTENT_WIN, CONTENT_DOC } from "./dom/context";
import cssQuiz    from "bundle-text:./css/quiz.css";
import cssContent from "bundle-text:./css/content.css";
import cssRoot    from "bundle-text:./css/root.css";
import type { Instance } from "./types";
import { render, checkLayoutAndRecalc, ensureLayoutResizeObserver } from "./highlight/render";
import { addHighlightFromSelection, findUserHighlightAtPoint } from "./highlight/store";
import { ensurePrefills } from "./highlight/prefill";
import { ensureRevealSlideObserver } from "./slides";
import { adaptUIVars } from "./theme";
import { ensureRootButtonAndPanel, positionHLButton, detectNavStack } from "./ui/button";
import { positionPanelSmart, ensureSwatchesOnce, applyUI, localizePanelText } from "./ui/panel";
import { wireRootDelegationOnce, wireUIOnce, wireContentEvents } from "./ui/events";
import { wireHLQEvents } from "./quiz/events";
import { layoutSignature } from "./highlight/render";
import { getActiveSlideId, slideIdFromNode, getSlideCandidates } from "./slides";
import { packedRectsFromRange } from "./dom/rects";
import { rangeFromAnchor } from "./dom/ranges";

// ─── Registry ────────────────────────────────────────────────────────────────
const REGKEY = "__LIA_TEXTMARKER_REG_V4__";
(ROOT_WIN as any)[REGKEY] = (ROOT_WIN as any)[REGKEY] || { instances: {} };
const REG = (ROOT_WIN as any)[REGKEY];

const DOC_ID =
  (CONTENT_DOC.baseURI || CONTENT_WIN.location.href || "") +
  "::" +
  (CONTENT_DOC.title || "");

// ─── Teardown previous instance ───────────────────────────────────────────────
const prev: Instance | undefined = REG.instances[DOC_ID];
if (prev?.__alive) {
  try { prev.moSlides?.disconnect(); } catch(e){}
  try { prev.__alive = false; } catch(e){}
  try { prev.moDock?.disconnect(); } catch(e){}
  try { prev.moTheme?.disconnect(); } catch(e){}
  try { prev.roLayout?.disconnect(); } catch(e){}
  try { if (prev.__layoutTimer) ROOT_WIN.clearInterval(prev.__layoutTimer as number); } catch(e){}
  try { CONTENT_DOC.getElementById("lia-hl-overlay")?.remove(); } catch(e){}
}

// ─── Instance ─────────────────────────────────────────────────────────────────
const I: Instance = REG.instances[DOC_ID] = {
  __alive:       true,
  debugHLQ:      false,
  state:         { active: false, panelOpen: false, tool: "mark" as const, color: "yellow" as const },
  HL:            [],
  nextId:        1,
  moDock:        null,
  moTheme:       null,
  moSlides:      null,
  roLayout:      null,
  roNodes:       new Set<Element>(),
  roPending:     false,
  ticking:       false,
  __activeSlide: null,
  posTimers:     [],
  lastBurstAt:   0
};

// ─── CSS ──────────────────────────────────────────────────────────────────────
function ensureStyle(doc: Document, id: string, css: string): void {
  const old = doc.getElementById(id);
  if (old) { old.textContent = css; return; }
  const st = doc.createElement("style");
  st.id = id;
  st.textContent = css;
  doc.head.appendChild(st);
}

function ensureCSS(): void {
  ensureStyle(CONTENT_DOC, "lia-hl-style-static-v4",  cssQuiz);
  ensureStyle(CONTENT_DOC, "lia-hl-style-content-v4", cssContent);
  ensureStyle(ROOT_DOC,    "lia-hl-root-style-v4",    cssRoot);
}

// ─── Overlay ──────────────────────────────────────────────────────────────────
function ensureOverlay(): HTMLElement {
  let overlay = CONTENT_DOC.getElementById("lia-hl-overlay");
  if (!overlay) {
    overlay = CONTENT_DOC.createElement("div");
    overlay.id = "lia-hl-overlay";
    CONTENT_DOC.body.appendChild(overlay);
  }
  return overlay;
}

const overlay = ensureOverlay();
const doRender = () => render(I, overlay);

// ─── Scroll / resize ──────────────────────────────────────────────────────────
let __renderPending = false;
function scheduleRender(): void {
  if (__renderPending) return;
  __renderPending = true;
  ROOT_WIN.requestAnimationFrame(() => {
    __renderPending = false;
    if (!I.__alive) return;
    doRender();
  });
}

CONTENT_WIN.addEventListener("scroll", scheduleRender, { passive: true });
CONTENT_DOC.addEventListener("scroll", scheduleRender, { passive: true, capture: true });
CONTENT_WIN.addEventListener("resize", () => {
  adaptUIVars();
  checkLayoutAndRecalc(I, render, overlay);
  doRender();
});

// ─── Content interaction ──────────────────────────────────────────────────────
wireContentEvents(
  I,
  doRender,
  () => addHighlightFromSelection(I, doRender),
  (x: number, y: number) => {
    const hit = findUserHighlightAtPoint(I, x, y);
    if (hit) { I.HL = I.HL.filter(h => h.id !== hit.id); }
    return !!hit;
  }
);

wireHLQEvents(I, doRender);

// ─── Position helpers ─────────────────────────────────────────────────────────
function runHLPositionNow(): void {
  detectNavStack();
  positionHLButton();
  positionPanelSmart(I);
}

// ─── Slide sync ───────────────────────────────────────────────────────────────
let __hlSyncToken = 0;

function scheduleSync(): void {
  const token = ++__hlSyncToken;
  try { overlay.innerHTML = ""; } catch(e){}
  const run = () => {
    if (!I.__alive) return;
    if (token !== __hlSyncToken) return;
    doRender();
  };
  try { ROOT_WIN.requestAnimationFrame(run); } catch(e){}
  setTimeout(run, 1);
}

try { ROOT_WIN.addEventListener("hashchange", () => scheduleSync()); } catch(e){}
try { CONTENT_WIN.addEventListener("hashchange", () => scheduleSync()); } catch(e){}

// LiaScript arrow navigation uses pushState/replaceState, not hashchange.
try {
  const _push = ROOT_WIN.history.pushState.bind(ROOT_WIN.history);
  ROOT_WIN.history.pushState = function(...args) { _push(...args); scheduleSync(); };
  const _replace = ROOT_WIN.history.replaceState.bind(ROOT_WIN.history);
  ROOT_WIN.history.replaceState = function(...args) { _replace(...args); scheduleSync(); };
} catch(e){}

// ─── Tick (boot + DOM observer) ───────────────────────────────────────────────
function tick(): void {
  ensureCSS();
  if (I.ticking) return;
  I.ticking = true;

  ROOT_WIN.requestAnimationFrame(() => {
    try {
      ensureRootButtonAndPanel();
      localizePanelText();
      wireRootDelegationOnce(I, doRender);
      runHLPositionNow();
      ensureLayoutResizeObserver(I, render, overlay);
      ensureRevealSlideObserver(I, () => scheduleSync());
      checkLayoutAndRecalc(I, render, overlay);
      ensureSwatchesOnce(I, () => applyUI(I));
      ensurePrefills(I, doRender);
      wireUIOnce(I, doRender);
      adaptUIVars();
      applyUI(I);
      positionPanelSmart(I);
    } finally {
      I.ticking = false;
    }
  });
}

try {
  I.moDock = new MutationObserver(() => tick());
  I.moDock.observe(ROOT_DOC.body, { childList: true, subtree: true });
} catch(e){}

try {
  I.moTheme = new MutationObserver(() => { adaptUIVars(); applyUI(I); runHLPositionNow(); });
  I.moTheme.observe(ROOT_DOC.documentElement, { attributes: true, attributeFilter: ["class","data-theme","data-mode","data-view","data-layout"] });
  I.moTheme.observe(ROOT_DOC.body,            { attributes: true, attributeFilter: ["class","data-theme","data-mode","data-view","data-layout"] });
} catch(e){}

// ─── Layout timer ─────────────────────────────────────────────────────────────
if (!I.__layoutTimer) {
  I.__layoutSig = layoutSignature();
  I.__layoutTimer = ROOT_WIN.setInterval(() => {
    if (!I.__alive) return;
    checkLayoutAndRecalc(I, render, overlay);
  }, 350);
}

// ─── Debug helper ─────────────────────────────────────────────────────────────
try {
  (ROOT_WIN as any).__HLDBG = {
    dump() {
      const active = getActiveSlideId();
      const rows = (I.HL || []).map((item: Instance["HL"][number]) => {
        let rangeOk = false, live: string | null = null, packed = 0;
        if (item?.anchor) {
          const r = rangeFromAnchor(item.anchor);
          if (r) {
            rangeOk = true;
            live = slideIdFromNode(r.commonAncestorContainer);
            packed = packedRectsFromRange(r)?.length || 0;
          }
        }
        return { id: item?.id, kind: item?.kind, stored: item?.slide, live, rangeOk, packed, active };
      });
      console.log("[HLDBG dump]", {
        active,
        slides: getSlideCandidates().map(s => ({
          id: (s as HTMLElement).dataset.hlSlideid,
          text: (s.textContent || "").trim().slice(0, 60)
        })),
        rows
      });
      return rows;
    }
  };
} catch(e){}

// ─── Freeze API ───────────────────────────────────────────────────────────────
REG.setHighlights = function(hlArray: any[]) {
  if (!I || !I.__alive) return;
  I.HL = hlArray || [];
  doRender();
};

// ─── Boot ─────────────────────────────────────────────────────────────────────
tick();
doRender();
scheduleSync();
