import type { Binding } from "../types/binding";
import { showBindingList, hide } from "./overlay";
import { resolveSelector, captureFingerprint } from "./selector";
import { DEFAULT_LEADER_KEY } from "../shared/constants";
import { quoteLiveLabel } from "../shared/text";

const CHORD_TIMEOUT_MS = 1500;

export interface LeaderControllerOptions {
  getBindings: () => Binding[];
  onFire: (binding: Binding) => void;
  initialLeaderKey: string;
}

export interface LeaderController {
  setLeaderKey: (key: string) => void;
  detach: () => void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function matchesPath(binding: Binding, pathname: string): boolean {
  return !binding.pathPrefix || pathname.startsWith(binding.pathPrefix);
}

/**
 * Reads the target's current on-page text rather than the fingerprint frozen
 * at record time. Quoted (via quoteLiveLabel) whenever it's real page text,
 * so it can't be mistaken for a value Warpkey computed itself; the bare
 * action name is the only unquoted fallback, used when no page text is
 * available at all.
 */
function liveLabel(binding: Binding): string {
  const { element } = resolveSelector(binding.selector, binding.fingerprint);
  if (element) {
    const text = captureFingerprint(element);
    if (text) return quoteLiveLabel(text);
  }
  if (binding.fingerprint) return quoteLiveLabel(binding.fingerprint);
  return binding.action;
}

/** Attaches the leader-key chord listener to the page. */
export function attachLeaderController(options: LeaderControllerOptions): LeaderController {
  let leaderKey = options.initialLeaderKey || DEFAULT_LEADER_KEY;
  let armed = false;
  let timeoutId: number | undefined;

  function scopedBindings(): Binding[] {
    return options.getBindings().filter((b) => matchesPath(b, location.pathname));
  }

  function disarm(): void {
    armed = false;
    window.clearTimeout(timeoutId);
    hide();
  }

  function arm(): void {
    const bindings = scopedBindings();
    if (bindings.length === 0) return;
    armed = true;
    // Rendering (including live selector resolution) is best-effort: a failure here
    // must not leave `armed` stuck true with no timeout scheduled to clear it.
    try {
      showBindingList(bindings.map((b) => ({ key: b.key, label: liveLabel(b) })));
    } catch (error) {
      console.error("Warpkey: failed to render the which-key overlay", error);
    }
    timeoutId = window.setTimeout(disarm, CHORD_TIMEOUT_MS);
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (armed) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === "Escape") {
        disarm();
        return;
      }
      const match = scopedBindings().find((b) => b.key.toLowerCase() === event.key.toLowerCase());
      disarm();
      if (match) options.onFire(match);
      return;
    }

    const isPlainKey = !event.metaKey && !event.ctrlKey && !event.altKey;
    if (event.key === leaderKey && isPlainKey && !isEditableTarget(event.target)) {
      event.preventDefault();
      arm();
    }
  }

  window.addEventListener("keydown", handleKeydown, { capture: true });

  return {
    setLeaderKey: (key: string) => {
      leaderKey = key;
    },
    detach: () => window.removeEventListener("keydown", handleKeydown, { capture: true }),
  };
}
