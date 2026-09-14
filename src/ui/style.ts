interface AppliedStyle { input: string; serialized: string; priority: string; }
const applied = new WeakMap<HTMLElement, Map<string, AppliedStyle>>();

/** Avoid mutations even when CSSOM normalizes e.g. rgba alpha .45 to 0.45. */
export function setStyle(el: HTMLElement, name: string, value: string, priority = ""): void {
  const current = el.style.getPropertyValue(name);
  const currentPriority = el.style.getPropertyPriority(name);
  if (current === value && currentPriority === priority) return;
  const previous = applied.get(el)?.get(name);
  if (previous?.input === value && previous.serialized === current &&
      previous.priority === priority && currentPriority === priority) return;
  el.style.setProperty(name, value, priority);
  let properties = applied.get(el);
  if (!properties) { properties = new Map(); applied.set(el, properties); }
  properties.set(name, { input: value, serialized: el.style.getPropertyValue(name), priority });
}

export function toggleClass(el: Element, name: string, enabled: boolean): void {
  if (el.classList.contains(name) !== enabled) el.classList.toggle(name, enabled);
}
