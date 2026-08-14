import { CONTENT_DOC } from "../dom/context";

export interface LiaInputIdentity {
  group: number;
  item: number | null;
}

export function getLiaInput(proxy: Element): HTMLInputElement | null {
  return (
    proxy.querySelector(".hlq-lia input, .hlq-lia textarea, .hlq-lia select") ||
    proxy.querySelector("input, textarea, select")
  ) as HTMLInputElement | null;
}

function liaInputHandler(input: Element | null): string {
  if (!input) return "";
  return [input.getAttribute("oninput"), input.getAttribute("onchange")]
    .filter(Boolean)
    .join("\n");
}

export function liaInputIdentity(input: Element | null): LiaInputIdentity | null {
  const handler = liaInputHandler(input);
  const group = handler.match(/\[\s*["']input["']\s*,\s*(\d+)\s*\]/i);
  if (!group) return null;
  const item = handler.match(/\bparam\s*:\s*\{[\s\S]*?\bid\s*:\s*(\d+)/i);
  return {
    group: Number(group[1]),
    item: item ? Number(item[1]) : null,
  };
}

export function sameLiaInputIdentity(
  left: LiaInputIdentity | null,
  right: LiaInputIdentity | null,
): boolean {
  return !!left && !!right && left.group === right.group && left.item === right.item;
}

function nativeQuizForProxy(proxy: Element): Element | null {
  const input = getLiaInput(proxy);
  const identity = liaInputIdentity(input);
  if (!identity) return input?.closest(".lia-quiz") || proxy.closest(".lia-quiz");

  const root = input?.closest(".lia-slide__content") ||
    proxy.closest(".lia-slide__content") ||
    CONTENT_DOC;
  return root.querySelectorAll(".lia-quiz")[identity.group] || null;
}

function ownedByMarkerScope(node: Element, scope: Element): boolean {
  return node.closest(".markerquiz") === scope;
}

function markerScopeProxies(scope: Element): Element[] {
  return Array.from(scope.querySelectorAll(".hlq-proxy"))
    .filter((proxy) => ownedByMarkerScope(proxy, scope));
}

export function liaInputIdentitiesForMarkerScope(
  scope: Element,
): LiaInputIdentity[] {
  const identities = markerScopeProxies(scope)
    .map((proxy) => liaInputIdentity(getLiaInput(proxy)))
    .filter((identity): identity is LiaInputIdentity => identity !== null);

  const unique = new Map<string, LiaInputIdentity>();
  for (const identity of identities) {
    unique.set(`${identity.group}:${identity.item ?? "*"}`, identity);
  }
  return Array.from(unique.values());
}

export function nativeQuizzesForMarkerScope(scope: Element): Element[] {
  const quizzes = new Set<Element>(
    Array.from(scope.querySelectorAll(".lia-quiz"))
      .filter((quiz) => ownedByMarkerScope(quiz, scope)),
  );
  for (const proxy of markerScopeProxies(scope)) {
    const quiz = nativeQuizForProxy(proxy);
    if (quiz) quizzes.add(quiz);
  }
  return Array.from(quizzes);
}
