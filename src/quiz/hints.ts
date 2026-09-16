import { CONTENT_DOC } from "../dom/context";
import type { Instance } from "../types";
import { liaInputIdentitiesForMarkerScope, nativeQuizzesForMarkerScope } from "./dom";
import { hlqActiveSlideId } from "./eval";

export const EXTERIOR_HINT_ATTR = "data-hlq-exterior-hint";
const GENERATED_HINT_ATTR = "data-hlq-hint-control";
const MAX_HINT_TEXT = 100_000;

interface HintSource {
  scope: Element;
  texts: string[];
  key: string;
  artifacts: Element[];
  restore: () => void;
}

interface QuizHints {
  quiz: Element;
  button: HTMLButtonElement;
  list: HTMLUListElement;
  ownsList: boolean;
  sources: HintSource[];
  items: HTMLLIElement[];
  signature: string;
}

interface HintState {
  sources: Map<Element, HintSource>;
  quizzes: Map<Element, QuizHints>;
  revealed: Map<string, number>;
}

const states = new WeakMap<Instance, HintState>();

function stateFor(I: Instance): HintState {
  let state = states.get(I);
  if (!state) {
    state = { sources: new Map(), quizzes: new Map(), revealed: new Map() };
    states.set(I, state);
  }
  return state;
}

function nextSignificant(node: Node | null): Node | null {
  while (node && (node.nodeType === Node.COMMENT_NODE ||
    (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()))) {
    node = node.nextSibling;
  }
  return node;
}

function parseHints(text: string): { texts: string[]; end: number } | null {
  if (text.length > MAX_HINT_TEXT || !/^\s*\[\[\?\]\]/.test(text)) return null;
  const delimiter = text.search(/\*{3,}/);
  const end = delimiter < 0 ? text.length : delimiter;
  const prefix = text.slice(0, end);
  const texts = prefix.split(/\[\[\?\]\]/).slice(1)
    .map((value) => value.trim()).filter(Boolean);
  return texts.length ? { texts, end } : null;
}

function sourceKey(scope: Element, texts: string[]): string {
  const identities = liaInputIdentitiesForMarkerScope(scope)
    .map(({ group, item }) => `${group}:${item ?? "*"}`).sort().join("|");
  return `${hlqActiveSlideId(scope)}::${identities}::${texts.join("\u001f")}`;
}

function restoreAttribute(element: Element, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function collectParagraphHints(scope: Element, first: Element): HintSource | null {
  const texts: string[] = [];
  const artifacts: Element[] = [];
  const restorations: Array<() => void> = [];
  let candidate: Node | null = first;
  while (candidate?.nodeType === Node.ELEMENT_NODE) {
    const element = candidate as Element;
    if (!element.matches(".lia-problem") || element.hasAttribute(EXTERIOR_HINT_ATTR)) break;
    const text = element.textContent || "";
    const parsed = parseHints(text);
    if (!parsed || text.slice(parsed.end).trim()) break;
    const hidden = element.getAttribute("hidden");
    const ariaHidden = element.getAttribute("aria-hidden");
    const authoredHint = element.getAttribute(EXTERIOR_HINT_ATTR);
    element.setAttribute(EXTERIOR_HINT_ATTR, "");
    element.setAttribute("hidden", "");
    element.setAttribute("aria-hidden", "true");
    restorations.push(() => {
      restoreAttribute(element, "hidden", hidden);
      restoreAttribute(element, "aria-hidden", ariaHidden);
      restoreAttribute(element, EXTERIOR_HINT_ATTR, authoredHint);
    });
    texts.push(...parsed.texts);
    artifacts.push(element);
    candidate = nextSignificant(element.nextSibling);
  }
  if (!texts.length) return null;
  return {
    scope, texts, artifacts, key: sourceKey(scope, texts),
    restore: () => restorations.forEach((restore) => restore()),
  };
}

function collectTextHints(scope: Element, first: Text): HintSource | null {
  const originals: Text[] = [];
  let candidate: Node | null = first;
  while (candidate?.nodeType === Node.TEXT_NODE) {
    originals.push(candidate as Text);
    candidate = candidate.nextSibling;
  }
  const text = originals.map((node) => node.data).join("");
  const parsed = parseHints(text);
  const parent = first.parentNode;
  if (!parsed || !parent) return null;

  const anchor = CONTENT_DOC.createComment("hlq-exterior-hint");
  const artifact = CONTENT_DOC.createElement("span");
  artifact.setAttribute(EXTERIOR_HINT_ATTR, "");
  artifact.setAttribute("hidden", "");
  artifact.setAttribute("aria-hidden", "true");
  artifact.textContent = text.slice(0, parsed.end);
  const remainder = CONTENT_DOC.createTextNode(text.slice(parsed.end));
  parent.insertBefore(anchor, first);
  parent.insertBefore(artifact, first);
  if (remainder.data) parent.insertBefore(remainder, first);
  originals.forEach((node) => node.remove());
  let restored = false;
  return {
    scope, texts: parsed.texts, artifacts: [artifact],
    key: sourceKey(scope, parsed.texts),
    restore() {
      if (restored) return;
      restored = true;
      artifact.remove();
      remainder.remove();
      if (anchor.parentNode) {
        originals.forEach((node) => anchor.parentNode!.insertBefore(node, anchor));
        anchor.remove();
      }
    },
  };
}

function collectHints(scope: Element): HintSource | null {
  const first = nextSignificant(scope.nextSibling);
  if (first?.nodeType === Node.TEXT_NODE) return collectTextHints(scope, first as Text);
  if (first?.nodeType === Node.ELEMENT_NODE) return collectParagraphHints(scope, first as Element);
  return null;
}

function ownedElement(quiz: Element, selector: string): Element | null {
  return Array.from(quiz.querySelectorAll(selector))
    .find((element) => element.closest(".lia-quiz") === quiz) || null;
}

function removeQuizHints(binding: QuizHints): void {
  binding.button.remove();
  binding.items.forEach((item) => item.remove());
  if (binding.ownsList) binding.list.remove();
}

function renderQuizHints(binding: QuizHints, state: HintState): void {
  const entries: Array<{ text: string; key: string; visible: boolean }> = [];
  binding.sources.forEach((source) => source.texts.forEach((text, index) => {
    entries.push({
      text, key: source.key, visible: index < (state.revealed.get(source.key) || 0),
    });
  }));
  const signature = JSON.stringify(entries);
  if (signature === binding.signature && binding.items.every((item) => item.isConnected)) return;
  binding.signature = signature;
  binding.items.forEach((item) => item.remove());
  binding.items = entries.map((entry) => {
    const item = CONTENT_DOC.createElement("li");
    item.className = "lia-list-item";
    item.textContent = entry.text;
    item.hidden = !entry.visible;
    binding.list.appendChild(item);
    return item;
  });
  binding.button.disabled = entries.every((entry) => entry.visible);
  binding.button.setAttribute("aria-expanded", String(entries.some((entry) => entry.visible)));
}

function createQuizHints(quiz: Element, state: HintState): QuizHints | null {
  const controls = ownedElement(quiz, ".lia-quiz__control");
  if (!controls || ownedElement(quiz, `.lia-quiz__hint:not([${GENERATED_HINT_ATTR}])`)) return null;
  const button = CONTENT_DOC.createElement("button");
  button.type = "button";
  button.className = "lia-btn lia-btn--transparent lia-quiz__hint";
  button.setAttribute(GENERATED_HINT_ATTR, "");
  button.setAttribute("aria-label", "Hinweis anzeigen");
  button.title = "Hinweis anzeigen";
  const icon = CONTENT_DOC.createElement("i");
  icon.className = "icon icon-hint lia-btn__icon";
  icon.setAttribute("aria-hidden", "true");
  button.appendChild(icon);
  controls.appendChild(button);
  const existingList = ownedElement(quiz, ".lia-quiz__hints") as HTMLUListElement | null;
  const list = existingList || CONTENT_DOC.createElement("ul");
  if (!existingList) {
    list.className = "lia-list--unordered lia-quiz__hints";
    list.setAttribute("aria-live", "polite");
    quiz.appendChild(list);
  }
  const binding: QuizHints = {
    quiz, button, list, ownsList: !existingList, sources: [], items: [], signature: "",
  };
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    for (const source of binding.sources) {
      const revealed = state.revealed.get(source.key) || 0;
      if (revealed >= source.texts.length) continue;
      state.revealed.set(source.key, revealed + 1);
      break;
    }
    renderQuizHints(binding, state);
  });
  return binding;
}

export function ensureMarkerQuizHints(I: Instance): void {
  if (!I.__alive) return;
  const state = stateFor(I);
  const scopes = Array.from(CONTENT_DOC.querySelectorAll(".markerquiz"));
  const current = new Set(scopes);
  for (const [scope, source] of state.sources) {
    if (!current.has(scope) || !source.artifacts.every((artifact) => artifact.isConnected)) {
      source.restore();
      state.sources.delete(scope);
    }
  }
  const sourcesByQuiz = new Map<Element, HintSource[]>();
  for (const scope of scopes) {
    const quizzes = nativeQuizzesForMarkerScope(scope);
    if (!quizzes.length) continue;
    let source = state.sources.get(scope);
    if (!source) {
      // A correctly parsed native hint owns its own authored content and state.
      if (quizzes.some((quiz) => ownedElement(quiz,
        `.lia-quiz__hint:not([${GENERATED_HINT_ATTR}])`))) continue;
      source = collectHints(scope) || undefined;
      if (!source) continue;
      state.sources.set(scope, source);
    }
    for (const quiz of quizzes) {
      const sources = sourcesByQuiz.get(quiz) || [];
      sources.push(source);
      sourcesByQuiz.set(quiz, sources);
    }
  }
  for (const [quiz, binding] of state.quizzes) {
    if (!sourcesByQuiz.has(quiz) || !binding.button.isConnected || !binding.list.isConnected ||
      ownedElement(quiz, `.lia-quiz__hint:not([${GENERATED_HINT_ATTR}])`)) {
      removeQuizHints(binding);
      state.quizzes.delete(quiz);
    }
  }
  for (const [quiz, sources] of sourcesByQuiz) {
    let binding = state.quizzes.get(quiz);
    if (!binding) {
      binding = createQuizHints(quiz, state) || undefined;
      if (!binding) continue;
      state.quizzes.set(quiz, binding);
    }
    binding.sources = sources;
    renderQuizHints(binding, state);
  }
}

// Restore authored hint nodes when the plugin is removed.
export function cleanupMarkerQuizHints(I: Instance): void {
  const state = states.get(I);
  if (!state) return;
  state.quizzes.forEach(removeQuizHints);
  state.sources.forEach((source) => source.restore());
  state.quizzes.clear();
  states.delete(I);
}
