import type { Binding } from "../types/binding";
import { getHostConfig, onStoreChanged } from "../storage/store";
import { attachLeaderController } from "./leader";
import { attachRecorder } from "./recorder";
import { resolveSelector, performAction } from "./selector";
import { showMessage, hide } from "./overlay";

const FEEDBACK_DISPLAY_MS = 1500;

let bindings: Binding[] = [];

function fireBinding(binding: Binding): void {
  const { element, stale } = resolveSelector(binding.selector, binding.fingerprint);
  if (!element) {
    showMessage(`Warpkey: couldn't find the target for "${binding.key}"`);
    window.setTimeout(hide, FEEDBACK_DISPLAY_MS);
    return;
  }
  if (stale) {
    showMessage(`Warpkey: binding "${binding.key}" looks stale — re-record it?`);
    window.setTimeout(hide, FEEDBACK_DISPLAY_MS);
    return;
  }
  performAction(element, binding.action);
}

async function main(): Promise<void> {
  const config = await getHostConfig(location.hostname);
  bindings = config.bindings;

  onStoreChanged((store) => {
    bindings = store[location.hostname]?.bindings ?? [];
  });

  attachLeaderController({ getBindings: () => bindings, onFire: fireBinding });
  attachRecorder();
}

main();
