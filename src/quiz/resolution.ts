import { CONTENT_DOC } from "../dom/context";
import { ensureScopeIds } from "../highlight/store";
import type { Instance } from "../types";
import { hlqActiveSlideId } from "./eval";

const ASTERISK_DELIMITER = /^\*{3,}$/;
const RESOLUTION_CLASS = "hlq-resolution";
const DELIMITER_CLASS = "hlq-resolution__delimiter";
const MAX_RESOLUTION_ELEMENTS = 200;

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

interface ResolutionBinding {
  opening: Element;
  closing: Element;
  content: Element[];
  key: string;
  controls: Map<Element, ControlState>;
}

const resolutionByScope = new Map<Element, ResolutionBinding>();
const managedElements = new WeakMap<Element, ManagedElementState>();

function isAsteriskDelimiter(element: Element | null): boolean {
  return !!element &&
    element.matches("p.lia-problem") &&
    element.children.length === 0 &&
    ASTERISK_DELIMITER.test((element.textContent || "").trim());
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

function collectResolution(scopeEl: Element): Omit<ResolutionBinding, "key" | "controls"> | null {
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

  return { opening, closing, content };
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
  ensureResolutionStateObserver(I);
  I.__cleanupResolutions ??= () => cleanupMarkerQuizResolutions(I);
  ensureScopeIds();
  const scopes = Array.from(CONTENT_DOC.querySelectorAll(".markerquiz"));
  const currentScopes = new Set(scopes);
  for (const [scope, binding] of resolutionByScope) {
    if (!scope.isConnected || !currentScopes.has(scope)) {
      cleanupBinding(binding);
      resolutionByScope.delete(scope);
    }
  }
  for (const scope of scopes) bindResolution(I, scope);
}

export function cleanupMarkerQuizResolutions(I: Instance): void {
  for (const binding of resolutionByScope.values()) cleanupBinding(binding);
  resolutionByScope.clear();
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
