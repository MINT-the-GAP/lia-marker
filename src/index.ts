import { ROOT_WIN, ROOT_DOC, CONTENT_WIN, CONTENT_DOC } from "./dom/context";
import type { Instance } from "./types";
import { render, checkLayoutAndRecalc, ensureLayoutResizeObserver } from "./highlight/render";
import { addHighlightFromSelection, findUserHighlightAtPoint } from "./highlight/store";
import { ensurePrefills } from "./highlight/prefill";
import { ensureRevealSlideObserver } from "./slides";
import { adaptUIVars } from "./theme";
import { ensureRootButtonAndPanel, positionHLButton, detectNavStack } from "./ui/button";
import { positionPanelSmart, ensureSwatchesOnce, applyUI } from "./ui/panel";
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
  try { if (prev.__slideSyncTimer) ROOT_WIN.clearInterval(prev.__slideSyncTimer as number); } catch(e){}
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
  ensureStyle(CONTENT_DOC, "lia-hl-style-static-v4", `
    .hlq-proxy{display:inline-flex!important;align-items:center!important;flex-wrap:wrap!important;margin:0!important;padding:0!important;gap:0!important}
    .hlq-proxy .hlq-btn,.hlq-proxy .hlq-msg{display:none!important}
    .hlq-proxy .hlq-lia{display:contents}
    .lia-hlq-debug .hlq-proxy .hlq-btn,.lia-hlq-debug .hlq-proxy .hlq-msg{display:inline-flex!important}
    .lia-hlq-debug .lia-hl-target{outline:2px dashed currentColor;outline-offset:-1px;opacity:.7}
  `);

  ensureStyle(CONTENT_DOC, "lia-hl-style-content-v4", `
    :root{
      --hl-yellow: rgba(255,247,0,.45);
      --hl-green:  rgba(144,238,144,.45);
      --hl-blue:   rgba(0,76,255,.45);
      --hl-pink:   rgba(255,0,212,.45);
      --hl-orange: rgba(255,153,0,.45);
      --hl-red:    rgba(255,0,0,.45);
      --hl-ui-bg: rgba(255,255,255,.92);
      --hl-ui-fg: rgba(0,0,0,.88);
      --hl-ui-border: rgba(0,0,0,.14);
      --hl-ui-muted: rgba(0,0,0,.62);
      --hl-ui-shadow: 0 16px 42px rgba(0,0,0,.16);
      --hl-accent: rgb(11,95,255);
      --hl-z: 9999999;
    }
    #lia-hl-overlay{position:fixed!important;inset:0!important;z-index:calc(var(--hl-z) - 1)!important;pointer-events:none!important}
    .lia-hl-rect{position:absolute!important;border-radius:6px!important;box-shadow:0 1px 0 rgba(0,0,0,.08) inset;mix-blend-mode:multiply;pointer-events:none!important;cursor:default!important}
    .lia-hl-rect[data-kind="user"]{pointer-events:auto!important;cursor:pointer!important}
    .lia-hl-rect[data-hl="yellow"]{background:var(--hl-yellow)}
    .lia-hl-rect[data-hl="green"]{background:var(--hl-green)}
    .lia-hl-rect[data-hl="blue"]{background:var(--hl-blue)}
    .lia-hl-rect[data-hl="pink"]{background:var(--hl-pink)}
    .lia-hl-rect[data-hl="orange"]{background:var(--hl-orange)}
    .lia-hl-rect[data-hl="red"]{background:var(--hl-red)}
    .hlq-proxy input,.hlq-proxy textarea,.hlq-proxy select{display:none!important}
    .hlq-proxy .hlq-msg{font-weight:700;opacity:.85}
  `);

  ensureStyle(ROOT_DOC, "lia-hl-root-style-v4", `
    :root{
      --hl-ui-bg: rgba(255,255,255,.92);
      --hl-ui-fg: rgba(0,0,0,.88);
      --hl-ui-border: rgba(0,0,0,.14);
      --hl-ui-muted: rgba(0,0,0,.62);
      --hl-ui-shadow: 0 16px 42px rgba(0,0,0,.16);
      --hl-accent: rgb(11,95,255);
      --hl-z: 9999999;
    }

    #lia-hl-ui-overlay-v1{position:fixed!important;z-index:var(--hl-z)!important;left:0;top:0;width:0;height:0;pointer-events:none!important}

    #lia-hl-inline-slot-v1{position:relative!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;width:40px!important;min-width:40px!important;max-width:40px!important;height:40px!important;min-height:40px!important;flex:0 0 40px!important;margin:0!important;padding:0!important;overflow:visible!important;pointer-events:none!important}
    #lia-hl-inline-slot-v1 > #lia-hl-btn{position:relative!important;left:auto!important;top:auto!important;margin:0!important}

    body.lia-hl-navstack #lia-toolbar-nav .lia-header__left{display:flex!important;flex-direction:column!important;align-items:stretch!important;justify-content:flex-start!important;width:32px!important;min-width:32px!important;gap:6px!important;overflow:visible!important}
    body.lia-hl-navstack #lia-hl-inline-slot-v1{width:32px!important;min-width:32px!important;max-width:32px!important;height:32px!important;min-height:32px!important;flex:0 0 32px!important}

    #lia-hl-btn{position:absolute!important;pointer-events:auto!important;width:40px!important;height:40px!important;padding:0!important;margin:0!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:0!important;border-bottom:0!important;box-shadow:none!important;outline:none!important;background:transparent!important;color:var(--hl-accent)!important;cursor:pointer!important;user-select:none!important;border-radius:10px!important;text-decoration:none!important}
    #lia-hl-btn::before,#lia-hl-btn::after{content:none!important;display:none!important}
    #lia-hl-btn:hover{background:color-mix(in srgb,currentColor 10%,transparent)!important}
    #lia-hl-btn:active{background:color-mix(in srgb,currentColor 16%,transparent)!important}
    #lia-hl-btn:focus,#lia-hl-btn:focus-visible{outline:none!important;box-shadow:none!important}
    #lia-hl-btn .icon,#lia-hl-btn svg{width:22px!important;height:22px!important;display:block!important;color:var(--hl-accent)!important}
    #lia-hl-btn svg,#lia-hl-btn svg *{color:var(--hl-accent)!important;stroke:var(--hl-accent)!important}
    #lia-hl-btn svg path{stroke:var(--hl-accent)!important}
    #lia-hl-btn .dot{position:absolute!important;right:6px!important;bottom:6px!important;width:10px!important;height:10px!important;border-radius:999px!important;border:1px solid var(--hl-ui-border)!important;background:var(--hl-yellow)!important}

    body.lia-hl-active #lia-hl-btn{outline:none!important;box-shadow:inset 0 0 0 2px rgb(20,115,117)!important}

    body.lia-hl-navstack #lia-hl-btn{margin:0!important;width:22px!important;height:22px!important;border-radius:8px!important}
    body.lia-hl-navstack #lia-hl-btn .icon{width:15px!important;height:15px!important}
    body.lia-hl-navstack #lia-hl-btn .dot{right:2px!important;bottom:2px!important;width:6px!important;height:6px!important}
    body.lia-hl-navstack.lia-hl-active #lia-hl-btn{outline:none!important;box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--hl-ui-fg) 22%,transparent)!important}

    #lia-hl-panel{position:fixed!important;z-index:var(--hl-z)!important;display:none!important;width:180px!important;border-radius:12px!important;border:1px solid var(--hl-ui-border)!important;background-color:var(--hl-ui-bg)!important;box-shadow:var(--hl-ui-shadow)!important;backdrop-filter:blur(6px);overflow:hidden!important}
    body.lia-hl-panel-open #lia-hl-panel{display:block!important}
    #lia-hl-panel .hdr{display:none!important}
    #lia-hl-panel .body{display:flex!important;flex-direction:column!important;align-items:stretch!important;gap:10px!important;padding:12px!important}

    .hl-tools{display:flex!important;gap:8px!important}
    .hl-tool{border:1px solid var(--hl-ui-border)!important;background:transparent!important;color:var(--hl-ui-fg)!important;border-radius:8px!important;padding:7px!important;cursor:pointer!important;display:flex!important;align-items:center!important;justify-content:center!important;flex:1!important}
    .hl-tool.active{background:rgba(20,115,117,.12)!important;border-color:rgb(20,115,117)!important;color:rgb(20,115,117)!important}
    .hl-tool svg{display:block!important;width:18px!important;height:18px!important}
    #hl-tool-mark svg *{stroke:currentColor!important;fill:none!important}
    #hl-tool-erase svg *{fill:currentColor!important;stroke:none!important}

    .hl-colors{display:flex!important;flex-wrap:wrap!important;gap:6px!important;justify-content:center!important}
    .hl-swatch{width:24px!important;height:24px!important;border-radius:999px!important;border:2px solid transparent!important;cursor:pointer!important}
    .hl-swatch.active{outline:2px solid var(--hl-ui-fg)!important;outline-offset:2px!important}

    .hl-hint{display:block!important;font-size:10px!important;text-transform:uppercase!important;letter-spacing:.06em!important;opacity:.5!important;text-align:center!important;margin-bottom:6px!important}
    .hl-divider{border:none!important;border-top:1px solid var(--hl-ui-border)!important;margin:0!important;width:100%!important}

    .hl-clear{width:100%!important;border:1px solid rgba(200,0,0,.3)!important;background:rgba(200,0,0,.08)!important;border-radius:8px!important;padding:6px 8px!important;cursor:pointer!important;font-size:12px!important;color:rgba(180,0,0,.9)!important;text-align:center!important}

    .hlq-proxy .hlq-lia{display:inline-flex;align-items:center;gap:10px;font-size:0!important}
    .hlq-proxy .hlq-lia button,.hlq-proxy .hlq-lia [role="button"],.hlq-proxy .hlq-lia a{font-size:1rem!important}
    .hlq-proxy .hlq-lia input,.hlq-proxy .hlq-lia textarea,.hlq-proxy .hlq-lia select{display:none!important}
    .hlq-btn{appearance:none;border:1px solid var(--hl-ui-border);background:color-mix(in srgb,var(--hl-ui-fg) 6%,transparent);color:var(--hl-ui-fg);border-radius:12px;padding:8px 10px;font-weight:700;cursor:pointer;user-select:none}
    .hlq-btn:hover{border-color:color-mix(in srgb,var(--hl-accent) 45%,var(--hl-ui-border));background:color-mix(in srgb,var(--hl-accent) 10%,transparent)}
    .hlq-btn:active{background:color-mix(in srgb,var(--hl-accent) 14%,transparent)}
    .hlq-proxy .hlq-msg{margin-right:6px}
    .hlq-proxy .hlq-btn,.hlq-proxy .hlq-msg{display:none!important}
    body.lia-hlq-debug .hlq-proxy .hlq-btn{display:inline-flex!important}
    body.lia-hlq-debug .hlq-proxy .hlq-msg{display:inline!important}
  `);
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
    return hit;
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

// ─── Slide sync timer (10ms) — Step 5 will replace this ──────────────────────
I.__slideSyncTimer = ROOT_WIN.setInterval(() => {
  if (!I.__alive) {
    try { ROOT_WIN.clearInterval(I.__slideSyncTimer as number); } catch(e){}
    return;
  }
  if (!I.state.active && !(I.HL && I.HL.length)) return;
  doRender();
}, 10);

// ─── Tick (boot + DOM observer) ───────────────────────────────────────────────
function tick(): void {
  ensureCSS();
  if (I.ticking) return;
  I.ticking = true;

  ROOT_WIN.requestAnimationFrame(() => {
    try {
      ensureRootButtonAndPanel();
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

// ─── Boot ─────────────────────────────────────────────────────────────────────
tick();
doRender();
scheduleSync();
