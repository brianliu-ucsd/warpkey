export type ActionKind = "click" | "focus" | "scroll-to";

export interface SelectorChain {
  testId?: string;
  id?: string;
  ariaRole?: string;
  ariaName?: string;
  structuralPath: string;
}

export interface Binding {
  /** Stable id, independent of key so rebinding a key doesn't lose history. */
  id: string;
  key: string;
  selector: SelectorChain;
  /** Visible text / accessible name captured at record time, used to detect selector drift. */
  fingerprint: string;
  action: ActionKind;
  /** location.pathname at record time, e.g. "/analytics/abcdef". Offered in the popup as truncatable scope segments. */
  recordedPath: string;
  /** Optional path restriction, e.g. "/settings". Binding only fires when the current path starts with this. Unset = fires on every path for the hostname. */
  pathPrefix?: string;
  createdAt: number;
}

export interface HostConfig {
  hostname: string;
  bindings: Binding[];
}

export type WarpkeyStore = Record<string, HostConfig>;
