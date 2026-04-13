import { CONTENT_DOC } from "./context";
import type { Anchor } from "../types";

export function nodeToPath(node: Node): string {
  const root = CONTENT_DOC.body;
  const parts: number[] = [];
  let n: Node | null = node;
  while (n && n !== root) {
    const p = n.parentNode;
    if (!p) break;
    const idx = Array.prototype.indexOf.call(p.childNodes, n);
    parts.push(idx);
    n = p;
  }
  parts.reverse();
  return parts.join("/");
}

export function pathToNode(path: string): Node | null {
  const root = CONTENT_DOC.body;
  if (!path) return null;
  const parts = path.split("/").filter(Boolean).map(x => parseInt(x, 10));
  let n: Node | null = root;
  for (const idx of parts) {
    if (!n || !("childNodes" in n) || idx < 0 || idx >= (n as Element).childNodes.length) return null;
    n = (n as Element).childNodes[idx] as Node;
  }
  return n || null;
}

function clampOffset(node: Node, off: number): number {
  if (!node) return 0;
  if (node.nodeType === 3) {
    const len = (node.nodeValue || "").length;
    return Math.max(0, Math.min(off, len));
  }
  if (node.nodeType === 1) {
    const len = node.childNodes ? node.childNodes.length : 0;
    return Math.max(0, Math.min(off, len));
  }
  return 0;
}

export function rangeFromAnchor(a: Anchor | null): Range | null {
  if (!a) return null;
  const sc = pathToNode(a.sp);
  const ec = pathToNode(a.ep);
  if (!sc || !ec) return null;

  const r = CONTENT_DOC.createRange();
  const so = clampOffset(sc, a.so);
  const eo = clampOffset(ec, a.eo);

  try {
    r.setStart(sc, so);
    r.setEnd(ec, eo);
    if (r.collapsed) return null;
    return r;
  } catch(e) {
    return null;
  }
}

export function trimRangeWhitespace(range: Range): boolean {
  if (!range) return false;

  const WS = (ch: string) =>
    ch === " "  || ch === "\t" || ch === "\n" || ch === "\r" ||
    ch === "\u00A0" || ch === "\u2009" || ch === "\u202F";

  const root = range.commonAncestorContainer.nodeType === 1
    ? range.commonAncestorContainer as Element
    : range.commonAncestorContainer.parentNode as Element;

  if (!root) return false;

  const tw = CONTENT_DOC.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node: Node) {
      try {
        return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      } catch(e) {
        return NodeFilter.FILTER_REJECT;
      }
    }
  });

  const segs: { node: Node; s: number; e: number; text: string }[] = [];
  let n: Node | null;
  while ((n = tw.nextNode())) {
    const text = n.nodeValue || "";
    if (!text.length) continue;

    let s = 0;
    let e = text.length;

    if (n === range.startContainer) s = range.startOffset;
    if (n === range.endContainer)   e = range.endOffset;

    s = Math.max(0, Math.min(s, text.length));
    e = Math.max(0, Math.min(e, text.length));
    if (e <= s) continue;

    segs.push({ node: n, s, e, text: text.slice(s, e) });
  }

  if (!segs.length) return false;

  let newStartNode: Node | null = null, newStartOff = 0;
  for (const seg of segs) {
    const t = seg.text;
    let i = 0;
    while (i < t.length && WS(t[i])) i++;
    if (i < t.length) {
      newStartNode = seg.node;
      newStartOff  = seg.s + i;
      break;
    }
  }

  let newEndNode: Node | null = null, newEndOff = 0;
  for (let k = segs.length - 1; k >= 0; k--) {
    const seg = segs[k];
    const t = seg.text;
    let i = t.length - 1;
    while (i >= 0 && WS(t[i])) i--;
    if (i >= 0) {
      newEndNode = seg.node;
      newEndOff  = seg.s + i + 1;
      break;
    }
  }

  if (!newStartNode || !newEndNode) return false;

  try {
    range.setStart(newStartNode, newStartOff);
    range.setEnd(newEndNode, newEndOff);
    return !range.collapsed;
  } catch(e) {
    return false;
  }
}
