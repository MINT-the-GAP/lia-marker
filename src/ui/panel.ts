import { ROOT_WIN, ROOT_DOC, CONTENT_DOC } from "../dom/context";
import type { Instance } from "../types";
import { clamp, getViewport } from "./button";

const HL_I18N: Record<string, { color: string; clear_all: string; clear_all_title: string }> = {
  en: { color: "Color", clear_all: "Clear all", clear_all_title: "Remove all highlights" },
  de: { color: "Farbe", clear_all: "Alles löschen", clear_all_title: "Alle Markierungen entfernen" },
  fr: { color: "Couleur", clear_all: "Tout effacer", clear_all_title: "Supprimer tous les surlignages" },
  es: { color: "Color", clear_all: "Borrar todo", clear_all_title: "Eliminar todos los resaltados" },
  it: { color: "Colore", clear_all: "Cancella tutto", clear_all_title: "Rimuovi tutte le evidenziazioni" },
  nl: { color: "Kleur", clear_all: "Alles verwijderen", clear_all_title: "Alle markeringen verwijderen" },
  pt: { color: "Cor", clear_all: "Limpar tudo", clear_all_title: "Remover todos os destaques" },
  pl: { color: "Kolor", clear_all: "Wyczyść wszystko", clear_all_title: "Usuń wszystkie podświetlenia" },
  tr: { color: "Renk", clear_all: "Hepsini temizle", clear_all_title: "Tüm vurguları kaldır" }
};

let __lastAppliedLang: string | null = null;

function activeLang(): string | null {
  const candidates = [
    ROOT_DOC.documentElement.getAttribute("lang"),
    ROOT_DOC.body.getAttribute("lang"),
    CONTENT_DOC.documentElement.getAttribute("lang"),
    CONTENT_DOC.body.getAttribute("lang"),
    ROOT_DOC.documentElement.getAttribute("data-language"),
    ROOT_DOC.body.getAttribute("data-language"),
    CONTENT_DOC.documentElement.getAttribute("data-language"),
    CONTENT_DOC.body.getAttribute("data-language")
  ];

  const raw = (candidates.find(v => !!(v && v.trim())) || "").trim().toLowerCase();
  if (!raw) return null;

  const base = raw.split("-")[0];
  return HL_I18N[base] ? base : null;
}

export function localizePanelText(): void {
  const lang = activeLang() || "en";
  if (__lastAppliedLang === lang) return;

  const dict = HL_I18N[lang] || HL_I18N.en;

  const colorLabel = ROOT_DOC.getElementById("hl-color-label");
  if (colorLabel) colorLabel.textContent = dict.color;

  const clearBtn = ROOT_DOC.getElementById("hl-clear");
  if (clearBtn) {
    clearBtn.textContent = dict.clear_all;
    clearBtn.setAttribute("title", dict.clear_all_title);
    clearBtn.setAttribute("aria-label", dict.clear_all);
  }

  __lastAppliedLang = lang;
}

function measurePanel(panel: HTMLElement): { w: number; h: number } {
  const prevDisplay = panel.style.display;
  const prevVis     = panel.style.visibility;
  const prevLeft    = panel.style.left;
  const prevTop     = panel.style.top;

  panel.style.display    = "block";
  panel.style.visibility = "hidden";
  panel.style.left       = "-9999px";
  panel.style.top        = "-9999px";

  const w = panel.offsetWidth  || 130;
  const h = panel.offsetHeight || 180;

  panel.style.display    = prevDisplay;
  panel.style.visibility = prevVis;
  panel.style.left       = prevLeft;
  panel.style.top        = prevTop;

  return { w, h };
}

export function positionPanelSmart(I: Instance): void {
  const btn   = ROOT_DOC.getElementById("lia-hl-btn");
  const panel = ROOT_DOC.getElementById("lia-hl-panel") as HTMLElement | null;
  if (!btn || !panel) return;
  if (!(I.state.active && I.state.panelOpen)) return;

  const gap = 10, pad = 8;
  const r   = btn.getBoundingClientRect();
  const vp  = getViewport();
  const sz  = measurePanel(panel);

  let left = r.left;
  let top  = r.bottom + gap;

  left = clamp(left, pad, vp.w - sz.w - pad);

  if (top + sz.h + pad > vp.h) top = r.top - gap - sz.h;
  top = clamp(top, pad, vp.h - sz.h - pad);

  panel.style.left = `${Math.round(left + vp.ox)}px`;
  panel.style.top  = `${Math.round(top  + vp.oy)}px`;
}

export function ensureSwatchesOnce(I: Instance, applyUIFn: () => void): void {
  const colorsEl = ROOT_DOC.getElementById("hl-colors");
  if (!colorsEl || colorsEl.childElementCount) return;

  const keys = ["yellow", "green", "blue", "pink", "orange", "red"];
  const labels: Record<string, string> = { yellow: "Yellow", green: "Green", blue: "Blue", pink: "Pink", orange: "Orange", red: "Red" };
  const cssMap: Record<string, string> = {};
  for (const key of keys) {
    cssMap[key] = getComputedStyle(CONTENT_DOC.documentElement).getPropertyValue(`--hl-${key}`).trim();
  }

  for (const key of keys) {
    const sw = ROOT_DOC.createElement("button");
    sw.type = "button";
    sw.className = "hl-swatch";
    sw.setAttribute("data-hl", key);
    sw.setAttribute("title", labels[key]);
    sw.setAttribute("aria-label", labels[key]);
    sw.style.background = cssMap[key] || cssMap["yellow"];

    sw.addEventListener("click", () => {
      I.state.tool      = "mark";
      I.state.color     = key as Instance["state"]["color"];
      I.state.panelOpen = false;
      applyUIFn();
    });

    colorsEl.appendChild(sw);
  }
}

export function applyUI(I: Instance): void {
  try {
    ROOT_DOC.body.classList.toggle("lia-hl-active",      !!I.state.active);
    ROOT_DOC.body.classList.toggle("lia-hl-panel-open",  !!(I.state.active && I.state.panelOpen));
  } catch(e){}

  try {
    CONTENT_DOC.body.classList.toggle("lia-hlq-debug", !!I.debugHLQ);
  } catch(e){}

  const toolMark  = ROOT_DOC.getElementById("hl-tool-mark");
  const toolErase = ROOT_DOC.getElementById("hl-tool-erase");
  if (toolMark)  toolMark.classList.toggle("active",  I.state.tool === "mark");
  if (toolErase) toolErase.classList.toggle("active", I.state.tool === "erase");

  const dot = ROOT_DOC.getElementById("lia-hl-dot") as HTMLElement | null;
  if (dot) {
    const map: Record<string, string> = {};
    for (const key of ["yellow", "green", "blue", "pink", "orange", "red"]) {
      map[key] = getComputedStyle(CONTENT_DOC.documentElement).getPropertyValue(`--hl-${key}`).trim();
    }
    dot.style.setProperty("background", map[I.state.color] || map["yellow"], "important");
  }

  const colorsEl = ROOT_DOC.getElementById("hl-colors");
  if (colorsEl) {
    Array.from(colorsEl.querySelectorAll(".hl-swatch")).forEach(s => {
      s.classList.toggle("active", s.getAttribute("data-hl") === I.state.color);
    });
  }

  if (I.state.active && I.state.panelOpen) {
    ROOT_WIN.requestAnimationFrame(() => positionPanelSmart(I));
  }
}
