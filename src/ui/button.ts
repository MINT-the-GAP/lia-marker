import { ROOT_WIN, ROOT_DOC } from "../dom/context";
import { setStyle, toggleClass } from "./style";

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

export interface Viewport { w: number; h: number; ox: number; oy: number; }
export interface ButtonLayout {
  left: number; top: number; width: number; height: number; stacked: boolean;
}
interface AnchorRect { left: number; top: number; right: number; bottom: number; width: number; height: number; }
const lastAnchors = new Map<boolean, AnchorRect>();
let inlinePeerExtent = 46;
let layoutSize = "";

export function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export function getViewport(): Viewport {
  const vv = ROOT_WIN.visualViewport;
  if (vv) return { w: vv.width, h: vv.height, ox: vv.offsetLeft, oy: vv.offsetTop };
  const de = ROOT_DOC.documentElement;
  return { w: de.clientWidth, h: de.clientHeight, ox: 0, oy: 0 };
}

function readAnchor(stacked: boolean): AnchorRect | null {
  // Every anchor belongs to ROOT_DOC, as do the fixed UI hosts. CONTENT_DOC
  // rectangles must never enter this calculation without a frame conversion.
  const toc = ROOT_DOC.getElementById("lia-btn-toc") || findTOCButtonInLeft(findHeaderLeft());
  const anchor = toc || findHeaderLeft();
  if (anchor) {
    const style = ROOT_WIN.getComputedStyle(anchor);
    const r = anchor.getBoundingClientRect();
    // Being outside the visual viewport (or fading) does not change strategy.
    if (style.display !== "none" && style.visibility !== "hidden" && r.width > 6 && r.height > 6) {
      const rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
      lastAnchors.set(stacked, rect);
      return rect;
    }
  }
  // A temporarily hidden/replaced toolbar keeps its last layout anchor.
  return lastAnchors.get(stacked) || null;
}

/** Read only. All coordinates and lengths are ROOT_DOC layout-viewport CSS px. */
export function measureHLButton(vp: Viewport): ButtonLayout {
  const currentSize = `${ROOT_DOC.documentElement.clientWidth},${ROOT_DOC.documentElement.clientHeight}`;
  if (currentSize !== layoutSize) {
    // A genuine layout resize invalidates hidden anchor geometry. Pinch/pan
    // changes visualViewport only and must not clear this stable anchor.
    lastAnchors.clear();
    layoutSize = currentSize;
  }
  const stacked = shouldUseHLNightlyStackDock();
  // These dimensions are the explicit sizes in root.css, independent of the
  // previous frame's navstack class and of lia-board-mode's animation frame.
  const size = stacked ? 22 : 40;
  const anchor = readAnchor(stacked);
  const peer = ROOT_DOC.getElementById("lia-tff-btn-v2");
  const slot = ROOT_DOC.getElementById("lia-tff-inline-slot-v2");
  const hasPeer = !!(peer || slot);
  if (!hasPeer) inlinePeerExtent = 46;
  if (!stacked && slot && anchor && slot.parentElement === findHeaderLeft()) {
    const r = slot.getBoundingClientRect();
    // The permanent inline slot is normal-flow layout, not a peer button's
    // potentially stale absolute position. Keep its extent while it is hidden.
    if (r.width > 6 && r.right > anchor.right && Math.abs(r.top - anchor.top) < anchor.height) {
      inlinePeerExtent = r.right - anchor.right;
    }
  }
  const lane = hasPeer ? (stacked ? 28 : inlinePeerExtent) : 0;
  let left = anchor ? (stacked ? anchor.left + (anchor.width - size) / 2 : anchor.right + 8) : vp.ox + 8;
  let top = anchor ? (stacked ? anchor.bottom + 6 : anchor.top + (anchor.height - size) / 2) : vp.oy + 8;
  // Clamp the whole reserved group, so the second tool cannot collapse onto
  // the first at an edge. Offsets occur exactly once: in these layout bounds.
  left = clamp(left, vp.ox + 8, vp.ox + vp.w - size - (stacked ? 0 : lane) - 8);
  top = clamp(top, vp.oy + 8, vp.oy + vp.h - size - (stacked ? lane : 0) - 8);
  return { left: left + (stacked ? 0 : lane), top: top + (stacked ? lane : 0), width: size, height: size, stacked };
}

/** Write only; panel geometry has already been measured using this layout. */
export function applyHLButton(layout: ButtonLayout): void {
  const btn = ROOT_DOC.getElementById("lia-hl-btn");
  if (!btn) return;
  toggleClass(ROOT_DOC.body, "lia-hl-navstack", layout.stacked);
  setStyle(btn, "left", `${layout.left}px`);
  setStyle(btn, "top", `${layout.top}px`);
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
          <div class="hl-hint translate" id="hl-color-label" data-hl-i18n="color" translate="yes">Color</div>
          <div class="hl-colors" id="hl-colors"></div>
        </div>
        <hr class="hl-divider">
        <button class="hl-explain translate" id="hl-tool-explain" data-hl-i18n="explain_word" type="button" title="Explain selected word" translate="yes">Explain Word</button>
        <hr class="hl-divider">
        <button class="hl-clear translate" id="hl-clear" data-hl-i18n="clear_all" type="button" title="Remove all highlights" translate="yes">Clear all</button>
      </div>
    `;
    ROOT_DOC.body.appendChild(panel);
  }

  if (btn.parentNode !== overlayRoot) overlayRoot.appendChild(btn);
  // One-time migration from older inline/translated hosts. Never reset these
  // positions during a measurement or a viewport event.
  ROOT_DOC.getElementById(HL_INLINE_SLOT_ID)?.remove();
  setStyle(overlayRoot, "left", "0px");
  setStyle(overlayRoot, "top", "0px");
}
