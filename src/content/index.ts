import type { Binding } from "../types/binding";
import { getHostConfig, onStoreChanged, getLeaderKey, onLeaderKeyChanged } from "../storage/store";
import { attachLeaderController } from "./leader";
import { attachRecorder } from "./recorder";
import { resolveSelector, performAction, captureFingerprint } from "./selector";
import { showMessage, hide } from "./overlay";
import { RESOLVE_LABELS_MESSAGE } from "./messages";

const FEEDBACK_DISPLAY_MS = 1500;

let bindings: Binding[] = [];

/** Lets the popup show each binding's current on-page text instead of a frozen record-time snapshot. */
chrome.runtime.onMessage.addListener((message: { type?: string }, _sender, sendResponse) => {
  if (message?.type !== RESOLVE_LABELS_MESSAGE) return;
  const labels: Record<string, string> = {};
  for (const binding of bindings) {
    const { element } = resolveSelector(binding.selector, binding.fingerprint);
    if (element) {
      const text = captureFingerprint(element);
      if (text) labels[binding.id] = text;
    }
  }
  sendResponse(labels);
});

function fireBinding(binding: Binding): void {
  const { element, stale } = resolveSelector(binding.selector, binding.fingerprint);
  if (!element) {
    showMessage(`Warpkey: couldn't find the target for "${binding.key}"`);
    window.setTimeout(hide, FEEDBACK_DISPLAY_MS);
    return;
  }
  if (stale) {
    showMessage(`Warpkey: binding "${binding.key}" looks stale - re-record it?`);
    window.setTimeout(hide, FEEDBACK_DISPLAY_MS);
    return;
  }
  performAction(element, binding.action);
}

async function main(): Promise<void> {
  const [config, leaderKey] = await Promise.all([getHostConfig(location.hostname), getLeaderKey()]);
  bindings = config.bindings;

  onStoreChanged((store) => {
    bindings = store[location.hostname]?.bindings ?? [];
  });

  const controller = attachLeaderController({
    getBindings: () => bindings,
    onFire: fireBinding,
    initialLeaderKey: leaderKey,
  });
  onLeaderKeyChanged((key) => controller.setLeaderKey(key));

  attachRecorder();
}

main();
