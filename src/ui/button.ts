import { ROOT_WIN, ROOT_DOC } from "../dom/context";
import type { Instance } from "../types";

const HL_UI_OVERLAY_ID = "lia-hl-ui-overlay-v1";
const HL_INLINE_SLOT_ID = "lia-hl-inline-slot-v1";

export function findHeaderLeft(): Element | null {
  const header = ROOT_DOC.querySelector("header#lia-toolbar-nav") || ROOT_DOC.querySelector("#lia-toolbar-nav");
  if (!header) return null;
  return header.querySelector(".lia-header__left") || null;
}

export function findTOCButtonInLeft(left: Element | null): Element | null {
  if (!left) return null;
  const btns = Array.from(left.querySelectorAll("button,[role='button'],a"));
  if (!btns.length) return null;
  const pick = btns.find(b => {
    const t = ((b.getAttribute("aria-label") || b.getAttribute("title") || b.textContent || "") + "").toLowerCase();
    return t.includes("inhaltsverzeichnis") || t.includes("table of contents") || t.includes("contents");
  });
  return pick || btns[0];
}

function getHLTOCButtonRect(): DOMRect | null {
  const tocBtn = ROOT_DOC.getElementById("lia-btn-toc") || findTOCButtonInLeft(findHeaderLeft());
  if (!tocBtn) return null;
  try {
    const r = tocBtn.getBoundingClientRect();
    if (!r || r.width < 6 || r.height < 6) return null;
    return r;
  } catch (e) { return null; }
}

function isHLStackPeerVisible(el: Element | null): boolean {
  if (!el) return false;
  try {
    const cs = ROOT_WIN.getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return !!(r && r.width > 4 && r.height > 4);
  } catch (e) { return false; }
}

function getHLNightlyStackIndex(): number {
  const order = ["lia-tff-btn-v2", "lia-hl-btn"];
  let idx = 0;
  for (const id of order) {
    if (id === "lia-hl-btn") return idx;
    const el = ROOT_DOC.getElementById(id);
    if (isHLStackPeerVisible(el)) idx++;
  }
  return idx;
}

export function shouldUseHLNightlyStackDock(): boolean {
  const canvas = ROOT_DOC.querySelector(".lia-canvas");
  if (!canvas) return false;
  return canvas.classList.contains("lia-navigation--hidden") && canvas.classList.contains("lia-mode--presentation");
}

export function ensureHLUIOverlay(): HTMLElement {
  let overlay = ROOT_DOC.getElementById(HL_UI_OVERLAY_ID);
  if (!overlay) {
    overlay = ROOT_DOC.createElement("div");
    overlay.id = HL_UI_OVERLAY_ID;
    ROOT_DOC.body.appendChild(overlay);
  }
  return overlay;
}

function ensureHLInlineSlot(): HTMLElement | null {
  const left = findHeaderLeft();
  if (!left) return null;

  let slot = ROOT_DOC.getElementById(HL_INLINE_SLOT_ID);
  if (!slot) {
    slot = ROOT_DOC.createElement("div");
    slot.id = HL_INLINE_SLOT_ID;
  }

  const tocBtn = ROOT_DOC.getElementById("lia-btn-toc") || findTOCButtonInLeft(left);

  if (tocBtn && tocBtn.parentNode === left) {
    if (slot.parentNode !== left) {
      if (tocBtn.nextSibling) left.insertBefore(slot, tocBtn.nextSibling);
      else left.appendChild(slot);
    } else if (slot.previousSibling !== tocBtn) {
      if (tocBtn.nextSibling) left.insertBefore(slot, tocBtn.nextSibling);
      else left.appendChild(slot);
    }
  } else if (slot.parentNode !== left) {
    left.insertBefore(slot, left.firstChild || null);
  }

  return slot;
}

function placeHLButtonInCorrectHost(): void {
  const btn = ROOT_DOC.getElementById("lia-hl-btn");
  const overlay = ensureHLUIOverlay();
  if (!btn || !overlay) return;

  if (btn.parentNode !== overlay) overlay.appendChild(btn);

  const slot = ROOT_DOC.getElementById(HL_INLINE_SLOT_ID);
  if (slot && slot.parentNode) slot.parentNode.removeChild(slot);

  overlay.style.left = "0px";
  overlay.style.top = "0px";
  btn.style.left = "";
  btn.style.top = "";
}

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function getViewport(): { w: number; h: number; ox: number; oy: number } {
  const vv = ROOT_WIN.visualViewport;
  if (vv) return { w: vv.width, h: vv.height, ox: vv.offsetLeft || 0, oy: vv.offsetTop || 0 };
  const de = ROOT_DOC.documentElement;
  return { w: de.clientWidth, h: de.clientHeight, ox: 0, oy: 0 };
}

export function positionHLButton(): void {
  const btn = ROOT_DOC.getElementById("lia-hl-btn");
  const overlay = ensureHLUIOverlay();
  if (!btn || !overlay) return;

  placeHLButtonInCorrectHost();

  const vp = getViewport();
  const pad = 8, gap = 8;

  let bw = 40, bh = 40;
  try {
    const br = btn.getBoundingClientRect();
    if (br && br.width > 6 && br.height > 6) { bw = br.width; bh = br.height; }
  } catch (e) { }

  let left = pad, top = pad;
  const tocRect = getHLTOCButtonRect();

  if (tocRect) {
    if (shouldUseHLNightlyStackDock()) {
      const stackIndex = getHLNightlyStackIndex();
      const stackGap = 6, stackPitch = 28;
      left = tocRect.left + (tocRect.width - bw) / 2;
      top = tocRect.bottom + stackGap + stackIndex * stackPitch;
    } else {
      left = tocRect.right + gap;
      top = tocRect.top + (tocRect.height - bh) / 2;
    }
  } else {
    const leftHost = findHeaderLeft();
    const hostRect = leftHost ? leftHost.getBoundingClientRect() : null;
    if (hostRect) { left = hostRect.left + 8; top = hostRect.top + 8; }
  }

  left = clamp(left, pad, vp.w - bw - pad);
  top = clamp(top, pad, vp.h - bh - pad);

  overlay.style.left = `${Math.round(vp.ox)}px`;
  overlay.style.top = `${Math.round(vp.oy)}px`;
  btn.style.left = `${Math.round(left)}px`;
  btn.style.top = `${Math.round(top)}px`;
}

export function detectNavStack(): void {
  ROOT_DOC.body.classList.toggle("lia-hl-navstack", shouldUseHLNightlyStackDock());
}

export function ensureRootButtonAndPanel(): void {
  const overlayRoot = ensureHLUIOverlay();

  let btn = ROOT_DOC.getElementById("lia-hl-btn");
  if (!btn) {
    const button = ROOT_DOC.createElement("button");
    button.id = "lia-hl-btn";
    button.type = "button";
    button.setAttribute("aria-label", "Text Highlighter");
    button.setAttribute("title", "Text Highlighter");
    btn = button;
    btn.innerHTML = `
      <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0 0-3L16.5 4.5a2.1 2.1 0 0 0-3 0L3 15v5z"
              fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      <span class="dot" id="lia-hl-dot"></span>
    `;
    overlayRoot.appendChild(btn);
  }

  let panel = ROOT_DOC.getElementById("lia-hl-panel");
  if (!panel) {
    panel = ROOT_DOC.createElement("div");
    panel.id = "lia-hl-panel";
    panel.innerHTML = `
      <div class="hdr"><div class="title">Textmarker</div></div>
      <div class="body">
        <div class="hl-tools">
          <button class="hl-tool" id="hl-tool-mark" type="button" aria-label="Highlight" title="Highlight">
            <svg viewBox="0 0 512 512" aria-hidden="true">
              <g transform="translate(-15 -75) scale(25)">
                <path d="M4 20h4l10.2-10.2a2.2 2.2 0 0 0 0-3.1l-1.1-1.1a2.2 2.2 0 0 0-3.1 0L3.8 15.8 3 21z"
                      fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M13.2 6.8l4 4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
                <path d="M3.5 20.5h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
              </g>
            </svg>
          </button>
          <button class="hl-tool" id="hl-tool-erase" type="button" aria-label="Eraser" title="Eraser">
            <svg viewBox="0 0 512 512" aria-hidden="true">
              <path fill="currentColor" d="M490.3,133.177l-99.5-99.6c-33-33-74-11.4-85.5,0l-287.6,287.7c-23.6,23.6-23.6,61.9,0,85.5l81.1,81.1c2.6,2.6,6.2,4.1,10,4.1h102.4c3.7,0,7.3-1.5,10-4.1l269.2-269.2C513.9,195.077,513.9,156.777,490.3,133.177zM205.3,463.777h-90.7l-77-77c-12.6-12.6-12.6-33,0-45.5l67.4-67.4l145.1,145.1L205.3,463.777zM470.4,198.677l-200.3,200.3L125,253.877l200.3-200.3c6.1-6.1,27-18.5,45.5,0l99.5,99.5C482.9,165.777,482.9,186.177,470.4,198.677z"/>
            </svg>
          </button>
        </div>
        <hr class="hl-divider">
        <div>
          <div class="hl-hint">Color</div>
          <div class="hl-colors" id="hl-colors"></div>
        </div>
        <hr class="hl-divider">
        <button class="hl-clear" id="hl-clear" type="button" title="Remove all highlights">Clear all</button>
      </div>
    `;
    ROOT_DOC.body.appendChild(panel);
  }

  placeHLButtonInCorrectHost();
}

function clearHLPosTimers(I: Instance): void {
  try {
    if (!I.posTimers) I.posTimers = [];
    while (I.posTimers.length) ROOT_WIN.clearTimeout(I.posTimers.pop()!);
  } catch (e) { }
}

export function scheduleHLRepositionBurst(
  I: Instance,
  positionFn: () => void
): void {
  clearHLPosTimers(I);
  positionFn();

  ROOT_WIN.requestAnimationFrame(() => {
    ROOT_WIN.requestAnimationFrame(() => { positionFn(); });
  });

  const delays = [10, 20, 30];
  for (const ms of delays) {
    I.posTimers.push(ROOT_WIN.setTimeout(() => { positionFn(); }, ms));
  }
}

export function scheduleHLRepositionBurstThrottled(
  I: Instance,
  positionFn: () => void
): void {
  const now = Date.now();
  if (now - (I.lastBurstAt || 0) < 80) return;
  I.lastBurstAt = now;
  scheduleHLRepositionBurst(I, positionFn);
}
