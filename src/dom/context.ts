function isLiaScriptHost(win: Window & typeof globalThis): boolean {
  try {
    return !!win.document.querySelector(
      "#lia-toolbar-nav, header.lia-header, .lia-canvas",
    );
  } catch (_) {
    return false;
  }
}

function isLiveEditorPreview(win: Window & typeof globalThis): boolean {
  try {
    return (win.frameElement as HTMLElement | null)?.id === "liascript-preview";
  } catch (_) {
    return false;
  }
}

export function getRootWindow(): Window & typeof globalThis {
  const contentWindow = window;
  let candidate: Window & typeof globalThis = contentWindow;

  while (true) {
    // A LiveEditor preview is a complete LiaScript application in its own
    // same-origin iframe. Keep all plugin UI inside that preview instead of
    // climbing into the surrounding editor toolbar.
    if (isLiveEditorPreview(candidate) || isLiaScriptHost(candidate)) {
      return candidate;
    }

    try {
      const parent = candidate.parent as Window & typeof globalThis;
      if (!parent || parent === candidate) return contentWindow;
      // Access once while still inside the guarded block. Cross-origin hosts
      // must not make us abandon the document in which the plugin runs.
      void parent.document;
      candidate = parent;
    } catch (_) {
      return contentWindow;
    }
  }
}

export const ROOT_WIN = getRootWindow();
export const ROOT_DOC = ROOT_WIN.document;

export const CONTENT_WIN = window;
export const CONTENT_DOC = document;

// LiaScript can retain a hidden previous main during section navigation.
export function getContentRoot(): HTMLElement {
  return CONTENT_DOC.querySelector<HTMLElement>("main:not([hidden])") || CONTENT_DOC.body;
}
