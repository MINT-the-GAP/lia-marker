import { ROOT_WIN, ROOT_DOC, CONTENT_WIN, CONTENT_DOC, getContentRoot } from "./dom/context";
import cssQuiz    from "bundle-text:./css/quiz.css";
import cssContent from "bundle-text:./css/content.css";
import cssRoot    from "bundle-text:./css/root.css";
import type { Instance } from "./types";
import { render, checkLayoutAndRecalc, ensureLayoutResizeObserver } from "./highlight/render";
import { addHighlightFromSelection, findUserHighlightAtPoint } from "./highlight/store";
import { ensureRevealSlideObserver } from "./slides";
import { adaptUIVars } from "./theme";
import { ensureRootButtonAndPanel } from "./ui/button";
import { scheduleHLPosition } from "./ui/position";
import { ensureSwatchesOnce, applyUI, localizePanelText } from "./ui/panel";
import { wireRootDelegationOnce, wireUIOnce, wireContentEvents } from "./ui/events";
import { wireHLQEvents } from "./quiz/events";
import { ensureMarkerQuizGates } from "./quiz/metadata";
import { ensureMarkerQuizResolutions } from "./quiz/resolution";
import { explainSelectionWord } from "./explain";
import { layoutSignature } from "./highlight/render";
import { getActiveSlideId, slideIdFromNode, getSlideCandidates } from "./slides";
import { packedRectsFromRange } from "./dom/rects";
import { rangeFromAnchor } from "./dom/ranges";
import { clearOverlays, mountOverlay, removeOverlays } from "./highlight/overlay";
import {
  hasExternalAttributeChange, isExternalStylesheetMutation,
  isMarkerContentMutation, isMarkerStructureMutation,
} from "./dom/mutations";

// ─── Registry ────────────────────────────────────────────────────────────────
const REGKEY = "__LIA_TEXTMARKER_REG_V4__";
(ROOT_WIN as any)[REGKEY] = (ROOT_WIN as any)[REGKEY] || { instances: {} };
const REG = (ROOT_WIN as any)[REGKEY];

const DOC_ID =
  (CONTENT_DOC.baseURI || CONTENT_WIN.location.href || "") +
  "::" +
  (CONTENT_DOC.title || "");

function stopInstance(instance: Instance, timerWindow: Window): void {
  try { instance.moSlides?.disconnect(); } catch(e){}
  try { if (typeof instance.__cleanupPosition === "function") instance.__cleanupPosition(); } catch(e){}
  try { instance.__cleanupQuizGates?.(); } catch(e){}
  try { instance.__cleanupResolutions?.(); } catch(e){}
  try { instance.__alive = false; } catch(e){}
  try { instance.moDock?.disconnect(); } catch(e){}
  try { instance.moTheme?.disconnect(); } catch(e){}
  try { instance.moResolutions?.disconnect(); } catch(e){}
  try { instance.roLayout?.disconnect(); } catch(e){}
  try {
    for (const timer of instance.posTimers || []) timerWindow.clearTimeout(timer);
    instance.posTimers = [];
  } catch(e){}
  try {
    if (instance.__layoutTimer) {
      timerWindow.clearInterval(instance.__layoutTimer as number);
    }
  } catch(e){}
  try { removeOverlays(); } catch(e){}
}

function cleanupLegacyLiveEditorHost(): void {
  try {
    const frame = ROOT_WIN.frameElement as HTMLElement | null;
    if (frame?.id !== "liascript-preview") return;

    const hostWindow = ROOT_WIN.parent as Window & typeof globalThis;
    if (!hostWindow || hostWindow === ROOT_WIN) return;
    const hostDocument = hostWindow.document;
    const legacyRegistry = (hostWindow as any)[REGKEY];
    const legacyInstance = legacyRegistry?.instances?.[DOC_ID] as
      Instance | undefined;

    if (legacyInstance) {
      stopInstance(legacyInstance, hostWindow);
      delete legacyRegistry.instances[DOC_ID];
    }

    for (const id of [
      "lia-hl-ui-overlay-v1",
      "lia-hl-inline-slot-v1",
      "lia-hl-panel",
      "lia-hl-root-style-v4",
    ]) {
      hostDocument.getElementById(id)?.remove();
    }
    hostDocument.body.classList.remove(
      "lia-hl-active",
      "lia-hl-panel-open",
      "lia-hl-navstack",
    );
  } catch(e){}
}

cleanupLegacyLiveEditorHost();

// ─── Teardown previous instance ───────────────────────────────────────────────
const prev: Instance | undefined = REG.instances[DOC_ID];
if (prev?.__alive) {
  stopInstance(prev, ROOT_WIN);
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
  moResolutions: null,
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
  if (old) {
    if (old.textContent !== css) old.textContent = css;
    return;
  }
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

function joinMacroParts(parts: string[]): string {
  const nonEmpty = parts.map(r => r ?? "").filter(p => p.length > 0);
  if (!nonEmpty.length) return "";
  let out = nonEmpty[0];
  for (let i = 1; i < nonEmpty.length; i++) {
    out += /^\s/.test(nonEmpty[i]) ? `,${nonEmpty[i]}` : `, ${nonEmpty[i]}`;
  }
  return out;
}

function normalizePackedChunks(rawChunks: string[]): string[] {
  const chunks = rawChunks
    .map((x) => x ?? "")
    .filter((x) => x.length > 0)
    .filter((x) => !/^@\d+$/.test(x));

  if (!chunks.length) return [];

  // If a base chunk exists, drop synthesized "baseN" / "base.N" variants.
  const chunkSet = new Set(chunks);
  const noShadowedIndexed = chunks.filter((part) => {
    const m = part.match(/^(.*?)(\.?)(\d{1,3})$/);
    if (!m) return true;
    const baseDirect = m[1];           // e.g. "text" from "text0"
    const baseDotted = `${m[1]}.`;     // e.g. "text." from "text.0"
    // drop if the plain base or the dot-prefixed base already exists as its own chunk
    return !chunkSet.has(baseDirect) && !chunkSet.has(baseDotted);
  });

  // LiaScript can emit repeated indexed variants of the same chunk.
  // Collapse patterns like "text.0|text.1|text.2" to a single "text".
  const indexed = noShadowedIndexed.map((part) => {
    const m = part.match(/^(.*?)(\.?)(\d{1,3})$/);
    if (!m) return null;
    const base = m[2] === "." ? `${m[1]}.` : m[1];
    return { base, idx: Number(m[3]) };
  });

  if (indexed.length > 1 && indexed.every((x) => x !== null)) {
    const concrete = indexed as Array<{ base: string; idx: number }>;
    const baseSet = new Set(concrete.map((x) => x.base));
    if (baseSet.size === 1) {
      const sorted = concrete.map((x) => x.idx).sort((a, b) => a - b);
      let consecutive = sorted[0] === 0;
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] !== sorted[i - 1] + 1) {
          consecutive = false;
          break;
        }
      }
      if (consecutive) return [concrete[0].base];
    }
  }

  return noShadowedIndexed;
}

function normalizeMacroCommaArgs(): void {
  const nodes = CONTENT_DOC.querySelectorAll<HTMLElement>(".lia-hl-target, .lia-hl-prefill");
  nodes.forEach((el) => {
    const carriers = Array.from(el.querySelectorAll<HTMLElement>("[data-hl-extra]"));
    if (!carriers.length) return;

    const parts: string[] = [];
    for (const carrier of carriers) {
      const packed = carrier.getAttribute("data-hl-extra") || "";
      const chunks = normalizePackedChunks(packed.split("|"));
      parts.push(...chunks);
      carrier.remove();
    }

    const tail = joinMacroParts(parts);
    if (tail) el.appendChild(CONTENT_DOC.createTextNode(tail));
  });
}

// ─── Overlay ──────────────────────────────────────────────────────────────────
function ensureOverlay(): HTMLElement {
  let overlay = CONTENT_DOC.getElementById("lia-hl-overlay");
  if (!overlay) {
    overlay = CONTENT_DOC.createElement("div");
    overlay.id = "lia-hl-overlay";
  }
  mountOverlay(overlay);
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

// Highlight layers scroll with their content. Only slide visibility may need
// updating when a presentation chooses its active section from the viewport.
CONTENT_DOC.addEventListener("scroll", () => {
  if (!I.__alive) return;
  if (getSlideCandidates().length >= 2 && getActiveSlideId() !== I.__activeSlide) scheduleRender();
}, { passive: true, capture: true });
CONTENT_WIN.addEventListener("resize", () => {
  if (!I.__alive) return;
  scheduleThemeUpdate();
  scheduleRender();
  scheduleHLPosition(I);
});

// ─── Content interaction ──────────────────────────────────────────────────────
wireContentEvents(
  I,
  doRender,
  () => addHighlightFromSelection(I, doRender),
  () => explainSelectionWord(),
  (x: number, y: number) => {
    const hit = findUserHighlightAtPoint(I, x, y);
    if (hit) { I.HL = I.HL.filter(h => h.id !== hit.id); }
    return !!hit;
  }
);

wireHLQEvents(I, doRender);

// ─── Position helpers ─────────────────────────────────────────────────────────
// Theme updates are independent of content initialization and share a pending
// flag, so several source mutations in one turn cause only one style pass.
let themeDirty = true;
let themePending = false;
const themeSources = new Map<Element, boolean>();

function updateTheme(): void {
  if (!I.__alive || !themeDirty) return;
  themeDirty = false;
  adaptUIVars();
  localizePanelText();
  applyUI(I);
  scheduleHLPosition(I);
}

function scheduleThemeUpdate(): void {
  if (!I.__alive) return;
  themeDirty = true;
  if (themePending) return;
  themePending = true;
  ROOT_WIN.requestAnimationFrame(() => {
    themePending = false;
    updateTheme();
  });
}

function refreshThemeSources(): void {
  if (!I.moTheme) return;
  const wanted = new Map<Element, boolean>();
  for (const doc of new Set([ROOT_DOC, CONTENT_DOC])) {
    wanted.set(doc.documentElement, false);
    if (doc.body) wanted.set(doc.body, false);
  }
  const main = CONTENT_DOC.querySelector("main:not([hidden])") ||
    CONTENT_DOC.querySelector("[role='main']:not([hidden])") || CONTENT_DOC.body;
  for (let node: Element | null = main; node; node = node.parentElement) {
    wanted.set(node, false);
  }
  for (const header of ROOT_DOC.querySelectorAll("#lia-toolbar-nav, header.lia-header")) {
    wanted.set(header, true);
  }
  if (wanted.size === themeSources.size &&
      Array.from(wanted).every(([node, subtree]) => themeSources.get(node) === subtree)) return;
  I.moTheme.disconnect();
  themeSources.clear();
  for (const [node, subtree] of wanted) {
    I.moTheme.observe(node, {
      attributes: true, attributeOldValue: true, subtree,
      attributeFilter: ["class", "style", "hidden", "data-theme", "data-mode", "data-view", "data-layout", "lang", "data-language"],
    });
    themeSources.set(node, subtree);
  }
  themeDirty = true;
}

// ─── Slide sync ───────────────────────────────────────────────────────────────
let syncPending = false;
let lastSyncSlide: string | null = null;

function scheduleSync(): void {
  if (!I.__alive || syncPending) return;
  syncPending = true;
  try { clearOverlays(overlay); } catch(e){}
  const run = () => {
    syncPending = false;
    if (!I.__alive) return;
    // Reveal also reports ordinary content edits. Track the actual slide
    // independently of highlight filtering (which uses null for one slide).
    const activeSlide = getActiveSlideId();
    const slideChanged = activeSlide !== lastSyncSlide;
    lastSyncSlide = activeSlide;
    doRender();
    refreshThemeSources();
    updateTheme();
    if (slideChanged) scheduleHLPosition(I);
  };
  try { ROOT_WIN.requestAnimationFrame(run); }
  catch(e) { ROOT_WIN.setTimeout(run, 0); }
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
let structureDirty = true;
function tick(): void {
  // Coalesce before any preprocessing or DOM writes, not only before layout.
  if (!I.__alive || I.ticking) return;
  I.ticking = true;

  ROOT_WIN.requestAnimationFrame(() => {
    try {
      if (!I.__alive) return;
      ensureCSS();
      normalizeMacroCommaArgs();
      ensureMarkerQuizResolutions(I);
      ensureMarkerQuizGates(I);
      ensureRootButtonAndPanel();
      localizePanelText();
      wireRootDelegationOnce(I, doRender);
      if (overlay.parentElement !== getContentRoot()) doRender();
      ensureLayoutResizeObserver(I, render, overlay);
      ensureRevealSlideObserver(I, () => scheduleSync());
      checkLayoutAndRecalc(I, render, overlay);
      ensureSwatchesOnce(I, () => applyUI(I));
      doRender();
      wireUIOnce(I, doRender);
      refreshThemeSources();
      updateTheme();
      applyUI(I);
      if (structureDirty) scheduleHLPosition(I);
      structureDirty = false;
    } finally {
      I.ticking = false;
    }
  });
}

try {
  I.moDock = new ROOT_WIN.MutationObserver(records => {
    if (!I.__alive) return;
    const structureChanged = records.some(isMarkerStructureMutation);
    if (structureChanged) structureDirty = true;
    if (structureChanged || records.some(isMarkerContentMutation)) tick();
    if (records.some(isExternalStylesheetMutation)) scheduleThemeUpdate();
  });
  // An embedded content document is not part of the root document's subtree.
  for (const doc of new Set([ROOT_DOC, CONTENT_DOC])) {
    I.moDock.observe(doc.documentElement, { childList: true, subtree: true });
    doc.addEventListener("load", event => {
      if (!I.__alive) return;
      const target = event.target as Element | null;
      if (target?.nodeType === 1 && target.matches('link[rel="stylesheet"]')) scheduleThemeUpdate();
    }, true);
  }
} catch(e){}

try {
  I.moTheme = new ROOT_WIN.MutationObserver(records => {
    if (!I.__alive || !records.some(hasExternalAttributeChange)) return;
    refreshThemeSources();
    scheduleThemeUpdate();
  });
  refreshThemeSources();
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
