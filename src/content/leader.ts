import type { Binding } from "../types/binding";
import { showBindingList, hide } from "./overlay";
import { DEFAULT_LEADER_KEY } from "../shared/constants";

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
    showBindingList(bindings);
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
