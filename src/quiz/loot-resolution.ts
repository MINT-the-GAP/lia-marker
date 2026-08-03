import { CONTENT_DOC, CONTENT_WIN } from "../dom/context";
import type { Instance } from "../types";

const DEFERRED_PORTAL_CLASS = "hlq-deferred-loot-portal";
const MARKERQUIZ_PORTAL_SELECTOR =
  '[data-loot-chest-portal][data-loot-chest-location="markerquiz"]';
const SOURCE_PORTAL_ID = /^source-(?:gold|diamonds|energy)-.+:markerquiz$/;
const CHEST_MACRO =
  /^\s*@(Schatztruhe|Diamanttruhe|Energiekiste)(?:\s*\(\s*([^()\r\n]*)\s*\))?\s*$/;
const SOLUTION_DELIMITER = /^\s*(\*{3,})\s*$/;
const TEXTMARKER_QUIZ = /^\s*@TextmarkerQuiz(?:\s*\([^()\r\n]*\))?\s*$/;
const CLOSING_LAYOUT_TAG =
  /^(?:\s*<\/[a-z][\w:.-]*\s*>\s*)+$/i;
const MARKERQUIZ_TARGETS = new Set([
  "markerquiz",
  "textmarkerquiz",
  "marker-quiz",
  "highlightquiz",
]);
const MAX_SOURCE_LENGTH = 10 * 1024 * 1024;
const SOURCE_TIMEOUT = 4_000;
const SOURCE_RETRY_DELAYS = [0, 300, 1_000] as const;

type LootReward = "gold" | "diamonds" | "energy";

interface LiaRuntime {
  defaultCourseURL?: string;
  fetch?: typeof window.fetch;
}

interface ManagedPortalState {
  ariaHidden: string | null;
  hadClass: boolean;
}

interface DeferredLootState {
  active: boolean;
  declarations: Map<string, DeferredLootDeclaration>;
  managed: Map<HTMLElement, ManagedPortalState>;
  pendingReveals: PendingLootReveal[];
  provisionalPortalIds: Set<string>;
  revealedPortalIds: Set<string>;
  status: "idle" | "pending" | "complete" | "failed";
}

interface DeferredLootDeclaration {
  portalId: string;
  quizOrdinal: number;
  section: number;
}

interface PendingLootReveal {
  portalIds: Set<string>;
  quizOrdinal: number;
  section: number | null;
}

interface Fence {
  length: number;
  marker: "`" | "~";
}

type RawCodeBlock =
  | "script"
  | "style"
  | "pre"
  | "code"
  | "textarea"
  | "template";

interface VisibleCourseLine {
  content: string;
  section: number;
}

const REWARD_BY_MACRO: Readonly<Record<string, LootReward>> = {
  Schatztruhe: "gold",
  Diamanttruhe: "diamonds",
  Energiekiste: "energy",
};

const stateByInstance = new WeakMap<Instance, DeferredLootState>();
let cachedCourse: { markdown: string; url: string } | null = null;
let courseMarkdownPromise: { promise: Promise<string | null>; url: string } | null = null;

function maskHtmlComments(
  line: string,
  startsInComment: boolean,
): { visible: string; inComment: boolean } {
  let visible = "";
  let cursor = 0;
  let inComment = startsInComment;
  while (cursor < line.length) {
    if (inComment) {
      const end = line.indexOf("-->", cursor);
      if (end < 0) return { visible, inComment: true };
      cursor = end + 3;
      inComment = false;
      continue;
    }
    const start = line.indexOf("<!--", cursor);
    if (start < 0) {
      visible += line.slice(cursor);
      break;
    }
    visible += line.slice(cursor, start);
    cursor = start + 4;
    inComment = true;
  }
  return { visible, inComment };
}

function fenceAtStart(line: string): Fence | null {
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(line);
  if (!match) return null;
  return { marker: match[1][0] as Fence["marker"], length: match[1].length };
}

function closesFence(line: string, fence: Fence): boolean {
  const match = /^ {0,3}(`{3,}|~{3,})\s*$/.exec(line);
  return !!match &&
    match[1][0] === fence.marker &&
    match[1].length >= fence.length;
}

function maskInlineCode(line: string): string {
  let result = "";
  let delimiterLength = 0;
  for (let index = 0; index < line.length;) {
    if (line[index] === "`" && line[index - 1] !== "\\") {
      let end = index + 1;
      while (line[end] === "`") end += 1;
      const runLength = end - index;
      if (delimiterLength === 0) delimiterLength = runLength;
      else if (delimiterLength === runLength) delimiterLength = 0;
      result += " ".repeat(runLength);
      index = end;
      continue;
    }
    result += delimiterLength === 0 ? line[index] : " ";
    index += 1;
  }
  return result;
}

function visibleCourseLines(markdown: string): VisibleCourseLine[] {
  const lines: VisibleCourseLine[] = [];
  let fence: Fence | null = null;
  let inHtmlComment = false;
  let rawCodeBlock: RawCodeBlock | null = null;
  let section = -1;
  for (const rawLine of markdown.split(/\r?\n/)) {
    const masked = maskHtmlComments(rawLine, inHtmlComment);
    inHtmlComment = masked.inComment;
    if (fence) {
      if (closesFence(masked.visible, fence)) fence = null;
      continue;
    }
    const openingFence = fenceAtStart(masked.visible);
    if (openingFence) {
      fence = openingFence;
      continue;
    }
    if (rawCodeBlock) {
      if (new RegExp(`</${rawCodeBlock}\\s*>`, "i").test(masked.visible)) {
        rawCodeBlock = null;
      }
      continue;
    }
    const rawCodeOpening =
      /<(script|style|pre|code|textarea|template)(?:\s|>)/i.exec(masked.visible);
    if (rawCodeOpening) {
      const tag = rawCodeOpening[1].toLowerCase() as RawCodeBlock;
      if (!new RegExp(`</${tag}\\s*>`, "i").test(masked.visible)) {
        rawCodeBlock = tag;
      }
      continue;
    }
    if (/^(?: {4}|\t)/.test(masked.visible)) continue;
    const content = maskInlineCode(masked.visible);
    if (/^ {0,3}#{1,6}(?:\s+|$)/.test(content)) section += 1;
    lines.push({ content, section });
  }
  return lines;
}

function normalizedInvocation(macro: string, placement: string): string {
  const normalizedPlacement = placement
    .split(";")
    .map((part) => part.trim().toLowerCase())
    .join(";");
  return `${macro}(${normalizedPlacement})`;
}

function hash(value: string): string {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return (result >>> 0).toString(36);
}

function markerQuizPlacement(placement: string): boolean {
  return placement
    .split(";")
    .map((part) => part.trim().toLowerCase())
    .some((part) => MARKERQUIZ_TARGETS.has(part));
}

function deferredLootDeclarations(
  markdown: string,
): Map<string, DeferredLootDeclaration> {
  const declarations = new Map<string, DeferredLootDeclaration>();
  const occurrences = new Map<string, number>();
  const quizCounts = new Map<number, number>();
  let awaitingSolution: Omit<DeferredLootDeclaration, "portalId"> | null = null;
  let insideSolution: Omit<DeferredLootDeclaration, "portalId"> | null = null;

  for (const sourceLine of visibleCourseLines(markdown)) {
    const line = sourceLine.content;
    const delimiter = SOLUTION_DELIMITER.exec(line);
    if (insideSolution && delimiter) {
      insideSolution = null;
      continue;
    }
    if (awaitingSolution && delimiter) {
      insideSolution = awaitingSolution;
      awaitingSolution = null;
      continue;
    }

    const chest = CHEST_MACRO.exec(line);
    if (chest) {
      const placement = (chest[2] ?? "").trim();
      const invocation = normalizedInvocation(chest[1], placement);
      const occurrence = (occurrences.get(invocation) ?? 0) + 1;
      occurrences.set(invocation, occurrence);
      if (insideSolution && markerQuizPlacement(placement)) {
        const reward = REWARD_BY_MACRO[chest[1]];
        const baseId = `source-${reward}-${hash(invocation)}-${occurrence}`;
        const portalId = `${baseId}:markerquiz`;
        declarations.set(portalId, { ...insideSolution, portalId });
      }
      continue;
    }

    if (TEXTMARKER_QUIZ.test(line)) {
      const quizOrdinal = quizCounts.get(sourceLine.section) ?? 0;
      quizCounts.set(sourceLine.section, quizOrdinal + 1);
      awaitingSolution = { quizOrdinal, section: sourceLine.section };
      continue;
    }
    if (awaitingSolution) {
      const trimmed = line.trim();
      if (trimmed && !CLOSING_LAYOUT_TAG.test(trimmed)) awaitingSolution = null;
    }
  }
  return declarations;
}

export function deferredLootPortalIds(markdown: string): Set<string> {
  return new Set(deferredLootDeclarations(markdown).keys());
}

function explicitSourceUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const candidates = [trimmed];
  try {
    const decoded = decodeURIComponent(trimmed);
    if (decoded !== trimmed) candidates.push(decoded);
  } catch (_) {
    // Keep the original value when the query is not URI-encoded.
  }
  return candidates.find((candidate) =>
    /^(?:https?:|blob:|data:)/i.test(candidate)
  ) ?? null;
}

function courseSourceUrl(): string | null {
  const lia = (CONTENT_WIN as Window & { LIA?: LiaRuntime }).LIA;
  const configured = lia?.defaultCourseURL?.trim();
  if (configured) {
    try {
      const url = new URL(configured, CONTENT_WIN.location.href);
      if (/^(?:https?:|blob:|data:)$/i.test(url.protocol)) return url.href;
    } catch (_) {
      // Fall back to LiaScript's standard query URL.
    }
  }
  return explicitSourceUrl(CONTENT_WIN.location.search.slice(1));
}

async function fetchCourseMarkdown(sourceUrl: string): Promise<string | null> {
  const lia = (CONTENT_WIN as Window & { LIA?: LiaRuntime }).LIA;
  const load = lia?.fetch ?? CONTENT_WIN.fetch.bind(CONTENT_WIN);
  const abort = new CONTENT_WIN.AbortController();
  const timeout = CONTENT_WIN.setTimeout(() => abort.abort(), SOURCE_TIMEOUT);
  try {
    const response = await load(sourceUrl, {
      cache: "default",
      credentials: "same-origin",
      signal: abort.signal,
    });
    if (!response.ok) return null;
    const markdown = await response.text();
    return markdown.length <= MAX_SOURCE_LENGTH ? markdown : null;
  } catch (_) {
    return null;
  } finally {
    CONTENT_WIN.clearTimeout(timeout);
  }
}

async function loadCourseMarkdown(): Promise<string | null> {
  const sourceUrl = courseSourceUrl();
  if (!sourceUrl) return null;
  if (cachedCourse?.url === sourceUrl) return cachedCourse.markdown;
  if (courseMarkdownPromise?.url === sourceUrl) {
    return courseMarkdownPromise.promise;
  }

  const promise = (async () => {
    for (const delay of SOURCE_RETRY_DELAYS) {
      if (delay > 0) {
        await new Promise<void>((resolve) =>
          CONTENT_WIN.setTimeout(resolve, delay)
        );
      }
      const markdown = await fetchCourseMarkdown(sourceUrl);
      if (markdown !== null) {
        cachedCourse = { markdown, url: sourceUrl };
        return markdown;
      }
    }
    return null;
  })();
  courseMarkdownPromise = { promise, url: sourceUrl };

  try {
    return await promise;
  } finally {
    if (courseMarkdownPromise?.promise === promise) {
      courseMarkdownPromise = null;
    }
  }
}

function rememberPortal(
  state: DeferredLootState,
  portal: HTMLElement,
): ManagedPortalState {
  const known = state.managed.get(portal);
  if (known) return known;
  const remembered = {
    ariaHidden: portal.getAttribute("aria-hidden"),
    hadClass: portal.classList.contains(DEFERRED_PORTAL_CLASS),
  };
  state.managed.set(portal, remembered);
  return remembered;
}

function hidePortal(state: DeferredLootState, portal: HTMLElement): void {
  rememberPortal(state, portal);
  portal.classList.add(DEFERRED_PORTAL_CLASS);
  portal.setAttribute("aria-hidden", "true");
}

function restorePortal(state: DeferredLootState, portal: HTMLElement): void {
  const remembered = state.managed.get(portal);
  if (!remembered) return;
  if (!remembered.hadClass) portal.classList.remove(DEFERRED_PORTAL_CLASS);
  if (remembered.ariaHidden === null) portal.removeAttribute("aria-hidden");
  else portal.setAttribute("aria-hidden", remembered.ariaHidden);
  state.managed.delete(portal);
}

function markerQuizScopes(): Element[] {
  return Array.from(CONTENT_DOC.querySelectorAll(".markerquiz"))
    .filter((scope) => scope.querySelector(".hlq-proxy"));
}

function markerQuizOrdinal(scope: Element, scopes: Element[]): number {
  const slide = scope.closest(".lia-slide__content");
  const peers = slide
    ? scopes.filter((candidate) => candidate.closest(".lia-slide__content") === slide)
    : scopes;
  return peers.indexOf(scope);
}

function currentSourceSection(): number | null {
  const match = /^#(\d+)/.exec(CONTENT_WIN.location.hash);
  if (!match) return null;
  const oneBased = Number.parseInt(match[1], 10);
  return Number.isFinite(oneBased) && oneBased > 0 ? oneBased - 1 : null;
}

function markerQuizIsFinished(scope: Element | undefined): boolean {
  if (!scope) return false;
  return !!scope.querySelector(".lia-quiz.solved, .lia-quiz.resolved") ||
    !!scope.closest(".lia-quiz.solved, .lia-quiz.resolved");
}

function currentMarkerQuizPortalIds(): Set<string> {
  return new Set(Array.from(
    CONTENT_DOC.querySelectorAll<HTMLElement>(MARKERQUIZ_PORTAL_SELECTOR),
    (portal) => portal.dataset.lootChestPortal || "",
  ).filter(Boolean));
}

function applyPendingReveals(state: DeferredLootState): void {
  if (state.status !== "complete") return;
  for (const pending of state.pendingReveals.splice(0)) {
    const candidates: DeferredLootDeclaration[] = [];
    for (const portalId of pending.portalIds) {
      const declaration = state.declarations.get(portalId);
      if (declaration?.quizOrdinal === pending.quizOrdinal) {
        candidates.push(declaration);
      }
    }
    const exactSection = pending.section === null
      ? []
      : candidates.filter((declaration) =>
        declaration.section === pending.section
      );
    const candidateSections = new Set(
      candidates.map((declaration) => declaration.section),
    );
    const selected = exactSection.length > 0
      ? exactSection
      : candidateSections.size === 1 ? candidates : [];
    for (const declaration of selected) {
      state.revealedPortalIds.add(declaration.portalId);
    }
  }
  state.provisionalPortalIds.clear();
}

export function revealDeferredLootSolutionPortals(
  I: Instance,
  scope: Element,
): void {
  const state = stateFor(I);
  const scopes = markerQuizScopes();
  const quizOrdinal = markerQuizOrdinal(scope, scopes);
  if (quizOrdinal < 0) return;
  const portalIds = currentMarkerQuizPortalIds();
  state.pendingReveals.push({
    portalIds,
    quizOrdinal,
    section: currentSourceSection(),
  });
  if (state.status !== "complete" && scopes.length === 1) {
    const sourcePortalIds = Array.from(portalIds).filter((portalId) =>
      SOURCE_PORTAL_ID.test(portalId)
    );
    if (sourcePortalIds.length === 1) {
      state.provisionalPortalIds.add(sourcePortalIds[0]);
    }
  }
  applyPendingReveals(state);
  syncDeferredPortals(state);
}

function syncDeferredPortals(state: DeferredLootState): void {
  if (!state.active) return;
  const portals = Array.from(
    CONTENT_DOC.querySelectorAll<HTMLElement>(MARKERQUIZ_PORTAL_SELECTOR),
  );
  const current = new Set(portals);
  for (const portal of Array.from(state.managed.keys())) {
    if (!portal.isConnected || !current.has(portal)) restorePortal(state, portal);
  }

  if (state.status === "pending" || state.status === "failed") {
    for (const portal of portals) {
      const portalId = portal.dataset.lootChestPortal || "";
      if (!SOURCE_PORTAL_ID.test(portalId)) continue;
      if (state.provisionalPortalIds.has(portalId)) restorePortal(state, portal);
      else hidePortal(state, portal);
    }
    return;
  }

  const scopes = markerQuizScopes();
  const section = currentSourceSection();
  for (const portal of portals) {
    const portalId = portal.dataset.lootChestPortal || "";
    const declaration = state.declarations.get(portalId);
    if (!declaration) {
      restorePortal(state, portal);
      continue;
    }
    const currentScope = section === declaration.section
      ? scopes[declaration.quizOrdinal]
      : undefined;
    if (state.revealedPortalIds.has(portalId) ||
        markerQuizIsFinished(currentScope)) {
      restorePortal(state, portal);
    } else {
      hidePortal(state, portal);
    }
  }
}

function stateFor(I: Instance): DeferredLootState {
  let state = stateByInstance.get(I);
  if (!state) {
    state = {
      active: true,
      declarations: new Map<string, DeferredLootDeclaration>(),
      managed: new Map<HTMLElement, ManagedPortalState>(),
      pendingReveals: [],
      provisionalPortalIds: new Set<string>(),
      revealedPortalIds: new Set<string>(),
      status: "idle",
    };
    stateByInstance.set(I, state);
  }
  state.active = true;
  return state;
}

export function ensureDeferredLootSolutionPortals(I: Instance): void {
  const state = stateFor(I);
  if (state.status === "idle") {
    state.status = "pending";
    void loadCourseMarkdown().then((markdown) => {
      if (!state.active) return;
      if (markdown === null) {
        state.status = "failed";
      } else {
        state.declarations = deferredLootDeclarations(markdown);
        state.status = "complete";
        applyPendingReveals(state);
      }
      syncDeferredPortals(state);
    });
  }
  syncDeferredPortals(state);
}

export function cleanupDeferredLootSolutionPortals(I: Instance): void {
  const state = stateByInstance.get(I);
  if (!state) return;
  state.active = false;
  for (const portal of Array.from(state.managed.keys())) {
    restorePortal(state, portal);
  }
  stateByInstance.delete(I);
}
