import { ROOT_WIN, ROOT_DOC, CONTENT_WIN } from '../dom/context';
import type { AnnotationToolbarApi, Instance } from '../types';
import { scheduleHLPosition } from './position';

const CONTROL_ID = 'lia-marker';
const CONTROL_ORDER = 100;
const READY_EVENT = 'lia-annotation-toolbar-ready';

type OwnedButton = HTMLElement & {
  __liaMarkerAnnotationOwner?: Instance;
};

interface DockState {
  disposed: boolean;
  windows: Window[];
  readyApis: AnnotationToolbarApi[];
  rejected: Array<{ api: AnnotationToolbarApi; button: OwnedButton }>;
  api: AnnotationToolbarApi | null;
  button: OwnedButton | null;
  onReady: EventListener;
}

const states = new WeakMap<Instance, DockState>();

function asAnnotationApi(value: unknown): AnnotationToolbarApi | null {
  if (!value || (typeof value !== 'object' && typeof value !== 'function')) {
    return null;
  }
  const api = value as Partial<AnnotationToolbarApi>;
  return typeof api.registerToolbarControl === 'function' &&
    typeof api.unregisterToolbarControl === 'function' &&
    typeof api.hasToolbarControl === 'function'
    ? api as AnnotationToolbarApi
    : null;
}

function relevantWindows(): Window[] {
  const result: Window[] = [];
  for (const candidate of [ROOT_WIN, CONTENT_WIN]) {
    try {
      // Access is intentionally guarded for embedded/cross-origin hosts.
      void candidate.document.documentElement;
      if (!result.includes(candidate)) result.push(candidate);
    } catch (_) {}
  }
  return result.sort((a, b) => {
    try {
      return Number(b.document === ROOT_DOC) - Number(a.document === ROOT_DOC);
    } catch (_) {
      return 0;
    }
  });
}

function apiFromWindow(win: Window): AnnotationToolbarApi | null {
  try {
    return asAnnotationApi(
      (win as Window & { __LIA_ANNOTATION__?: unknown }).__LIA_ANNOTATION__,
    );
  } catch (_) {
    return null;
  }
}

function candidateApis(state: DockState): AnnotationToolbarApi[] {
  const result: AnnotationToolbarApi[] = [];
  for (const win of state.windows) {
    const api = apiFromWindow(win);
    if (api && !result.includes(api)) result.push(api);
  }
  for (const api of state.readyApis) {
    if (!result.includes(api)) result.push(api);
  }
  return result;
}

function stillRegistered(state: DockState, I: Instance, button: OwnedButton): boolean {
  if (!state.api || state.button !== button ||
      button.__liaMarkerAnnotationOwner !== I) {
    return false;
  }
  try {
    return state.api.hasToolbarControl(CONTROL_ID) === true;
  } catch (_) {
    return false;
  }
}

function tryRegister(I: Instance, state: DockState): boolean {
  if (state.disposed || !I.__alive) return false;
  const button = ROOT_DOC.getElementById('lia-hl-btn') as OwnedButton | null;
  if (!button) return false;
  if (stillRegistered(state, I, button)) return true;

  if (state.button?.__liaMarkerAnnotationOwner === I) {
    delete state.button.__liaMarkerAnnotationOwner;
  }
  state.api = null;
  state.button = null;

  for (const api of candidateApis(state)) {
    if (state.rejected.some(entry =>
      entry.api === api && entry.button === button
    )) {
      continue;
    }
    let registered = false;
    try {
      registered = api.registerToolbarControl(
        CONTROL_ID,
        button,
        { order: CONTROL_ORDER },
      ) === true;
    } catch (_) {}
    if (!registered) {
      state.rejected.push({ api, button });
      continue;
    }

    button.__liaMarkerAnnotationOwner = I;
    state.api = api;
    state.button = button;
    scheduleHLPosition(I);
    return true;
  }
  return false;
}

export function setupAnnotationToolbarDock(I: Instance): void {
  if (states.has(I)) return;

  const windows = relevantWindows();
  const state: DockState = {
    disposed: false,
    windows,
    readyApis: [],
    rejected: [],
    api: null,
    button: null,
    onReady: (() => {}) as EventListener,
  };

  state.onReady = ((event: Event) => {
    if (state.disposed || !I.__alive) return;
    const api = asAnnotationApi((event as CustomEvent<unknown>).detail);
    if (api) {
      if (!state.readyApis.includes(api)) state.readyApis.push(api);
      state.rejected = state.rejected.filter(entry => entry.api !== api);
    }
    tryRegister(I, state);
  }) as EventListener;

  states.set(I, state);
  for (const win of windows) {
    try { win.addEventListener(READY_EVENT, state.onReady); } catch (_) {}
  }

  I.__cleanupAnnotationDock = () => {
    if (state.disposed) return;
    state.disposed = true;
    for (const win of state.windows) {
      try { win.removeEventListener(READY_EVENT, state.onReady); } catch (_) {}
    }

    const button = state.button;
    const api = state.api;
    if (button?.__liaMarkerAnnotationOwner === I && api) {
      let registered = false;
      try { registered = api.hasToolbarControl(CONTROL_ID) === true; } catch (_) {}
      if (registered) {
        try { api.unregisterToolbarControl(CONTROL_ID); } catch (_) {}
      }
      if (button.__liaMarkerAnnotationOwner === I) {
        delete button.__liaMarkerAnnotationOwner;
      }
    }

    state.readyApis.length = 0;
    state.rejected.length = 0;
    state.api = null;
    state.button = null;
    states.delete(I);
    I.__cleanupAnnotationDock = undefined;
  };
}

export function syncAnnotationToolbarDock(I: Instance): boolean {
  if (!states.has(I)) setupAnnotationToolbarDock(I);
  const state = states.get(I);
  return state ? tryRegister(I, state) : false;
}
