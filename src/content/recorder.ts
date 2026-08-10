import type { ActionKind, Binding } from "../types/binding";
import { addBinding } from "../storage/store";
import { buildSelectorChain, captureFingerprint } from "./selector";
import { showMessage, hide } from "./overlay";
import { ARM_RECORD_MESSAGE } from "./messages";
import { quoteLiveLabel } from "../shared/text";

const KEY_CAPTURE_TIMEOUT_MS = 10_000;
const CONFIRMATION_DISPLAY_MS = 1800;

function nearestInteractiveAncestor(el: Element): Element {
  return el.closest("button, a, [role], input, select, textarea, summary") ?? el;
}

function inferAction(el: Element): ActionKind {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement
    ? "focus"
    : "click";
}

/** Wires up recording mode: arm via a runtime message, capture the next click as the target, then the next keypress as the binding's key. */
export function attachRecorder(): void {
  let recording = false;

  chrome.runtime.onMessage.addListener((message: { type?: string }) => {
    if (message?.type === ARM_RECORD_MESSAGE) {
      recording = true;
      showMessage("Warpkey: click the thing you want to bind…");
    }
  });

  document.addEventListener(
    "click",
    (event) => {
      if (!recording) return;
      recording = false;
      const target = nearestInteractiveAncestor(event.target as Element);
      const selector = buildSelectorChain(target);
      const fingerprint = captureFingerprint(target);
      const action = inferAction(target);
      showMessage("Warpkey: now press the key to bind (Esc to cancel)…");
      captureKey(selector, fingerprint, action);
    },
    { capture: true },
  );
}

function captureKey(
  selector: Binding["selector"],
  fingerprint: string,
  action: ActionKind,
): void {
  const timeoutId = window.setTimeout(() => {
    window.removeEventListener("keydown", handler, { capture: true });
    hide();
  }, KEY_CAPTURE_TIMEOUT_MS);

  async function handler(event: KeyboardEvent): Promise<void> {
    window.clearTimeout(timeoutId);
    window.removeEventListener("keydown", handler, { capture: true });

    if (event.key === "Escape") {
      hide();
      return;
    }
    event.preventDefault();
    event.stopPropagation();

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
