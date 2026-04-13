import { CONTENT_WIN, CONTENT_DOC } from "./context";

export interface ScrollCtx {
  host: Element | null;
  sx: number;
  sy: number;
  ox: number;
  oy: number;
}

function isScrollable(el: Element): boolean {
  if (!el || el === CONTENT_DOC.body || el === CONTENT_DOC.documentElement) return false;
  const cs = CONTENT_WIN.getComputedStyle(el);
  const oy = (cs.overflowY || "").toLowerCase();
  const ox = (cs.overflowX || "").toLowerCase();
  const y = (oy === "auto" || oy === "scroll" || oy === "overlay") && (el.scrollHeight > el.clientHeight + 2);
  const x = (ox === "auto" || ox === "scroll" || ox === "overlay") && (el.scrollWidth  > el.clientWidth  + 2);
  return y || x;
}

export function detectScrollHost(): Element | null {
  let n: Element | null = CONTENT_DOC.querySelector("main") || CONTENT_DOC.body;
  for (let i = 0; i < 10 && n && n !== CONTENT_DOC.body; i++) {
    if (isScrollable(n)) return n;
    n = n.parentElement;
  }
  return null;
}

export function getScrollCtx(): ScrollCtx {
  const host = detectScrollHost();
  if (host) {
    const r = host.getBoundingClientRect();
    return { host, sx: host.scrollLeft || 0, sy: host.scrollTop || 0, ox: r.left, oy: r.top };
  }
  return { host: null, sx: CONTENT_WIN.scrollX || 0, sy: CONTENT_WIN.scrollY || 0, ox: 0, oy: 0 };
}
