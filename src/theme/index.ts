import { ROOT_DOC, CONTENT_DOC } from "../dom/context";
import { findHeaderLeft, findTOCButtonInLeft } from "../ui/button";

function getStyleSafe(el: Element | null): CSSStyleDeclaration | null {
  try {
    const win = el?.ownerDocument?.defaultView || window;
    return win.getComputedStyle(el!);
  } catch(e) {
    return null;
  }
}

export function readCSSVar(name: string, ...els: (Element | null | undefined)[]): string {
  for (const el of els) {
    if (!el) continue;
    const cs = getStyleSafe(el);
    if (!cs) continue;
    const v = (cs.getPropertyValue(name) || "").trim();
    if (v) return normalizeColorValue(v);
  }
  return "";
}

export function normalizeColorValue(v: string): string {
  v = String(v || "").trim();
  if (!v) return "";

  if (
    v.startsWith("rgb(") || v.startsWith("rgba(") ||
    v.startsWith("hsl(") || v.startsWith("hsla(") ||
    v.startsWith("#") || v.startsWith("var(") ||
    /^[a-zA-Z]+$/.test(v)
  ) return v;

  if (/^\d+(\.\d+)?\s*,\s*\d+(\.\d+)?\s*,\s*\d+(\.\d+)?(\s*,\s*\d+(\.\d+)?)?$/.test(v)) {
    const parts = v.split(",").map(s => s.trim());
    return parts.length === 3 ? `rgb(${parts.join(", ")})` : `rgba(${parts.join(", ")})`;
  }

  return v;
}

export function parseRGB(str: string): { r: number; g: number; b: number } | null {
  if (!str) return null;
  const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
}

export function luminance(c: { r: number; g: number; b: number }): number {
  const lin = (x: number) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
}

function isLikelyNeutralColor(str: string): boolean {
  const c = parseRGB(str);
  if (!c) return false;
  const max = Math.max(c.r, c.g, c.b);
  const min = Math.min(c.r, c.g, c.b);
  const spread = max - min;
  if (max < 40) return true;
  if (min > 215) return true;
  if (spread < 14) return true;
  return false;
}

export function readThemeAccent(): string {
  const els = [
    ROOT_DOC.querySelector("#lia-toolbar-nav"),
    ROOT_DOC.querySelector("header#lia-toolbar-nav"),
    ROOT_DOC.querySelector("header.lia-header"),
    ROOT_DOC.body,
    ROOT_DOC.documentElement,
    CONTENT_DOC.querySelector("main"),
    CONTENT_DOC.body,
    CONTENT_DOC.documentElement
  ];

  const names = ["--color-highlight", "--accent-color", "--color-accent", "--theme-highlight"];

  for (const name of names) {
    const v = readCSSVar(name, ...els);
    if (v) return v;
  }

  return "";
}

function firstNonTransparentBg(el: Element | null): string {
  let n: Element | null = el;
  while (n && n !== CONTENT_DOC.documentElement) {
    const cs = getStyleSafe(n);
    const bg = (cs?.backgroundColor || "").trim();
    if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") return bg;
    n = n.parentElement;
  }
  return "";
}

function setVar(doc: Document, name: string, value: string): void {
  (doc.documentElement.style as CSSStyleDeclaration).setProperty(name, value);
}

function readRenderedAccentFromToolbar(): string {
  const left = findHeaderLeft();
  const tocBtn = left ? findTOCButtonInLeft(left) : null;

  const candidates = [
    tocBtn,
    tocBtn?.querySelector("svg") || null,
    tocBtn?.querySelector("svg *") || null,
    tocBtn?.querySelector(".icon") || null,
    ROOT_DOC.querySelector("#lia-toolbar-nav svg"),
    ROOT_DOC.querySelector("#lia-toolbar-nav svg *"),
    ROOT_DOC.querySelector("header.lia-header svg"),
    ROOT_DOC.querySelector("header.lia-header svg *")
  ];

  for (const el of candidates) {
    if (!el) continue;
    const cs = getStyleSafe(el);
    if (!cs) continue;

    const vals = [
      (cs.getPropertyValue("stroke") || "").trim(),
      (cs.getPropertyValue("fill") || "").trim(),
      (cs.getPropertyValue("color") || "").trim()
    ];

    for (const v of vals) {
      if (!v) continue;
      if (!parseRGB(v)) continue;
      if (isLikelyNeutralColor(v)) continue;
      return v;
    }
  }

  return "";
}

export function adaptUIVars(): void {
  const rootHeader =
    ROOT_DOC.querySelector("header#lia-toolbar-nav") ||
    ROOT_DOC.querySelector("#lia-toolbar-nav") ||
    ROOT_DOC.querySelector("header.lia-header");

  const contentMain =
    CONTENT_DOC.querySelector("main") ||
    CONTENT_DOC.querySelector("[role='main']") ||
    CONTENT_DOC.body;

  const mainStyle = getStyleSafe(contentMain);
  const bodyStyle = getStyleSafe(CONTENT_DOC.body);

  const bgStr =
    firstNonTransparentBg(contentMain) ||
    mainStyle?.backgroundColor ||
    bodyStyle?.backgroundColor ||
    "rgb(255,255,255)";

  const fgStr =
    (mainStyle?.color || "").trim() ||
    (bodyStyle?.color || "").trim() ||
    "rgb(0,0,0)";

  const bg = parseRGB(bgStr) || { r: 255, g: 255, b: 255 };
  const isDark = luminance(bg) < 0.45;

  let accentStr = readThemeAccent() || readRenderedAccentFromToolbar();
  accentStr = normalizeColorValue(accentStr);
  if (!accentStr) accentStr = "rgb(11,95,255)";

  try { setVar(ROOT_DOC, "--hl-accent", accentStr); } catch(e){}
  try { setVar(CONTENT_DOC, "--hl-accent", accentStr); } catch(e){}

  const uiBg     = normalizeColorValue(bgStr);
  const uiFg     = normalizeColorValue(fgStr);
  const uiMuted  = isDark ? "rgba(255,255,255,.68)" : "rgba(0,0,0,.62)";
  const uiBorder = isDark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)";
  const uiShadow = isDark ? "0 18px 44px rgba(0,0,0,.55)" : "0 16px 42px rgba(0,0,0,.16)";

  for (const [name, val] of [
    ["--hl-ui-bg", uiBg], ["--hl-ui-fg", uiFg],
    ["--hl-ui-muted", uiMuted], ["--hl-ui-border", uiBorder],
    ["--hl-ui-shadow", uiShadow]
  ] as [string, string][]) {
    try { setVar(ROOT_DOC, name, val); } catch(e){}
    try { setVar(CONTENT_DOC, name, val); } catch(e){}
  }

  const btn = ROOT_DOC.getElementById("lia-hl-btn");
  if (btn) {
    const header = rootHeader as HTMLElement | null;
    if (header) {
      const cs = getStyleSafe(header);
      const headerBg = cs?.backgroundColor || "";
      if (headerBg) try { setVar(ROOT_DOC, "--hl-btn-bg", headerBg); } catch(e){}
    }
  }
}
