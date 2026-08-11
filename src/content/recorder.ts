import type { ActionKind, Binding } from "../types/binding";
import { addBinding } from "../storage/store";
import { buildSelectorChain, captureFingerprint } from "./selector";
import { showMessage, hide } from "./overlay";
import { ARM_RECORD_MESSAGE } from "./messages";
import { quoteLiveLabel } from "../shared/text";
import { RECORD_KEY } from "../shared/constants";

const KEY_CAPTURE_TIMEOUT_MS = 10_000;
const CONFIRMATION_DISPLAY_MS = 1800;

export interface RecorderOptions {
  /** Current host's bindings, read live so a key that was just freed up (or just taken) is reflected immediately. */
  getBindings: () => Binding[];
}

export interface Recorder {
  /** Arms recording mode: the next click is the target, the next keypress after that is the binding's key. */
  armRecording: () => void;
}

function nearestInteractiveAncestor(el: Element): Element {
  return el.closest("button, a, [role], input, select, textarea, summary") ?? el;
}

function inferAction(el: Element): ActionKind {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
    ? "focus"
    : "click";
}

/** Short description of what a binding already does, for the "already bound" rejection message - not the full live-resolved display label used elsewhere, just enough to disambiguate. */
function describeBinding(binding: Binding): string {
  if (binding.name) return `"${binding.name}"`;
  if (binding.fingerprint) return quoteLiveLabel(binding.fingerprint);
  return binding.action;
}

/** Wires up recording mode: arm via a runtime message or the leader+r chord, capture the next click as the target, then the next keypress as the binding's key. */
export function attachRecorder(options: RecorderOptions): Recorder {
  let recording = false;

  function arm(): void {
    recording = true;
    showMessage("Warpkey: click the thing you want to bind… (Esc to cancel)");
  }

  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message?.type === ARM_RECORD_MESSAGE) arm();
  });

  // Cancels while waiting for the target click. Once a click is captured,
  // `recording` flips false and key-capture below runs its own Escape handling.
  document.addEventListener(
    "keydown",
    (event) => {
      if (!recording || event.key !== "Escape") return;
      recording = false;
      event.preventDefault();
      event.stopPropagation();
      hide();
    },
    { capture: true },
  );

  document.addEventListener(
    "click",
    (event) => {
      if (!recording) return;
      recording = false;
      // Suppress the click entirely - both its default action (link
      // navigation, form submission) and delivery to the page's own
      // handlers - so recording a binding never actually performs it.
      event.preventDefault();
      event.stopPropagation();
      const target = nearestInteractiveAncestor(event.target as Element);
      const selector = buildSelectorChain(target);
      const fingerprint = captureFingerprint(target);
      const action = inferAction(target);
      showMessage("Warpkey: now press the key to bind (Esc to cancel)…");
      captureKey(selector, fingerprint, action, options.getBindings);
    },
    { capture: true },
  );

  return { armRecording: arm };
}

function captureKey(
  selector: Binding["selector"],
  fingerprint: string,
  action: ActionKind,
  getBindings: () => Binding[],
): void {
  let timeoutId = window.setTimeout(giveUp, KEY_CAPTURE_TIMEOUT_MS);

  function giveUp(): void {
    window.removeEventListener("keydown", handler, { capture: true });
    hide();
  }

  async function handler(event: KeyboardEvent): Promise<void> {
    if (event.key === "Escape") {
      window.clearTimeout(timeoutId);
      window.removeEventListener("keydown", handler, { capture: true });
      hide();
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    if (event.key.toLowerCase() === RECORD_KEY) {
      // Keep listening rather than tearing down - let the user pick a different key.
      showMessage(
        `Warpkey: "${event.key}" is reserved for the built-in leader+r shortcut - press another key (Esc to cancel)…`,
      );
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(giveUp, KEY_CAPTURE_TIMEOUT_MS);
      return;
    }

    // Scope isn't decided yet (a fresh binding always starts unscoped, matching
    // every path, until the popup's chips narrow it - see "Binding target" in
    // docs/design.md), so a same-key collision is checked host-wide rather than
    // against the current path alone.
    const duplicate = getBindings().find((b) => b.key.toLowerCase() === event.key.toLowerCase());
    if (duplicate) {
      showMessage(
        `Warpkey: "${event.key}" is already bound to ${describeBinding(duplicate)} - press another key (Esc to cancel)…`,
      );
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(giveUp, KEY_CAPTURE_TIMEOUT_MS);
      return;
    }

    window.clearTimeout(timeoutId);
    window.removeEventListener("keydown", handler, { capture: true });

    const binding: Binding = {
      id: crypto.randomUUID(),
      key: event.key,
      selector,
      fingerprint,
      action,
      recordedPath: location.pathname,
      createdAt: Date.now(),
    };
    await addBinding(location.hostname, binding);
    const target = fingerprint ? ` to ${quoteLiveLabel(fingerprint)}` : "";
    showMessage(`Warpkey: bound "${event.key}"${target}`);
    window.setTimeout(hide, CONFIRMATION_DISPLAY_MS);
  }

  window.addEventListener("keydown", handler, { capture: true });
}
