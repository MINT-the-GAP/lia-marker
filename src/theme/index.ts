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
  const channel = (raw: string, unitInterval = false): number | null => {
    const value = Number.parseFloat(raw);
    if (!Number.isFinite(value)) return null;
    const scaled = raw.endsWith("%") ? value * 2.55 : unitInterval ? value * 255 : value;
    return Math.round(Math.max(0, Math.min(255, scaled)));
  };
  const fromMatch = (match: RegExpMatchArray | null, unitInterval = false) => {
    if (!match) return null;
    const values = match.slice(1, 4).map(value => channel(value, unitInterval));
    if (values.some(value => value === null)) return null;
    return { r: values[0]!, g: values[1]!, b: values[2]! };
  };
  const rgb = str.match(
    /^rgba?\(\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)(?:\s*,\s*|\s+)([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)(?:\s*,\s*|\s+)([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)(?:\s*[,/][^)]*)?\s*\)$/i,
  );
  if (rgb) return fromMatch(rgb);

  // Chromium preserves CSS Color 4 values in computed styles. LiaScript
  // currently emits its dark-theme toolbar accent as color(srgb ...).
  const srgb = str.match(
    /^color\(\s*srgb\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)%?)(?:\s*\/[^)]*)?\s*\)$/i,
  );
  return fromMatch(srgb, true);
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
    CONTENT_DOC.querySelector("main:not([hidden])"),
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
  const style = doc.documentElement.style;
  if (style.getPropertyValue(name) !== value) style.setProperty(name, value);
}

function readRenderedAccentFromToolbar(): string {
  const left = findHeaderLeft();
  const tocBtn = left ? findTOCButtonInLeft(left) : null;

  const firstColor = (elements: (Element | null)[], properties: string[]): string => {
    for (const el of elements) {
      if (!el) continue;
      const cs = getStyleSafe(el);
      if (!cs) continue;
      for (const property of properties) {
        const value = (cs.getPropertyValue(property) || "").trim();
        if (!value || !parseRGB(value) || isLikelyNeutralColor(value)) continue;
        return value;
      }
    }
    return "";
  };

  // LiaScript renders the visible language code (for example "EN") here.
  // It is the most stable reference for the header controls' foreground color.
  const languageLabel = ROOT_DOC.querySelector(
    ".lia-support-menu__item--lang .lia-support-menu__lang",
  );
  const languageAccent = firstColor(
    [languageLabel, languageLabel?.closest("button") || null],
    ["color", "stroke", "fill"],
  );
  if (languageAccent) return languageAccent;

  const rightButton = ROOT_DOC.querySelector(
    ".lia-header__right .lia-support-menu__nav button",
  );

  const candidates = [
    rightButton,
    rightButton?.querySelector("svg") || null,
    rightButton?.querySelector("svg *") || null,
    rightButton?.querySelector(".icon") || null,
    tocBtn,
    tocBtn?.querySelector("svg") || null,
    tocBtn?.querySelector("svg *") || null,
    tocBtn?.querySelector(".icon") || null,
    ROOT_DOC.querySelector("#lia-toolbar-nav svg"),
    ROOT_DOC.querySelector("#lia-toolbar-nav svg *"),
    ROOT_DOC.querySelector("header.lia-header svg"),
    ROOT_DOC.querySelector("header.lia-header svg *")
  ];
  return firstColor(candidates, ["stroke", "fill", "color"]);
}

export function adaptUIVars(): void {
  const rootHeader =
    ROOT_DOC.querySelector("header#lia-toolbar-nav") ||
    ROOT_DOC.querySelector("#lia-toolbar-nav") ||
    ROOT_DOC.querySelector("header.lia-header");

  const contentMain =
    CONTENT_DOC.querySelector("main:not([hidden])") ||
    CONTENT_DOC.querySelector("[role='main']:not([hidden])") ||
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

  // Match the controls users actually see in the header. Theme variables such
  // as --color-highlight may describe darker rules or hover backgrounds and
  // are therefore only a fallback when no colored toolbar control is present.
  let accentStr = readRenderedAccentFromToolbar() || readThemeAccent();
  accentStr = normalizeColorValue(accentStr);
  if (!accentStr) accentStr = "rgb(11,95,255)";

  const uiBg     = normalizeColorValue(bgStr);
  const uiFg     = normalizeColorValue(fgStr);
  const uiMuted  = isDark ? "rgba(255,255,255,.68)" : "rgba(0,0,0,.62)";
  const uiBorder = isDark ? "rgba(255,255,255,.16)" : "rgba(0,0,0,.14)";
  const uiShadow = isDark ? "0 18px 44px rgba(0,0,0,.55)" : "0 16px 42px rgba(0,0,0,.16)";

  // Complete style reads before publishing variables to either document.
  const headerBg = rootHeader ? getStyleSafe(rootHeader)?.backgroundColor : "";
  const variables = [
    ["--hl-accent", accentStr],
    ["--hl-ui-bg", uiBg], ["--hl-ui-fg", uiFg],
    ["--hl-ui-muted", uiMuted], ["--hl-ui-border", uiBorder],
    ["--hl-ui-shadow", uiShadow]
  ] as [string, string][];
  for (const doc of new Set([ROOT_DOC, CONTENT_DOC])) {
    for (const [name, value] of variables) {
      try { setVar(doc, name, value); } catch(e){}
    }
  }
  if (headerBg) try { setVar(ROOT_DOC, "--hl-btn-bg", headerBg); } catch(e){}
}
