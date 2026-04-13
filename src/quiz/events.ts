import { CONTENT_DOC } from "../dom/context";
import type { Instance } from "../types";
import { evalScope } from "./eval";
import { solveScope } from "./solve";

function isForeignToolUi(node: Node | null): boolean {
  const el = (node && node.nodeType === 1) ? node as Element : (node as any)?.parentElement as Element | null;
  if (!el) return false;
  return !!el.closest([
    "[data-hlq-ignore='1']", "[data-lia-hlq-ignore='1']", "[data-lia-canvas-ui='1']",
    ".lia-tool-menu", ".lia-undo-btn", ".lia-redo-btn", ".lia-color-btn",
    ".lia-eraser-btn", ".lia-rect-btn", ".lia-bgmenu-btn",
    ".lia-annot-btn", ".lia-annot-toolbar", ".lia-annot-menu", ".lia-annot-panel"
  ].join(","));
}

function isRelevantHLQArea(node: Node | null): boolean {
  const el = (node && node.nodeType === 1) ? node as Element : (node as any)?.parentElement as Element | null;
  if (!el) return false;
  if (isForeignToolUi(el)) return false;
  return !!el.closest(".hlq-proxy, .hlq-lia, .markerquiz");
}

function getLiaInput(proxy: Element): HTMLInputElement | null {
  return (
    proxy.querySelector(".hlq-lia input, .hlq-lia textarea, .hlq-lia select") ||
    proxy.querySelector("input, textarea, select")
  ) as HTMLInputElement | null;
}

function getLiaButtons(proxy: Element): Element[] {
  const inside = (root: Element) =>
    Array.from(root.querySelectorAll("button,[role='button'],a"))
      .filter(b => !b.closest("button.hlq-btn"));

  const wrap = proxy.querySelector(".hlq-lia");
  let btns = wrap ? inside(wrap) : [];
  if (!btns.length) btns = inside(proxy);
  return btns;
}

function inferActionLoose(btn: Element): "check" | "solve" | null {
  const el = btn?.closest?.("button,[role='button'],a,[role='link']") || btn;
  if (!el) return null;

  const t = (
    el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || ""
  ).trim().toLowerCase();

  const clsList = Array.from(el.classList || []).map(x => String(x).toLowerCase());

  if (clsList.includes("lia-quiz__check")) return "check";
  if (clsList.includes("lia-quiz__resolve")) return "solve";

  if (t === "check" || t.startsWith("check")) return "check";
  if (t === "solve" || t === "solution" || t === "show solution" ||
      t.startsWith("solve") || t.startsWith("solution")) return "solve";

  return null;
}

function findProxyForAnyButton(btn: Element): Element | null {
  let p = btn.closest?.(".hlq-proxy");
  if (p) return p;

  const scope = btn.closest?.(".markerquiz") || CONTENT_DOC;
  const proxies = Array.from((scope as Element | Document).querySelectorAll(".hlq-proxy"));
  if (!proxies.length) return null;
  if (proxies.length === 1) return proxies[0];

  for (let i = proxies.length - 1; i >= 0; i--) {
    const pr = proxies[i];
    const rel = pr.compareDocumentPosition(btn);
    if (rel & Node.DOCUMENT_POSITION_FOLLOWING) return pr;
  }
  return proxies[0];
}

function getLiaInputRobust(proxy: Element): HTMLInputElement | null {
  let input = getLiaInput(proxy);
  if (input) return input;

  const scope = proxy.closest?.(".markerquiz") || CONTENT_DOC;
  const pr = proxy.getBoundingClientRect();
  let best: HTMLInputElement | null = null;
  let bestScore = Infinity;

  const cands = Array.from((scope as Element | Document).querySelectorAll("input, textarea, select")) as HTMLInputElement[];
  for (const el of cands) {
    const br = el.getBoundingClientRect();
    const dy = Math.abs((br.top + br.height / 2) - (pr.top + pr.height / 2));
    const dx = Math.abs((br.left + br.width / 2) - (pr.left + pr.width / 2));
    if (dy > 300) continue;
    const score = dy * 10 + dx;
    if (score < bestScore) { bestScore = score; best = el; }
  }
  return best;
}

function setLiaValue(input: HTMLInputElement | null, v: string | number): void {
  if (!input) return;
  try { input.value = String(v); } catch(e) { return; }
  for (const name of ["input", "change", "keyup", "blur"]) {
    try { input.dispatchEvent(new Event(name, { bubbles: true })); } catch(e){}
    try { input.dispatchEvent(new Event("keydown", { bubbles: true })); } catch(e){}
  }
}

function setProxyMsg(proxyEl: Element, txt: string): void {
  const msg = proxyEl.querySelector(".hlq-msg");
  if (msg) msg.textContent = txt || "";
}

function handleHLQAction(
  I: Instance,
  act: "check" | "solve",
  proxy: Element,
  btnRef: Element,
  renderFn: () => void
): void {
  const scopeEl = proxy.closest(".markerquiz") || null;
  const input   = getLiaInputRobust(proxy);

  if (act === "check") {
    const r = evalScope(I, scopeEl);
    setProxyMsg(proxy,
      r.total
        ? `Hits: ${r.ok}/${r.total}` +
          (r.badColor ? ` — wrong color: ${r.badColor}` : "") +
          (r.tooWide  ? ` — too large: ${r.tooWide}` : "") +
          (r.extra    ? ` — extra: ${r.extra}` : "")
        : "No targets found."
    );
    setLiaValue(input, r.pass ? 1 : 0);
    return;
  }

  if (act === "solve") {
    solveScope(I, scopeEl, renderFn);
    setProxyMsg(proxy, "Solution displayed.");
    setLiaValue(input, 1);
    return;
  }
}

export function wireHLQEvents(I: Instance, renderFn: () => void): void {
  CONTENT_DOC.addEventListener("click", (e) => {
    const clicked = (e.target as Element)?.closest?.("button,[role='button'],a,[role='link']");
    if (!clicked) return;
    if (isForeignToolUi(clicked)) return;
    if (!isRelevantHLQArea(clicked)) return;

    // Our own HLQ buttons
    const own = clicked.closest("button.hlq-btn[data-hlq-act]") as HTMLElement | null;
    if (own) {
      const proxy = own.closest(".hlq-proxy");
      if (!proxy) return;
      const act = own.getAttribute("data-hlq-act") as "check" | "solve" | null;
      if (!act) return;
      handleHLQAction(I, act, proxy, own, renderFn);
      return;
    }

    // Real Lia quiz buttons
    const act = inferActionLoose(clicked);
    if (!act) return;

    const proxy = findProxyForAnyButton(clicked);
    if (!proxy) return;

    const scopeClicked = clicked.closest?.(".markerquiz");
    const scopeProxy   = proxy.closest?.(".markerquiz");
    if (scopeClicked && scopeProxy && scopeClicked !== scopeProxy) return;

    handleHLQAction(I, act, proxy, clicked, renderFn);
  }, true);
}
