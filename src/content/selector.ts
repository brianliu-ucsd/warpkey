import type { ActionKind, SelectorChain } from "../types/binding";
import { normalizeVolatileText } from "../shared/text";

function buildStructuralPath(el: Element): string {
  const parts: string[] = [];
  let node: Element | null = el;
  while (node && node !== document.documentElement) {
    const parent: Element | null = node.parentElement;
    if (!parent) break;
    const siblings = Array.from(parent.children).filter((c) => c.tagName === node!.tagName);
    const index = siblings.indexOf(node) + 1;
    parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${index})`);
    node = parent;
  }
  return parts.join(" > ");
}

function impliedRole(el: Element): string | undefined {
  if (el instanceof HTMLButtonElement) return "button";
  if (el instanceof HTMLAnchorElement) return "link";
  return undefined;
}

export function buildSelectorChain(el: Element): SelectorChain {
  return {
    testId: el.getAttribute("data-testid") ?? undefined,
    id: el.id || undefined,
    ariaRole: el.getAttribute("role") ?? impliedRole(el),
    ariaName: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 80) ?? undefined,
    structuralPath: buildStructuralPath(el),
  };
}

export function captureFingerprint(el: Element): string {
  const text = el.getAttribute("aria-label") ?? el.textContent ?? "";
  return text.trim().slice(0, 120);
}

function tryQueryAll(selector: string): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function resolveByTier(chain: SelectorChain): Element | null {
  if (chain.testId) {
    const matches = tryQueryAll(`[data-testid="${CSS.escape(chain.testId)}"]`);
    if (matches.length === 1) return matches[0]!;
  }
  if (chain.id) {
    const el = document.getElementById(chain.id);
    if (el) return el;
  }
  if (chain.ariaRole && chain.ariaName) {
    const candidates = tryQueryAll(`[role="${CSS.escape(chain.ariaRole)}"], ${chain.ariaRole}`);
    const matches = candidates.filter(
      (c) => (c.getAttribute("aria-label") ?? c.textContent ?? "").trim() === chain.ariaName,
    );
    if (matches.length === 1) return matches[0]!;
  }
  if (chain.structuralPath) {
    const el = document.querySelector(chain.structuralPath);
    if (el) return el;
  }
  return null;
}

export interface ResolveResult {
  element: Element | null;
  /** True when an element resolved but its fingerprint no longer matches what was recorded. */
  stale: boolean;
}

export function resolveSelector(chain: SelectorChain, expectedFingerprint: string): ResolveResult {
  const element = resolveByTier(chain);
  if (!element) return { element: null, stale: false };
  const currentFingerprint = captureFingerprint(element);
  const stale =
    expectedFingerprint.length > 0 &&
    normalizeVolatileText(currentFingerprint) !== normalizeVolatileText(expectedFingerprint);
  return { element, stale };
}

export function performAction(element: Element, action: ActionKind): void {
  if (action === "click" && element instanceof HTMLElement) element.click();
  else if (action === "focus" && element instanceof HTMLElement) element.focus();
  else if (action === "scroll-to") element.scrollIntoView({ behavior: "smooth", block: "center" });
}
