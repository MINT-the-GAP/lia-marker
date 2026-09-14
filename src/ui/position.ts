import { ROOT_WIN, ROOT_DOC } from "../dom/context";
import type { Instance } from "../types";
import { getViewport, measureHLButton, applyHLButton } from "./button";
import { measurePanel, applyPanelPosition } from "./panel";

const toolbar = "#lia-toolbar-nav, header.lia-header, .lia-header__left, #lia-btn-toc, #lia-toc";
const anchors = `${toolbar}, .lia-canvas, #lia-tff-inline-slot-v2`;
const structure = `${anchors}, #lia-tff-btn-v2`;
const ownUI = "#lia-hl-ui-overlay-v1, #lia-hl-panel, #lia-hl-overlay, [data-lia-hl-overlay]";
interface PositionState { frame: number | null; refresh: () => void; }
const states = new WeakMap<Instance, PositionState>();

function externalClasses(value: string | null): string {
  return (value || "").split(/\s+/).filter(c => c && !c.startsWith("lia-hl")).sort().join(" ");
}

function initialize(I: Instance): PositionState {
  const state: PositionState = { frame: null, refresh: () => {} };
  states.set(I, state);
  const schedule = () => scheduleHLPosition(I);
  const removers: (() => void)[] = [];
  function listen(target: EventTarget, name: string, callback: EventListener, capture = false): void {
    target.addEventListener(name, callback, { passive: true, capture });
    removers.push(() => target.removeEventListener(name, callback, capture));
  }
  listen(ROOT_WIN, "resize", schedule);
  listen(ROOT_DOC, "scroll", event => {
    const target = event.target;
    if (target === ROOT_DOC || (target as Element)?.querySelector?.(toolbar)) schedule();
  }, true);
  if (ROOT_WIN.visualViewport) {
    listen(ROOT_WIN.visualViewport, "resize", schedule);
    listen(ROOT_WIN.visualViewport, "scroll", schedule);
  }
  // Delegation survives toolbar/TOC replacement. Only actual transition events
  // request another frame; there is no timed burst or permanent polling loop.
  const navEvent: EventListener = event => {
    const target = event.target as Element;
    if (target?.closest?.(toolbar)) schedule();
  };
  listen(ROOT_DOC, "click", navEvent, true);
  for (const event of ["transitionrun", "transitionend", "transitioncancel", "animationend"]) {
    listen(ROOT_DOC, event, navEvent, true);
  }
  const observed = new Set<Element>();
  const resize = typeof ROOT_WIN.ResizeObserver === "function" ? new ROOT_WIN.ResizeObserver(schedule) : null;
  state.refresh = () => {
    const current = new Set(ROOT_DOC.querySelectorAll(`${anchors}, #lia-hl-panel`));
    for (const el of observed) if (!current.has(el)) { resize?.unobserve(el); observed.delete(el); }
    for (const el of current) if (!observed.has(el)) { resize?.observe(el); observed.add(el); }
  };
  const mutations = new ROOT_WIN.MutationObserver(records => {
    let relevant = false;
    let changedStructure = false;
    for (const record of records) {
      const target = record.target as Element;
      if (target.closest?.(ownUI)) continue;
      if (record.type === "attributes") {
        // Never follow a peer's absolute position/display. Older board-mode
        // versions rewrite them every RAF and hide the peer on pinch resize.
        if (!(target.matches?.(anchors) || target === ROOT_DOC.body || target === ROOT_DOC.documentElement)) continue;
        if (record.attributeName === "class") {
          if (externalClasses(record.oldValue) === externalClasses(target.getAttribute("class"))) continue;
        } else if (record.oldValue === target.getAttribute(record.attributeName!)) continue;
        // Root theme styles cannot move our fixed coordinate origin. Theme
        // handling and real element size changes have their own observers.
        if (record.attributeName === "style" && (target === ROOT_DOC.body || target === ROOT_DOC.documentElement)) continue;
        relevant = true;
      } else {
        const changed = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)];
        if (changed.some(node => node.nodeType === 1 && ((node as Element).matches(structure) || (node as Element).querySelector(structure)))) {
          relevant = changedStructure = true;
        } else if (target.closest?.(toolbar)) relevant = true;
      }
    }
    if (changedStructure) state.refresh();
    if (relevant) schedule();
  });
  mutations.observe(ROOT_DOC.documentElement, {
    subtree: true, childList: true, attributes: true, attributeOldValue: true,
    attributeFilter: ["class", "style", "hidden", "aria-hidden", "data-mode", "data-view", "data-layout"],
  });
  state.refresh();
  I.__cleanupPosition = () => {
    if (state.frame !== null) ROOT_WIN.cancelAnimationFrame(state.frame);
    mutations.disconnect();
    resize?.disconnect();
    for (const remove of removers) remove();
    states.delete(I);
  };
  return state;
}

/** The only entry point for UI geometry: at most one read/write pass per RAF. */
export function scheduleHLPosition(I: Instance): void {
  if (!I.__alive) return;
  const state = states.get(I) || initialize(I);
  if (state.frame !== null) return;
  state.frame = ROOT_WIN.requestAnimationFrame(() => {
    state.frame = null;
    if (!I.__alive) return;
    // Read the viewport, anchors and open panel before writing any position.
    const viewport = getViewport();
    const button = measureHLButton(viewport);
    const panel = measurePanel(I, button, viewport);
    applyHLButton(button);
    applyPanelPosition(panel);
  });
}
