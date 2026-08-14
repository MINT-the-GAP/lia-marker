import { CONTENT_DOC, ROOT_WIN } from "../dom/context";
import type { Instance } from "../types";
import {
  liaInputIdentitiesForMarkerScope,
  nativeQuizzesForMarkerScope,
} from "./dom";
import { hlqActiveSlideId } from "./eval";

export const MARKER_QUIZ_GATE_ATTR = "data-hlq-gate-hidden";

type GateAttribute = "data-hint-button" | "data-solution-button";

interface GateDefinition {
  attribute: GateAttribute;
  selector: string;
}

const GATES: GateDefinition[] = [
  { attribute: "data-hint-button", selector: ".lia-quiz__hint" },
  { attribute: "data-solution-button", selector: ".lia-quiz__resolve" },
];

const managedControls = new Set<HTMLElement>();

function parseGateThreshold(raw: string | null): number | null {
  if (raw === null) return null;
  const value = raw.trim().toLowerCase();
  if (/^(?:on|true|enable|enabled)$/.test(value)) return 0;
  if (/^(?:off|false|disable|disabled)$/.test(value)) return Infinity;
  if (!/^[+-]?\d+$/.test(value)) return null;
  const threshold = Math.abs(Number.parseInt(value, 10));
  return Number.isSafeInteger(threshold) ? threshold : null;
}

function scopeAttemptKey(scope: Element): string | Element {
  const identities = liaInputIdentitiesForMarkerScope(scope)
    .map(({ group, item }) => `${group}:${item ?? "*"}`)
    .sort();
  if (!identities.length) return scope;
  return `${hlqActiveSlideId(scope)}::input:${identities.join("|")}`;
}

function ownedQuizControl(quiz: Element, selector: string): HTMLElement | null {
  const control = Array.from(quiz.querySelectorAll(selector))
    .find((candidate) => candidate.closest(".lia-quiz") === quiz);
  return (control as HTMLElement | undefined) || null;
}

function attemptsFromNativeQuiz(quiz: Element): number {
  const label = ownedQuizControl(quiz, ".lia-quiz__check")?.textContent || "";
  const match = label.trim().match(/(?:^|\s)(\d+)$/);
  return match ? Number(match[1]) : 0;
}

function attemptsForScope(
  I: Instance,
  scope: Element,
  quizzes: Element[],
): number {
  I.__quizGateAttempts ??= new Map<string | Element, number>();
  const key = scopeAttemptKey(scope);
  const known = I.__quizGateAttempts.get(key);
  const rehydrated = quizzes.reduce(
    (maximum, quiz) => Math.max(maximum, attemptsFromNativeQuiz(quiz)),
    0,
  );
  const attempts = known === undefined ? rehydrated : Math.max(known, rehydrated);
  I.__quizGateAttempts.set(key, attempts);
  return attempts;
}

function thresholdForQuiz(
  scope: Element,
  quiz: Element,
  attribute: GateAttribute,
): number | null {
  // LiaScript has already configured this native quiz itself. Do not add a
  // second gate in the layout where the authored comment reached the quiz.
  if (quiz.hasAttribute(attribute)) return null;
  return parseGateThreshold(scope.getAttribute(attribute));
}

function setGate(control: HTMLElement, hidden: boolean): void {
  managedControls.add(control);
  if (hidden) control.setAttribute(MARKER_QUIZ_GATE_ATTR, "true");
  else control.removeAttribute(MARKER_QUIZ_GATE_ATTR);
}

export function ensureMarkerQuizGates(I: Instance): void {
  if (!I.__alive) return;
  I.__cleanupQuizGates ??= () => cleanupMarkerQuizGates(I);

  I.__quizGateAttempts ??= new Map<string | Element, number>();
  for (const key of Array.from(I.__quizGateAttempts.keys())) {
    if (typeof key !== "string" && !key.isConnected) {
      I.__quizGateAttempts.delete(key);
    }
  }

  const activeControls = new Set<HTMLElement>();
  const scopes = Array.from(CONTENT_DOC.querySelectorAll(".markerquiz"));
  for (const scope of scopes) {
    const quizzes = nativeQuizzesForMarkerScope(scope);
    if (!quizzes.length) continue;
    const attempts = attemptsForScope(I, scope, quizzes);

    for (const quiz of quizzes) {
      for (const gate of GATES) {
        const threshold = thresholdForQuiz(scope, quiz, gate.attribute);
        if (threshold === null) continue;
        const control = ownedQuizControl(quiz, gate.selector);
        if (!control) continue;
        activeControls.add(control);
        setGate(control, attempts < threshold);
      }
    }
  }

  for (const control of Array.from(managedControls)) {
    if (activeControls.has(control)) continue;
    control.removeAttribute(MARKER_QUIZ_GATE_ATTR);
    managedControls.delete(control);
  }
}

export function recordMarkerQuizFailures(
  I: Instance,
  scopes: Array<Element | null>,
): void {
  I.__quizGateAttempts ??= new Map<string | Element, number>();
  const keys = new Set<string | Element>();
  for (const scope of scopes) {
    if (!scope) continue;
    if (!GATES.some((gate) => scope.hasAttribute(gate.attribute))) continue;
    keys.add(scopeAttemptKey(scope));
  }
  for (const key of keys) {
    I.__quizGateAttempts.set(key, (I.__quizGateAttempts.get(key) || 0) + 1);
  }
}

export function scheduleMarkerQuizGates(I: Instance): void {
  const run = () => {
    if (I.__alive) ensureMarkerQuizGates(I);
  };
  try { ROOT_WIN.requestAnimationFrame(run); } catch (_) {}
  ROOT_WIN.setTimeout(run, 0);
  ROOT_WIN.setTimeout(run, 80);
}

export function cleanupMarkerQuizGates(I: Instance): void {
  for (const control of Array.from(managedControls)) {
    control.removeAttribute(MARKER_QUIZ_GATE_ATTR);
  }
  managedControls.clear();
  I.__quizGateAttempts?.clear();
  I.__cleanupQuizGates = undefined;
}
