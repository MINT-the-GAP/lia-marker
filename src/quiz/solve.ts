import { ensureScopeIds } from "../highlight/store";
import type { Instance, HLColor } from "../types";
import { rangeFromAnchor } from "../dom/ranges";
import { packedRectsFromRange } from "../dom/rects";
import { getActiveSlideId, slideIdFromNode } from "../slides";
import { collectTargetsInScope, hlqActiveSlideId } from "./eval";

export function solveScope(I: Instance, scopeEl: Element | null, renderFn: () => void): void {
  ensureScopeIds();
  const scopeId = (scopeEl as HTMLElement | null)?.dataset?.hlScope || "global";
  const slideId = hlqActiveSlideId(scopeEl);

  // Remove old solutions for this scope+slide
  I.HL = I.HL.filter(h => !(
    (h.kind === "solution") &&
    ((h.scope || "global") === scopeId) &&
    ((h.slide || "global") === slideId)
  ));

  const targets = collectTargetsInScope(scopeEl);
  for (const t of targets) {
    const r = rangeFromAnchor(t.anchor);
    if (!r) continue;
    const rects = packedRectsFromRange(r);
    const showColor = (t.color === "any") ? "yellow" : t.color;

    I.HL.push({
      id: I.nextId++,
      kind: "solution",
      scope: scopeId,
      slide: slideId,
      color: showColor as HLColor,
      anchor: t.anchor,
      rects
    });
  }

  renderFn();
}
