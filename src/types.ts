export type HLColor = "yellow" | "green" | "blue" | "pink" | "orange" | "red";
export type HLKind  = "user" | "solution" | "prefill";

export interface Anchor {
  sp: string;  // nodeToPath of startContainer
  so: number;  // startOffset
  ep: string;  // nodeToPath of endContainer
  eo: number;  // endOffset
}

export interface Rect { x: number; y: number; w: number; h: number; }

export interface HighlightItem {
  id: number;
  kind: HLKind;
  color: HLColor;
  anchor: Anchor;
  rects: Rect[];
  scope: string;   // markerquiz scope id
  slide: string;   // slide id or "global"
}

export interface ToolState {
  active: boolean;
  panelOpen: boolean;
  tool: "mark" | "erase";
  color: HLColor;
}

export interface Instance {
  __alive: boolean;
  debugHLQ: boolean;
  state: ToolState;
  HL: HighlightItem[];
  nextId: number;
  moDock: MutationObserver | null;
  moTheme: MutationObserver | null;
  moSlides: MutationObserver | null;
  roLayout: ResizeObserver | null;
  roNodes: Set<Element>;
  roPending: boolean;
  ticking: boolean;
  __activeSlide: string | null;
  posTimers: number[];
  lastBurstAt: number;
  __layoutSig?: string;
  __layoutTimer?: number;
  __slideSyncTimer?: number;
  __prefillKeys?: Set<string>;
  [key: string]: unknown;
}
