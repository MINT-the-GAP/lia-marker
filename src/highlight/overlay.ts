import { CONTENT_DOC, CONTENT_WIN, getContentRoot } from "../dom/context";

const LAYER_SELECTOR = "#lia-hl-overlay, .lia-hl-scroll-overlay";
const layers = new Map<Element, HTMLElement>();

function prepareHost(host: Element): void {
  // Keep the content and its highlights in one stacking context below the UI.
  host.setAttribute("data-lia-hl-container", "");
  if (CONTENT_WIN.getComputedStyle(host).position === "static") {
    host.setAttribute("data-lia-hl-positioned", "");
  }
}

export function mountOverlay(overlay: Element): Element {
  const host = getContentRoot();
  prepareHost(host);
  // Append only: stored anchors use child-node indices, so inserting before
  // existing content (or wrapping it) would invalidate saved selections.
  if (overlay.parentElement !== host) host.appendChild(overlay);
  return host;
}

export function clearOverlays(overlay: Element): void {
  overlay.replaceChildren();
  for (const [host, layer] of layers) {
    layer.replaceChildren();
    if (!host.isConnected || layer.parentElement !== host) {
      layer.remove();
      layers.delete(host);
    }
  }
}

export function overlayForRange(range: Range, overlay: Element): Element {
  const root = overlay.parentElement!;
  let host = range.commonAncestorContainer.nodeType === 1
    ? range.commonAncestorContainer as Element
    : range.commonAncestorContainer.parentElement;

  // A nested scroll area needs its own layer so that native scrolling and
  // overflow clipping apply there too, without waiting for a scroll handler.
  for (; host && host !== root && root.contains(host); host = host.parentElement) {
    const style = CONTENT_WIN.getComputedStyle(host);
    if (![style.overflowX, style.overflowY].some(value => /^(auto|scroll|overlay|hidden|clip)$/.test(value))) continue;
    prepareHost(host);
    let layer = layers.get(host);
    if (!layer) {
      layer = CONTENT_DOC.createElement("div");
      layer.className = "lia-hl-scroll-overlay";
      host.appendChild(layer);
      layers.set(host, layer);
    }
    return layer;
  }
  return overlay;
}

export function isOverlayMutation(record: MutationRecord): boolean {
  const target = record.target.nodeType === 1
    ? record.target as Element
    : record.target.parentElement;
  if (target?.closest(LAYER_SELECTOR)) return true;
  const changed = [...record.addedNodes, ...record.removedNodes];
  return changed.length > 0 && changed.every(node =>
    node.nodeType === 1 && (node as Element).matches(LAYER_SELECTOR)
  );
}

export function removeOverlays(): void {
  CONTENT_DOC.querySelectorAll(LAYER_SELECTOR).forEach(layer => layer.remove());
  layers.clear();
  CONTENT_DOC.querySelectorAll("[data-lia-hl-container]").forEach(host => {
    host.removeAttribute("data-lia-hl-container");
    host.removeAttribute("data-lia-hl-positioned");
  });
}
