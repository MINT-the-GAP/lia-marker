import { CONTENT_DOC } from "../dom/context";
import { ensureScopeIds } from "../highlight/store";
import type { Instance } from "../types";
import { hlqActiveSlideId } from "./eval";

const ASTERISK_DELIMITER = /^\*{3,}$/;
const RESOLUTION_CLASS = "hlq-resolution";
const DELIMITER_CLASS = "hlq-resolution__delimiter";
const INLINE_DELIMITER_ATTR = "data-hlq-inline-delimiter";
const INLINE_CONTENT_ATTR = "data-hlq-inline-content";
const METADATA_ARTIFACT_CLASS = "hlq-metadata-artifact";
const MAX_RESOLUTION_ELEMENTS = 200;
const MAX_INLINE_RESOLUTION_TEXT = 100_000;

interface ManagedElementState {
  managedClass: string;
  hadClass: boolean;
  hadHidden: boolean;
  hiddenValue: string | null;
  ariaHidden: string | null;
  dataResolution: string | null;
  dataState: string | null;
  generatedId: string | null;
}

interface ControlState {
  ownedIds: Set<string>;
  originalExpanded: string | null;
}

interface InlineResolutionState {
  scope: Element;
  replacements: TextReplacement[];
  restored: boolean;
  restore: () => void;
}

interface MetadataArtifactState {
  scope: Element;
  parent: Element;
  wrapper: HTMLElement;
}

interface ResolutionBinding {
  opening: Element;
  closing: Element;
  content: Element[];
  inline: InlineResolutionState | null;
  key: string;
  controls: Map<Element, ControlState>;
}

const resolutionByScope = new Map<Element, ResolutionBinding>();
const managedElements = new WeakMap<Element, ManagedElementState>();
const inlineResolutionByScope = new WeakMap<Element, InlineResolutionState>();
const metadataArtifactsByScope = new Map<Element, MetadataArtifactState>();

function isAsteriskDelimiter(element: Element | null): boolean {
  if (!element) return false;
  const isInlineDelimiter = element.hasAttribute(INLINE_DELIMITER_ATTR);
  if (!isInlineDelimiter && !element.matches(".lia-problem")) return false;
  if (element.querySelector("button,input,textarea,select,.markerquiz,.lia-quiz")) return false;
  const text = (element.textContent || "")
    .replace(/[\s\u200B-\u200D\uFEFF]/g, "");
  return ASTERISK_DELIMITER.test(text);
}

function findClosingDelimiter(opening: Element): Element | null {
  let candidate = opening.nextElementSibling;
  let inspected = 0;
  while (candidate && inspected < MAX_RESOLUTION_ELEMENTS) {
    if (isAsteriskDelimiter(candidate)) return candidate;
    // A malformed, unclosed block must never consume a later marker quiz.
    if (candidate.matches(".markerquiz") || candidate.querySelector(".markerquiz")) return null;
    inspected += 1;
    candidate = candidate.nextElementSibling;
  }
  return null;
}

type CollectedResolution = Omit<ResolutionBinding, "key" | "controls">;

function collectElementResolution(scopeEl: Element): CollectedResolution | null {
  const opening = scopeEl.nextElementSibling;
  if (!opening || !isAsteriskDelimiter(opening)) return null;

  const closing = findClosingDelimiter(opening);
  if (!closing || opening.parentNode !== closing.parentNode) return null;

  const content: Element[] = [];
  let candidate = opening.nextElementSibling;
  while (candidate && candidate !== closing) {
    content.push(candidate);
    candidate = candidate.nextElementSibling;
  }

  const inline = inlineResolutionByScope.get(scopeEl) || null;
  return { opening, closing, content, inline };
}

interface TextReplacement {
  anchor: Comment;
  originals: Text[];
  generated: Element[];
}

interface TextGroup {
  nodes: Text[];
  text: string;
}

type RawTextResolution =
  | {
      kind: "collapsed";
      group: TextGroup;
      opening: string;
      body: string;
      closing: string;
    }
  | {
      kind: "split";
      openingGroup: TextGroup;
      opening: string;
      closingGroup: TextGroup;
      closing: string;
      between: Node[];
    };

function textNode(node: Node | null): Text | null {
  return node?.nodeType === Node.TEXT_NODE ? node as Text : null;
}

function textGroupFrom(start: Node | null): TextGroup | null {
  if (!textNode(start)) return null;
  const nodes: Text[] = [];
  let node: Node | null = start;
  while (node?.nodeType === Node.TEXT_NODE) {
    nodes.push(node as Text);
    node = node.nextSibling;
  }
  return { nodes, text: nodes.map((item) => item.data).join("") };
}

function nodeAfterGroup(group: TextGroup): Node | null {
  return group.nodes[group.nodes.length - 1]?.nextSibling || null;
}

function pureStars(group: TextGroup): string | null {
  const match = /^[\s\u00A0\u200B]*(\*{3,})[\s\u00A0\u200B]*$/.exec(group.text);
  return match?.[1] || null;
}

function collapsedResolution(group: TextGroup): RawTextResolution | null {
  if (group.text.length > MAX_INLINE_RESOLUTION_TEXT) return null;
  // With line breaks gone, three stars are indistinguishable from Markdown
  // emphasis. Weekly tasks use long, matching delimiter rows.
  const match =
    /^[\s\u00A0\u200B\u2B50\u2728\u{1F31F}\uFE0F]*(\*{10,})([\s\S]*?)(\*{10,})[\s\u00A0\u200B\u2B50\u2728\u{1F31F}\uFE0F]*$/u
      .exec(group.text);
  if (!match) return null;

  const [, opening, body, closing] = match;
  if (opening.length !== closing.length || !/[^\s*]/u.test(body)) return null;
  return { kind: "collapsed", group, opening, body, closing };
}

function isInlineBoundary(node: Node): boolean {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  const element = node as Element;
  return element.matches(
    ".markerquiz,.lia-quiz,section,article,h1,h2,h3,h4,h5,h6,hr,script,style",
  ) || !!element.querySelector(".markerquiz,.lia-quiz");
}

function firstSignificantTextGroup(scopeEl: Element): TextGroup | null {
  let node: Node | null = scopeEl.nextSibling;
  while (node) {
    if (node.nodeType === Node.COMMENT_NODE) {
      node = node.nextSibling;
      continue;
    }
    const group = textGroupFrom(node);
    if (group && !group.text.trim()) {
      node = nodeAfterGroup(group);
      continue;
    }
    return group;
  }
  return null;
}

function findRawTextResolution(scopeEl: Element): RawTextResolution | null {
  const openingGroup = firstSignificantTextGroup(scopeEl);
  if (!openingGroup) return null;

  const collapsed = collapsedResolution(openingGroup);
  if (collapsed) return collapsed;

  const opening = pureStars(openingGroup);
  if (!opening) return null;

  const between: Node[] = [];
  let totalText = openingGroup.text.length;
  let candidate: Node | null = nodeAfterGroup(openingGroup);
  for (let inspected = 0; candidate && inspected < MAX_RESOLUTION_ELEMENTS; inspected += 1) {
    const candidateGroup = textGroupFrom(candidate);
    const closing = candidateGroup ? pureStars(candidateGroup) : null;
    if (candidateGroup && closing) {
      const hasContent = between.some((node) =>
        node.nodeType === Node.ELEMENT_NODE ||
        (node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim())
      );
      if (!hasContent || closing.length !== opening.length) return null;
      return {
        kind: "split",
        openingGroup,
        opening,
        closingGroup: candidateGroup,
        closing,
        between,
      };
    }
    if (isInlineBoundary(candidate)) return null;
    if (candidateGroup) {
      totalText += candidateGroup.text.length;
      between.push(...candidateGroup.nodes);
      candidate = nodeAfterGroup(candidateGroup);
    } else {
      totalText += candidate.textContent?.length || 0;
      between.push(candidate);
      candidate = candidate.nextSibling;
    }
    if (totalText > MAX_INLINE_RESOLUTION_TEXT) return null;
  }
  return null;
}

function generatedDelimiter(stars: string): HTMLSpanElement {
  const element = CONTENT_DOC.createElement("span");
  element.setAttribute(INLINE_DELIMITER_ATTR, "");
  element.textContent = stars;
  return element;
}

function generatedContent(text: string): HTMLSpanElement {
  const element = CONTENT_DOC.createElement("span");
  element.setAttribute(INLINE_CONTENT_ATTR, "");
  element.textContent = text;
  return element;
}

function replaceTextGroup(group: TextGroup, generated: Element[]): TextReplacement {
  const original = group.nodes[0];
  const parent = original?.parentNode;
  if (!parent) throw new Error("Detached resolution text");
  if (!group.nodes.every((node) => node.parentNode === parent)) {
    throw new Error("Split resolution text parents");
  }

  const anchor = CONTENT_DOC.createComment("hlq-text-resolution");
  parent.insertBefore(anchor, original);
  generated.forEach((element) => parent.insertBefore(element, original));
  group.nodes.forEach((node) => parent.removeChild(node));
  return { anchor, originals: group.nodes, generated };
}

function textGroupsWithin(nodes: Node[]): TextGroup[] {
  const groups: TextGroup[] = [];
  let current: Text[] = [];
  const flush = () => {
    if (!current.length) return;
    groups.push({ nodes: current, text: current.map((node) => node.data).join("") });
    current = [];
  };
  for (const node of nodes) {
    const text = textNode(node);
    if (text) current.push(text);
    else flush();
  }
  flush();
  return groups;
}

function materializeRawResolution(
  scopeEl: Element,
  raw: RawTextResolution,
): InlineResolutionState | null {
  const replacements: TextReplacement[] = [];
  const state: InlineResolutionState = {
    scope: scopeEl,
    replacements,
    restored: false,
    restore() {
      if (state.restored) return;
      state.restored = true;
      for (const replacement of [...replacements].reverse()) {
        replacement.generated.forEach((element) => element.remove());
        const parent = replacement.anchor.parentNode;
        if (parent) {
          replacement.originals.forEach((node) => parent.insertBefore(node, replacement.anchor));
          replacement.anchor.remove();
        }
      }
    },
  };

  try {
    if (raw.kind === "collapsed") {
      replacements.push(replaceTextGroup(raw.group, [
        generatedDelimiter(raw.opening),
        generatedContent(raw.body),
        generatedDelimiter(raw.closing),
      ]));
    } else {
      replacements.push(replaceTextGroup(
        raw.openingGroup,
        [generatedDelimiter(raw.opening)],
      ));
      for (const group of textGroupsWithin(raw.between)) {
        if (group.text.trim()) {
          replacements.push(replaceTextGroup(group, [generatedContent(group.text)]));
        }
      }
      replacements.push(replaceTextGroup(
        raw.closingGroup,
        [generatedDelimiter(raw.closing)],
      ));
    }
  } catch (_) {
    state.restore();
    return null;
  }
  return state;
}

function inlineStateIsCurrent(state: InlineResolutionState): boolean {
  return !state.restored && state.replacements.every((replacement) =>
    replacement.anchor.isConnected &&
    replacement.generated.every((element) => element.isConnected)
  );
}

function collectResolution(scopeEl: Element): CollectedResolution | null {
  const knownInline = inlineResolutionByScope.get(scopeEl);
  if (knownInline && !inlineStateIsCurrent(knownInline)) {
    knownInline.restore();
    inlineResolutionByScope.delete(scopeEl);
  }

  const elementResolution = collectElementResolution(scopeEl);
  if (elementResolution) return elementResolution;

  const raw = findRawTextResolution(scopeEl);
  if (!raw) return null;
  const inline = materializeRawResolution(scopeEl, raw);
  if (!inline) return null;
  inlineResolutionByScope.set(scopeEl, inline);

  const collected = collectElementResolution(scopeEl);
  if (collected) return collected;
  inline.restore();
  inlineResolutionByScope.delete(scopeEl);
  return null;
}

function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (!parent) return;
  while (element.firstChild) parent.insertBefore(element.firstChild, element);
  element.remove();
  parent.normalize();
}

interface MetadataBoundary {
  node: Text;
  offset: number;
}

function serializedMetadataCandidate(scopeEl: Element): {
  start: MetadataBoundary;
  end: MetadataBoundary;
} | null {
  const parts: Array<{ node: Text; start: number; end: number }> = [];
  let text = "";
  for (const child of Array.from(scopeEl.childNodes)) {
    const start = text.length;
    const chunk = child.textContent || "";
    text += chunk;
    if (child.nodeType === Node.TEXT_NODE) {
      parts.push({ node: child as Text, start, end: text.length });
    }
  }

  const startMatch = text.match(
    /<\s*![\-–—]{1,2}\s*data-(?:solution-timer|hint-button|solution-button)/i,
  );
  if (!startMatch || startMatch.index === undefined) return null;
  const tailStart = startMatch.index + startMatch[0].length;
  const endMatch = text.slice(tailStart).match(/⟶|[\-–—]{1,2}\s*>/);
  if (!endMatch || endMatch.index === undefined) return null;

  const startOffset = startMatch.index;
  const endOffset = tailStart + endMatch.index + endMatch[0].length;
  const startPart = parts.find((part) =>
    part.start <= startOffset && startOffset < part.end
  );
  const endPart = [...parts].reverse().find((part) =>
    part.start < endOffset && endOffset <= part.end
  );
  if (!startPart || !endPart) return null;

  return {
    start: { node: startPart.node, offset: startOffset - startPart.start },
    end: { node: endPart.node, offset: endOffset - endPart.start },
  };
}

function ensureSerializedMetadataHidden(scopeEl: Element): void {
  const known = metadataArtifactsByScope.get(scopeEl);
  if (known?.wrapper.isConnected && known.wrapper.parentElement === known.parent) return;
  if (known) metadataArtifactsByScope.delete(scopeEl);

  const candidate = serializedMetadataCandidate(scopeEl);
  if (!candidate) return;

  const range = CONTENT_DOC.createRange();
  try {
    range.setStart(candidate.start.node, candidate.start.offset);
    range.setEnd(candidate.end.node, candidate.end.offset);
    const wrapper = CONTENT_DOC.createElement("span");
    wrapper.className = METADATA_ARTIFACT_CLASS;
    wrapper.setAttribute("hidden", "");
    wrapper.setAttribute("aria-hidden", "true");
    wrapper.appendChild(range.extractContents());
    range.insertNode(wrapper);
    metadataArtifactsByScope.set(scopeEl, {
      scope: scopeEl,
      parent: scopeEl,
      wrapper,
    });
  } catch (_) {
    // Leave unexpected author content untouched if LiaScript changes this DOM.
  }
}

function cleanupMetadataArtifact(state: MetadataArtifactState): void {
  if (state.wrapper.parentNode) unwrapElement(state.wrapper);
  metadataArtifactsByScope.delete(state.scope);
}

function normalizedText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function hashText(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function externalResolutionText(scopeEl: Element): string {
  const binding = collectResolution(scopeEl);
  if (!binding) return "";
  return normalizedText([
    binding.opening.textContent || "",
    ...binding.content.map((element) => element.textContent || ""),
    binding.closing.textContent || "",
  ].join(" "));
}

function scopeFingerprint(scopeEl: Element): string {
  const targets = Array.from(
    scopeEl.querySelectorAll(".lia-hl-target[data-hl-expected]"),
  ).map((target) => [
    target.getAttribute("data-hl-expected") || "",
    normalizedText(target.textContent || ""),
  ].join(":"));

  return hashText(targets.join("|") + "::" + externalResolutionText(scopeEl));
}

function resolutionKey(scopeEl: Element): string {
  const slideId = hlqActiveSlideId(scopeEl);
  const fingerprint = scopeFingerprint(scopeEl);
  const matchingScopes = Array.from(CONTENT_DOC.querySelectorAll(".markerquiz"))
    .filter((candidate) =>
      hlqActiveSlideId(candidate) === slideId &&
      scopeFingerprint(candidate) === fingerprint
    );
  const ordinal = Math.max(0, matchingScopes.indexOf(scopeEl));
  return [slideId, fingerprint, String(ordinal)].join("::");
}

function nativeQuizIsFinished(scopeEl: Element): boolean {
  return !!scopeEl.querySelector(".lia-quiz.solved, .lia-quiz.resolved");
}

function bindingIsCurrent(scopeEl: Element, binding: ResolutionBinding): boolean {
  const current = collectResolution(scopeEl);
  return !!current &&
    current.opening === binding.opening &&
    current.closing === binding.closing &&
    current.inline === binding.inline &&
    current.content.length === binding.content.length &&
    current.content.every((element, index) => element === binding.content[index]);
}

function rememberElement(element: Element, managedClass: string): ManagedElementState {
  const known = managedElements.get(element);
  if (known) return known;

  const state: ManagedElementState = {
    managedClass,
    hadClass: element.classList.contains(managedClass),
    hadHidden: element.hasAttribute("hidden"),
    hiddenValue: element.getAttribute("hidden"),
    ariaHidden: element.getAttribute("aria-hidden"),
    dataResolution: element.getAttribute("data-hlq-resolution"),
    dataState: element.getAttribute("data-hlq-state"),
    generatedId: null,
  };
  managedElements.set(element, state);
  return state;
}

function restoreAttribute(element: Element, name: string, value: string | null): void {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function restoreManagedElement(element: Element): void {
  const state = managedElements.get(element);
  if (!state) return;

  if (state.hadHidden) element.setAttribute("hidden", state.hiddenValue || "");
  else element.removeAttribute("hidden");
  restoreAttribute(element, "aria-hidden", state.ariaHidden);
  restoreAttribute(element, "data-hlq-resolution", state.dataResolution);
  restoreAttribute(element, "data-hlq-state", state.dataState);
  if (!state.hadClass) element.classList.remove(state.managedClass);
  if (state.generatedId && element.id === state.generatedId) element.removeAttribute("id");
  managedElements.delete(element);
}

function annotateBinding(binding: ResolutionBinding): void {
  const keyHash = hashText(binding.key);

  for (const delimiter of [binding.opening, binding.closing]) {
    rememberElement(delimiter, DELIMITER_CLASS);
    delimiter.classList.add(DELIMITER_CLASS);
    delimiter.setAttribute("hidden", "");
    delimiter.setAttribute("aria-hidden", "true");
  }

  binding.content.forEach((element, index) => {
    const state = rememberElement(element, RESOLUTION_CLASS);
    element.classList.add(RESOLUTION_CLASS);
    element.setAttribute("data-hlq-resolution", keyHash);
    if (!element.id) {
      state.generatedId = "hlq-resolution-" + keyHash + "-" + (index + 1);
      element.id = state.generatedId;
    }
  });
}

function unlinkControl(binding: ResolutionBinding, control: Element): void {
  const state = binding.controls.get(control);
  if (!state) return;

  const ids = new Set((control.getAttribute("aria-controls") || "").split(/\s+/).filter(Boolean));
  state.ownedIds.forEach((id) => ids.delete(id));
  if (ids.size) control.setAttribute("aria-controls", Array.from(ids).join(" "));
  else control.removeAttribute("aria-controls");
  restoreAttribute(control, "aria-expanded", state.originalExpanded);
  binding.controls.delete(control);
}

function linkResolutionControls(
  scopeEl: Element,
  binding: ResolutionBinding,
  visible: boolean,
): void {
  const resolutionIds = binding.content.map((element) => element.id).filter(Boolean);
  const currentControls = new Set(Array.from(scopeEl.querySelectorAll(
    ".lia-quiz__check, .lia-quiz__resolve, button.hlq-btn",
  )));

  for (const control of Array.from(binding.controls.keys())) {
    if (!currentControls.has(control) || !resolutionIds.length) unlinkControl(binding, control);
  }
  if (!resolutionIds.length) return;

  for (const control of currentControls) {
    let state = binding.controls.get(control);
    if (!state) {
      state = {
        ownedIds: new Set<string>(),
        originalExpanded: control.getAttribute("aria-expanded"),
      };
      binding.controls.set(control, state);
    }

    const ids = new Set((control.getAttribute("aria-controls") || "").split(/\s+/).filter(Boolean));
    state.ownedIds.forEach((id) => ids.delete(id));
    state.ownedIds.clear();
    for (const id of resolutionIds) {
      if (!ids.has(id)) {
        ids.add(id);
        state.ownedIds.add(id);
      }
    }
    control.setAttribute("aria-controls", Array.from(ids).join(" "));
    control.setAttribute("aria-expanded", String(visible));
  }
}

function setResolutionVisible(
  scopeEl: Element,
  binding: ResolutionBinding,
  visible: boolean,
): void {
  binding.content.forEach((element) => {
    const state = managedElements.get(element);
    if (visible) {
      if (state?.hadHidden) element.setAttribute("hidden", state.hiddenValue || "");
      else element.removeAttribute("hidden");
      restoreAttribute(element, "aria-hidden", state?.ariaHidden ?? null);
    } else {
      element.setAttribute("hidden", "");
      element.setAttribute("aria-hidden", "true");
    }
    element.setAttribute("data-hlq-state", visible ? "visible" : "hidden");
  });
  linkResolutionControls(scopeEl, binding, visible);
}

function cleanupBinding(binding: ResolutionBinding): void {
  for (const control of Array.from(binding.controls.keys())) unlinkControl(binding, control);
  binding.content.forEach(restoreManagedElement);
  restoreManagedElement(binding.opening);
  restoreManagedElement(binding.closing);
  if (binding.inline) {
    binding.inline.restore();
    inlineResolutionByScope.delete(binding.inline.scope);
  }
}

function bindResolution(I: Instance, scopeEl: Element): ResolutionBinding | null {
  const known = resolutionByScope.get(scopeEl);
  const currentKey = resolutionKey(scopeEl);
  if (known && bindingIsCurrent(scopeEl, known) && known.key === currentKey) {
    const nativeFinished = nativeQuizIsFinished(scopeEl);
    const visible = I.__revealedSolutions?.has(known.key) || nativeFinished;
    if (nativeFinished) {
      I.__revealedSolutions ??= new Set<string>();
      I.__revealedSolutions.add(known.key);
    }
    setResolutionVisible(scopeEl, known, visible);
    return known;
  }
  if (known) {
    cleanupBinding(known);
    resolutionByScope.delete(scopeEl);
  }

  const collected = collectResolution(scopeEl);
  if (!collected) return null;

  const binding: ResolutionBinding = {
    ...collected,
    key: resolutionKey(scopeEl),
    controls: new Map<Element, ControlState>(),
  };
  annotateBinding(binding);
  const nativeFinished = nativeQuizIsFinished(scopeEl);
  const visible = I.__revealedSolutions?.has(binding.key) || nativeFinished;
  if (nativeFinished) {
    I.__revealedSolutions ??= new Set<string>();
    I.__revealedSolutions.add(binding.key);
  }
  setResolutionVisible(scopeEl, binding, visible);
  resolutionByScope.set(scopeEl, binding);
  return binding;
}

function ensureResolutionStateObserver(I: Instance): void {
  if (I.moResolutions) return;

  I.moResolutions = new MutationObserver((records) => {
    if (!I.__alive) return;
    const resolutionStateChanged = records.some((record) =>
      record.type === "childList" ||
      (record.target instanceof Element && record.target.matches(".lia-quiz"))
    );
    if (resolutionStateChanged) ensureMarkerQuizResolutions(I);
  });
  I.moResolutions.observe(CONTENT_DOC.body, {
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
    subtree: true,
  });
}

export function ensureMarkerQuizResolutions(I: Instance): void {
  if (!I.__alive) return;
  ensureResolutionStateObserver(I);
  I.__cleanupResolutions ??= () => cleanupMarkerQuizResolutions(I);
  ensureScopeIds();
  const scopes = Array.from(CONTENT_DOC.querySelectorAll(".markerquiz"));
  const currentScopes = new Set(scopes);
  for (const [scope, artifact] of metadataArtifactsByScope) {
    if (!scope.isConnected || !currentScopes.has(scope)) cleanupMetadataArtifact(artifact);
  }
  for (const [scope, binding] of resolutionByScope) {
    if (!scope.isConnected || !currentScopes.has(scope)) {
      cleanupBinding(binding);
      resolutionByScope.delete(scope);
    }
  }
  for (const scope of scopes) {
    ensureSerializedMetadataHidden(scope);
    bindResolution(I, scope);
  }
}

export function cleanupMarkerQuizResolutions(I: Instance): void {
  for (const binding of resolutionByScope.values()) cleanupBinding(binding);
  resolutionByScope.clear();
  for (const artifact of Array.from(metadataArtifactsByScope.values())) {
    cleanupMetadataArtifact(artifact);
  }
  metadataArtifactsByScope.clear();
  I.moResolutions?.disconnect();
  I.moResolutions = null;
}

export function revealMarkerQuizResolution(I: Instance, scopeEl: Element | null): void {
  if (!scopeEl) return;

  ensureScopeIds();
  const binding = bindResolution(I, scopeEl);
  if (!binding) return;

  I.__revealedSolutions ??= new Set<string>();
  I.__revealedSolutions.add(binding.key);
  setResolutionVisible(scopeEl, binding, true);
}
