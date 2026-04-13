export function getRootWindow(): Window & typeof globalThis {
  let w: Window & typeof globalThis = window;
  try { while (w.parent && w.parent !== w) w = w.parent as Window & typeof globalThis; } catch(e){}
  return w;
}

export const ROOT_WIN = getRootWindow();
export const ROOT_DOC = ROOT_WIN.document;

export const CONTENT_WIN = window;
export const CONTENT_DOC = document;
