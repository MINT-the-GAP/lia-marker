import { ROOT_WIN, ROOT_DOC, CONTENT_WIN, CONTENT_DOC } from "../dom/context";
import type { HighlightItem } from "../types";
import { rangeFromAnchor } from "../dom/ranges";
import { getViewportRect, interAreaDOMRect } from "../dom/rects";

function getSlidesRoot(): Element | null {
  return (
    CONTENT_DOC.querySelector(".reveal .slides") ||
    ROOT_DOC.querySelector(".reveal .slides") ||
    CONTENT_DOC.querySelector(".slides") ||
    ROOT_DOC.querySelector(".slides") ||
    null
  );
}

function getMainRoot(): Element {
  return CONTENT_DOC.querySelector("main") || CONTENT_DOC.body;
}

export function getSlideCandidates(): Element[] {
  const rr = getSlidesRoot();

  let slides: Element[];
  if (rr) {
    slides = Array.from(rr.querySelectorAll("section"));
  } else {
    const main = getMainRoot();
    slides = Array.from(main.querySelectorAll("section"));
    if (!slides.length) {
      slides = Array.from(main.children).filter(el =>
        el && (el.tagName === "SECTION" || el.tagName === "ARTICLE")
      );
    }
  }

  return slides.filter((el, i, arr) => arr.indexOf(el) === i);
}

export function ensureSlideIds(): void {
  const slides = getSlideCandidates();
  let n = 1;
  for (const s of slides) {
    if (!(s as HTMLElement).dataset.hlSlideid) {
      (s as HTMLElement).dataset.hlSlideid = "SLIDE_" + (n++);
    }
  }
}

function getCurrentSlideEl(): Element | null {
  ensureSlideIds();

  // 1) Reveal API
  try {
    const R = (ROOT_WIN as any).Reveal || (CONTENT_WIN as any).Reveal || null;
    if (R && typeof R.getCurrentSlide === "function") {
      const s = R.getCurrentSlide();
      if (s) return s;
    }
  } catch(e){}

  // 2) Deepest .present
  const pres = Array.from(CONTENT_DOC.querySelectorAll("section.present"))
    .filter((el, i, arr) => arr.indexOf(el) === i);

  if (pres.length) {
    const leafs = pres.filter(el => !pres.some(other => other !== el && el.contains(other)));
    if (leafs.length) return leafs[leafs.length - 1];
    return pres[pres.length - 1];
  }

  // 3) Most-visible in viewport
  const slides = getSlideCandidates();
  if (!slides.length) return null;

  const vp = getViewportRect();
  let best: Element | null = null;
  let bestA = -1;

  for (const s of slides) {
    const cs = CONTENT_WIN.getComputedStyle(s);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    if (parseFloat(cs.opacity || "1") < 0.01) continue;
    if (s.getAttribute("aria-hidden") === "true") continue;

    const r = s.getBoundingClientRect();
    const a = interAreaDOMRect(r, vp);
    if (a > bestA) { bestA = a; best = s; }
  }

  return best || slides[0] || null;
}

export function getActiveSlideId(): string | null {
  const s = getCurrentSlideEl();
  return (s as HTMLElement | null)?.dataset?.hlSlideid || null;
}

export function shouldFilterBySlide(): boolean {
  return getSlideCandidates().length >= 2;
}

function sectionFromNode(node: Node): Element | null {
  ensureSlideIds();
  const el = (node && node.nodeType === 1) ? node as Element : (node as Node).parentElement;
  if (!el) return null;
  return el.closest?.("[data-hl-slideid]") || null;
}

export function slideIdFromNode(node: Node): string {
  const s = sectionFromNode(node);
  return (s as HTMLElement | null)?.dataset?.hlSlideid || "global";
}

export function ensureItemSlide(item: HighlightItem): void {
  if (!item) return;
  if (item.slide && item.slide !== "global") return;
  if (!item.anchor) return;

  const r = rangeFromAnchor(item.anchor);
  if (!r) return;

  const sid = slideIdFromNode(r.commonAncestorContainer);
  if (sid) item.slide = sid;
}

export function ensureRevealSlideObserver(
  instance: { moSlides: MutationObserver | null; [k: string]: unknown },
  onSlideChange: () => void
): void {
  if (instance.moSlides) return;

  const rr = getSlidesRoot();
  if (!rr) return;

  const obsWin = (rr.ownerDocument === ROOT_DOC) ? ROOT_WIN : CONTENT_WIN;

  instance.moSlides = new (obsWin as any).MutationObserver(() => {
    onSlideChange();
  });

  instance.moSlides.observe(rr, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class", "style", "aria-hidden"],
    childList: true
  });
}
