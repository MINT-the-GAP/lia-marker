import { ROOT_DOC, CONTENT_DOC } from "../dom/context";
import type { Instance } from "../types";
import { clamp, type Viewport, type ButtonLayout } from "./button";
import { scheduleHLPosition } from "./position";
import { setStyle, toggleClass } from "./style";

const HL_I18N: Record<string, { color: string; clear_all: string; clear_all_title: string; explain_word: string; explain_word_title: string }> = {
  en: { color: "Color", clear_all: "Clear all", clear_all_title: "Remove all highlights", explain_word: "Explain Word", explain_word_title: "Explain selected word" },
  de: { color: "Farbe", clear_all: "Alles löschen", clear_all_title: "Alle Markierungen entfernen", explain_word: "Wort erklären", explain_word_title: "Markiertes Wort erklären" },
  cs: { color: "Barva", clear_all: "Vymazat vše", clear_all_title: "Odstranit všechna zvýraznění", explain_word: "Vysvětlit slovo", explain_word_title: "Vysvětlit vybrané slovo" },
  fr: { color: "Couleur", clear_all: "Tout effacer", clear_all_title: "Supprimer tous les surlignages", explain_word: "Expliquer le mot", explain_word_title: "Expliquer le mot sélectionné" },
  es: { color: "Color", clear_all: "Borrar todo", clear_all_title: "Eliminar todos los resaltados", explain_word: "Explicar palabra", explain_word_title: "Explicar la palabra seleccionada" },
  it: { color: "Colore", clear_all: "Cancella tutto", clear_all_title: "Rimuovi tutte le evidenziazioni", explain_word: "Spiega parola", explain_word_title: "Spiega la parola selezionata" },
  la: { color: "Color", clear_all: "Omnia delere", clear_all_title: "Omnes notationes removere", explain_word: "Vocabulum explicare", explain_word_title: "Vocabulum selectum explicare" },
  nl: { color: "Kleur", clear_all: "Alles verwijderen", clear_all_title: "Alle markeringen verwijderen", explain_word: "Woord uitleggen", explain_word_title: "Geselecteerd woord uitleggen" },
  pt: { color: "Cor", clear_all: "Limpar tudo", clear_all_title: "Remover todos os destaques", explain_word: "Explicar palavra", explain_word_title: "Explicar a palavra selecionada" },
  pl: { color: "Kolor", clear_all: "Wyczyść wszystko", clear_all_title: "Usuń wszystkie podświetlenia", explain_word: "Wyjaśnij słowo", explain_word_title: "Wyjaśnij zaznaczone słowo" },
  ru: { color: "Цвет", clear_all: "Очистить всё", clear_all_title: "Удалить все выделения", explain_word: "Объяснить слово", explain_word_title: "Объяснить выбранное слово" },
  tr: { color: "Renk", clear_all: "Hepsini temizle", clear_all_title: "Tüm vurguları kaldır", explain_word: "Kelimeyi açıkla", explain_word_title: "Seçilen kelimeyi açıkla" }
};

const LANG_ALIAS: Record<string, string> = {
  cz: "cs",
  pn: "pl"
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

  const baseRaw = raw.split("-")[0];
  const base = LANG_ALIAS[baseRaw] || baseRaw;
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

  const explainBtn = ROOT_DOC.getElementById("hl-tool-explain");
  if (explainBtn) {
    explainBtn.textContent = dict.explain_word;
    explainBtn.setAttribute("title", dict.explain_word_title);
    explainBtn.setAttribute("aria-label", dict.explain_word);
  }

  __lastAppliedLang = lang;
}

export interface PanelLayout { left: number; top: number; viewportWidth: number; viewportHeight: number; }

/** The open panel is already laid out by applyUI; measuring never moves it. */
export function measurePanel(I: Instance, button: ButtonLayout, vp: Viewport): PanelLayout | null {
  const panel = ROOT_DOC.getElementById("lia-hl-panel");
  if (!panel || !(I.state.active && I.state.panelOpen)) return null;
  const r = panel.getBoundingClientRect();
  // scrollHeight includes clipped contents. Using the previous constrained
  // height would place an expanding panel incorrectly for one frame.
  const width = Math.min(132, Math.max(0, vp.w - 16));
  const naturalHeight = Math.max(r.height, panel.scrollHeight + r.height - panel.clientHeight);
  const height = Math.min(naturalHeight || 180, Math.max(0, vp.h - 16));
  let top = button.top + button.height + 10;
  if (top + height + 8 > vp.oy + vp.h) top = button.top - 10 - height;
  return {
    viewportWidth: vp.w, viewportHeight: vp.h,
    left: clamp(button.left, vp.ox + 8, vp.ox + vp.w - width - 8),
    top: clamp(top, vp.oy + 8, vp.oy + vp.h - height - 8),
  };
}

export function applyPanelPosition(layout: PanelLayout | null): void {
  const panel = ROOT_DOC.getElementById("lia-hl-panel");
  if (!panel || !layout) return;
  setStyle(panel, "--hl-viewport-width", `${layout.viewportWidth}px`);
  setStyle(panel, "--hl-viewport-height", `${layout.viewportHeight}px`);
  setStyle(panel, "left", `${layout.left}px`);
  setStyle(panel, "top", `${layout.top}px`);
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
  const wasPanelOpen = ROOT_DOC.body.classList.contains("lia-hl-panel-open");
  try {
    toggleClass(ROOT_DOC.body, "lia-hl-active",      !!I.state.active);
    toggleClass(ROOT_DOC.body, "lia-hl-panel-open",  !!(I.state.active && I.state.panelOpen));
  } catch(e){}

  try {
    toggleClass(CONTENT_DOC.body, "lia-hlq-debug", !!I.debugHLQ);
  } catch(e){}

  const toolMark  = ROOT_DOC.getElementById("hl-tool-mark");
  const toolErase = ROOT_DOC.getElementById("hl-tool-erase");
  const toolExplain = ROOT_DOC.getElementById("hl-tool-explain");
  if (toolMark)  toggleClass(toolMark, "active",  I.state.tool === "mark");
  if (toolErase) toggleClass(toolErase, "active", I.state.tool === "erase");
  if (toolExplain) toggleClass(toolExplain, "active", I.state.tool === "explain");

  const dot = ROOT_DOC.getElementById("lia-hl-dot") as HTMLElement | null;
  if (dot) {
    const map: Record<string, string> = {};
    for (const key of ["yellow", "green", "blue", "pink", "orange", "red"]) {
      map[key] = getComputedStyle(CONTENT_DOC.documentElement).getPropertyValue(`--hl-${key}`).trim();
    }
    setStyle(dot, "background", map[I.state.color] || map["yellow"], "important");
  }

  const colorsEl = ROOT_DOC.getElementById("hl-colors");
  if (colorsEl) {
    Array.from(colorsEl.querySelectorAll(".hl-swatch")).forEach(s => {
      toggleClass(s, "active", s.getAttribute("data-hl") === I.state.color);
    });
  }

  if (I.state.active && I.state.panelOpen && !wasPanelOpen) {
    scheduleHLPosition(I);
  }
}
