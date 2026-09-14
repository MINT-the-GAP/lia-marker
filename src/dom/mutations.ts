import { CONTENT_DOC, getContentRoot } from "./context";
import { isOverlayMutation } from "../highlight/overlay";

const OWN_UI = [
  "#lia-hl-ui-overlay-v1", "#lia-hl-inline-slot-v1", "#lia-hl-panel",
  "#lia-hl-style-static-v4", "#lia-hl-style-content-v4", "#lia-hl-root-style-v4",
].join(",");
const PEER_UI = "#lia-tff-btn-v2, #lia-tff-panel-v2, #lia-tff-ui-overlay-v2, #lia-tff-inline-slot-v2";
// lia-loot moves solution rewards directly under body, outside the course main.
// Their creation/removal still belongs to marker-quiz resolution processing.
const QUIZ_PORTAL = '[data-loot-chest-portal][data-loot-chest-location="markerquiz"]';
const CONTENT = QUIZ_PORTAL + ", main, [role='main'], .markerquiz, .lia-hl-target, .lia-hl-prefill, .lia-problem, .lia-quiz, .reveal, .lia-slide, .lia-section, .lia-content";
const STRUCTURE = "main, [role='main'], #lia-toolbar-nav, header.lia-header, .lia-header__left, .lia-canvas";

function elementFor(node: Node): Element | null {
  return node.nodeType === 1 ? node as Element : node.parentElement;
}

function changes(record: MutationRecord): Node[] {
  return [...record.addedNodes, ...record.removedNodes];
}

function matchesOrContains(node: Node, selector: string): boolean {
  return node.nodeType === 1 && ((node as Element).matches(selector) || !!(node as Element).querySelector(selector));
}

export function isMarkerOwnedMutation(record: MutationRecord): boolean {
  if (isOverlayMutation(record)) return true;
  if (elementFor(record.target)?.closest(OWN_UI)) return true;
  const nodes = changes(record);
  return nodes.length > 0 && nodes.every(node => node.nodeType === 1 && (node as Element).matches(OWN_UI));
}

export function isMarkerContentMutation(record: MutationRecord): boolean {
  if (record.target.ownerDocument !== CONTENT_DOC || isMarkerOwnedMutation(record)) return false;
  const target = elementFor(record.target);
  if (target?.closest(`${PEER_UI}, head, script, style`)) return false;
  const nodes = changes(record);
  if (nodes.length && nodes.every(node =>
    (node.nodeType === 1 && (node as Element).matches(`${OWN_UI}, ${PEER_UI}, script, style, link`)) ||
    node.nodeType === 8 || (node.nodeType === 3 && !node.textContent?.trim())
  )) return false;
  // Content replacements and dynamically rendered native quizzes/prefills must
  // still be initialized, including fixtures and embeds without a <main>.
  if (target?.closest(CONTENT) || nodes.some(node => matchesOrContains(node, CONTENT))) return true;
  return getContentRoot() === CONTENT_DOC.body &&
    !target?.closest("header, nav, aside, #lia-toolbar-nav, .lia-header");
}

export function isMarkerStructureMutation(record: MutationRecord): boolean {
  return !isMarkerOwnedMutation(record) && changes(record).some(node => matchesOrContains(node, STRUCTURE));
}

export function isExternalStylesheetMutation(record: MutationRecord): boolean {
  if (isMarkerOwnedMutation(record)) return false;
  return !!elementFor(record.target)?.closest("style") ||
    changes(record).some(node => matchesOrContains(node, 'style, link[rel="stylesheet"]'));
}

// MutationRecord.oldValue and the final attribute value may differ only in
// marker-owned state. Ignore those changes before scheduling any work.
export function hasExternalAttributeChange(record: MutationRecord): boolean {
  const element = elementFor(record.target);
  if (!element || isMarkerOwnedMutation(record) || element.closest(PEER_UI)) return false;
  const name = record.attributeName || "";
  const current = element.getAttribute(name);
  if (name === "class") {
    const externalClasses = (value: string | null) => (value || "").split(/\s+/)
      .filter(token => token && !token.startsWith("lia-hl-")).sort().join(" ");
    return externalClasses(record.oldValue) !== externalClasses(current);
  }
  if (name === "style") {
    const externalStyle = (value: string | null) => {
      const style = element.ownerDocument.createElement("span").style;
      style.cssText = value || "";
      return Array.from(style).filter(property => !property.startsWith("--hl-"))
        .sort().map(property => `${property}:${style.getPropertyValue(property)}!${style.getPropertyPriority(property)}`).join(";");
    };
    return externalStyle(record.oldValue) !== externalStyle(current);
  }
  return record.oldValue !== current;
}
