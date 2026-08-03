import { CONTENT_DOC } from "../dom/context";
import type { Instance } from "../types";
import { evalScope } from "./eval";
import { solveScope } from "./solve";
import { revealMarkerQuizResolution } from "./resolution";

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
  if (el.closest(".hlq-proxy, .hlq-lia, .markerquiz")) return true;
  return !!el.closest(".lia-quiz") && findProxiesForAnyButton(el).length > 0;
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

interface LiaInputIdentity {
  group: number;
  item: number | null;
}

function liaInputHandler(input: Element | null): string {
  if (!input) return "";
  return [input.getAttribute("oninput"), input.getAttribute("onchange")]
    .filter(Boolean)
    .join("\n");
}

function liaInputIdentity(input: Element | null): LiaInputIdentity | null {
  const handler = liaInputHandler(input);
  const group = handler.match(/\[\s*["']input["']\s*,\s*(\d+)\s*\]/i);
  if (!group) return null;
  const item = handler.match(/\bparam\s*:\s*\{[\s\S]*?\bid\s*:\s*(\d+)/i);
  return {
    group: Number(group[1]),
    item: item ? Number(item[1]) : null,
  };
}

function sameLiaInputIdentity(
  left: LiaInputIdentity | null,
  right: LiaInputIdentity | null,
): boolean {
  return !!left && !!right && left.group === right.group && left.item === right.item;
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

function findProxiesForAnyButton(btn: Element): Element[] {
  let p = btn.closest?.(".hlq-proxy");
  if (p) return [p];

  const markerScope = btn.closest?.(".markerquiz");
  if (markerScope) return Array.from(markerScope.querySelectorAll(".hlq-proxy"));

  const nativeQuiz = btn.closest?.(".lia-quiz");
  if (!nativeQuiz) return [];
  const root = nativeQuiz.closest(".lia-slide__content") || CONTENT_DOC;
  const quizIndex = Array.from(
    (root as Element | Document).querySelectorAll(".lia-quiz"),
  ).indexOf(nativeQuiz);
  if (quizIndex < 0) return [];

  return Array.from(
    (root as Element | Document).querySelectorAll(".markerquiz .hlq-proxy"),
  ).filter((proxy) => {
    const input = getLiaInput(proxy);
    return liaInputIdentity(input)?.group === quizIndex;
  });
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

interface LiaValueUpdate {
  input: HTMLInputElement | null;
  identity: LiaInputIdentity | null;
  root: Element | Document;
  value: string | number;
}

function currentLiaInput(update: LiaValueUpdate): HTMLInputElement | null {
  if (update.input?.isConnected) return update.input;
  if (!update.identity) return null;

  const candidates = Array.from(update.root.querySelectorAll(
    ".markerquiz .hlq-proxy input, .markerquiz .hlq-proxy textarea, " +
    ".markerquiz .hlq-proxy select",
  )) as HTMLInputElement[];
  return candidates.find((input) =>
    sameLiaInputIdentity(liaInputIdentity(input), update.identity)
  ) || null;
}

function prepareHLQAction(
  I: Instance,
  act: "check" | "solve",
  proxy: Element,
  renderFn: () => void
): LiaValueUpdate {
  const scopeEl = proxy.closest(".markerquiz") || null;
  const input   = getLiaInputRobust(proxy);
  const identity = liaInputIdentity(input);
  const root = input?.closest(".lia-slide__content") || CONTENT_DOC;

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
    if (r.pass) revealMarkerQuizResolution(I, scopeEl);
    return { input, identity, root, value: r.pass ? 1 : 0 };
  }

  solveScope(I, scopeEl, renderFn);
  setProxyMsg(proxy, "Solution displayed.");
  revealMarkerQuizResolution(I, scopeEl);
  return { input, identity, root, value: 1 };
}

export function wireHLQEvents(I: Instance, renderFn: () => void): void {
  CONTENT_DOC.addEventListener("click", (e) => {
    if (!I.__alive) return;
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
      const update = prepareHLQAction(I, act, proxy, renderFn);
      setLiaValue(currentLiaInput(update), update.value);
      return;
    }

    // Real Lia quiz buttons
    const act = inferActionLoose(clicked);
    if (!act) return;

    const proxies = findProxiesForAnyButton(clicked);
    if (!proxies.length) return;
    const scopeClicked = clicked.closest?.(".markerquiz");
    const updates: LiaValueUpdate[] = [];
    for (const proxy of proxies) {
      const scopeProxy = proxy.closest?.(".markerquiz");
      if (scopeClicked && scopeProxy && scopeClicked !== scopeProxy) continue;
      updates.push(prepareHLQAction(I, act, proxy, renderFn));
    }
    // Prepare every reveal before LiaScript consumes any proxy value: raw
    // flex layouts can replace the complete multi-quiz subtree synchronously.
    updates.forEach((update) => setLiaValue(currentLiaInput(update), update.value));
  }, true);
}
