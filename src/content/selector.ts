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

/** `testId`/`id` matches are trusted regardless of fingerprint drift; see docs/design.md. */
type Tier = "testId" | "id" | "aria" | "structural";

interface TierMatch {
  element: Element;
  tier: Tier;
}

function resolveByTier(chain: SelectorChain): TierMatch | null {
  if (chain.testId) {
    const matches = tryQueryAll(`[data-testid="${CSS.escape(chain.testId)}"]`);
    if (matches.length === 1) return { element: matches[0]!, tier: "testId" };
  }
  if (chain.id) {
    const el = document.getElementById(chain.id);
    if (el) return { element: el, tier: "id" };
  }
  if (chain.ariaRole && chain.ariaName) {
    const candidates = tryQueryAll(`[role="${CSS.escape(chain.ariaRole)}"], ${chain.ariaRole}`);
    const nameOf = (c: Element) => (c.getAttribute("aria-label") ?? c.textContent ?? "").trim();
    // Prefer an exact-text match so elements that differ only by their volatile digits
    // (e.g. two "Upvote N" buttons) stay disambiguated; normalized matching is a fallback
    // for when the recorded element's own volatile text has since drifted.
    const exactMatches = candidates.filter((c) => nameOf(c) === chain.ariaName);
    if (exactMatches.length === 1) return { element: exactMatches[0]!, tier: "aria" };
    const expectedName = normalizeVolatileText(chain.ariaName);
    const normalizedMatches = candidates.filter((c) => normalizeVolatileText(nameOf(c)) === expectedName);
    if (normalizedMatches.length === 1) return { element: normalizedMatches[0]!, tier: "aria" };
  }
  if (chain.structuralPath) {
    const el = document.querySelector(chain.structuralPath);
    if (el) return { element: el, tier: "structural" };
  }
  return null;
}

export interface ResolveResult {
  element: Element | null;
  /** True when an element resolved but its fingerprint no longer matches what was recorded. */
  stale: boolean;
}

export function resolveSelector(chain: SelectorChain, expectedFingerprint: string): ResolveResult {
  const match = resolveByTier(chain);
  if (!match) return { element: null, stale: false };
  if (match.tier === "testId" || match.tier === "id") return { element: match.element, stale: false };
  const currentFingerprint = captureFingerprint(match.element);
  const stale =
    expectedFingerprint.length > 0 &&
    normalizeVolatileText(currentFingerprint) !== normalizeVolatileText(expectedFingerprint);
  return { element: match.element, stale };
}

export function performAction(element: Element, action: ActionKind): void {
  if (action === "click" && element instanceof HTMLElement) element.click();
  else if (action === "focus" && element instanceof HTMLElement) element.focus();
  else if (action === "scroll-to") element.scrollIntoView({ behavior: "smooth", block: "center" });
}
