import { ROOT_WIN, ROOT_DOC, CONTENT_DOC } from "../dom/context";
import type { Instance } from "../types";
import { clamp, getViewport } from "./button";

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
  const toolExplain = ROOT_DOC.getElementById("hl-tool-explain");
  if (toolMark)  toolMark.classList.toggle("active",  I.state.tool === "mark");
  if (toolErase) toolErase.classList.toggle("active", I.state.tool === "erase");
  if (toolExplain) toolExplain.classList.toggle("active", I.state.tool === "explain");

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
