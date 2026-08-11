import type { Binding } from "../types/binding";
import {
  getHostConfig,
  onStoreChanged,
  removeBinding,
  updateBinding,
  getLeaderKey,
  setLeaderKey,
  onLeaderKeyChanged,
} from "../storage/store";
import { ARM_RECORD_MESSAGE, RESOLVE_LABELS_MESSAGE } from "../content/messages";
import { resolveDisplayLabel } from "../shared/labels";

const hostEl = document.querySelector<HTMLParagraphElement>("#host")!;
const listEl = document.querySelector<HTMLUListElement>("#bindings")!;
const recordBtn = document.querySelector<HTMLButtonElement>("#record")!;
const leaderKeyEl = document.querySelector<HTMLElement>("#leader-key")!;
const leaderHintEl = document.querySelector<HTMLElement>("#leader-hint")!;
const globalLeaderKeyEls = document.querySelectorAll<HTMLElement>(".g-leader");

/** Current on-page text per binding id, fetched from the content script. Empty until a matching tab responds. */
let liveLabels: Record<string, string> = {};

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function fetchLiveLabels(tabId: number): Promise<Record<string, string>> {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: RESOLVE_LABELS_MESSAGE });
    return (response as Record<string, string> | undefined) ?? {};
  } catch {
    // No content script on this tab (e.g. a chrome:// page) or it hasn't finished loading yet.
    return {};
  }
}

function renderLeaderKey(key: string): void {
  leaderKeyEl.textContent = key;
  for (const el of globalLeaderKeyEls) el.textContent = key;
}

function startLeaderKeyCapture(): void {
  leaderHintEl.textContent = "press a key…";
  const handler = async (event: KeyboardEvent) => {
    event.preventDefault();
    window.removeEventListener("keydown", handler, true);
    leaderHintEl.textContent = "";
    if (event.key === "Escape") return;
    await setLeaderKey(event.key);
    renderLeaderKey(event.key);
  };
  window.addEventListener("keydown", handler, true);
}

function hostnameFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

interface ScopeSegment {
  /** Display label, e.g. "analytics". */
  label: string;
  /** Cumulative path prefix through this segment, e.g. "/analytics". */
  prefix: string;
}

function scopeSegments(recordedPath: string): ScopeSegment[] {
  const segments = recordedPath.split("/").filter(Boolean);
  const result: ScopeSegment[] = [];
  let prefix = "";
  for (const label of segments) {
    prefix += `/${label}`;
    result.push({ label, prefix });
  }
  return result;
}

function renderScopeRow(hostname: string, binding: Binding): HTMLElement {
  const row = document.createElement("div");
  row.className = "scope-row";

  const caption = document.createElement("span");
  caption.className = "scope-caption";
  caption.textContent = "scope:";
  row.appendChild(caption);

  function addChip(label: string, prefix: string | undefined): void {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.type = "button";
    chip.textContent = label;
    chip.title = prefix ? `Only fire when the path starts with "${prefix}"` : "Fire on every path for this site";
    if ((binding.pathPrefix ?? undefined) === prefix) chip.classList.add("active");
    chip.addEventListener("click", async () => {
      await updateBinding(hostname, binding.id, { pathPrefix: prefix });
    });
    row.appendChild(chip);
  }

  addChip("any path", undefined);
  for (const segment of scopeSegments(binding.recordedPath)) {
    addChip(segment.label, segment.prefix);
  }

  return row;
}

/** Bindings from the most recent render, kept so renaming can redraw without a fresh storage read. */
let lastHostname = "";
let lastBindings: Binding[] = [];

function startRename(binding: Binding, label: HTMLElement): void {
  const input = document.createElement("input");
  input.type = "text";
  input.className = "rename-input";
  input.value = binding.name ?? "";
  input.placeholder = "rename…";
  label.replaceWith(input);
  input.focus();
  input.select();

  let done = false;
  function finish(save: boolean): void {
    if (done) return;
    done = true;
    input.removeEventListener("keydown", onKeydown);
    input.removeEventListener("blur", onBlur);
    if (save) {
      const value = input.value.trim();
      void updateBinding(lastHostname, binding.id, { name: value || undefined });
    } else {
      renderBindings(lastHostname, lastBindings);
    }
  }
  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") finish(true);
    else if (event.key === "Escape") finish(false);
  }
  function onBlur(): void {
    finish(true);
  }
  input.addEventListener("keydown", onKeydown);
  input.addEventListener("blur", onBlur);
}

function renderBindings(hostname: string, bindings: Binding[]): void {
  lastHostname = hostname;
  lastBindings = bindings;
  listEl.innerHTML = "";
  if (bindings.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No bindings yet on this site.";
    listEl.appendChild(empty);
    return;
  }
  for (const binding of bindings) {
    const li = document.createElement("li");

    const mainRow = document.createElement("div");
    mainRow.className = "main-row";
    const label = document.createElement("span");
    const pageText = liveLabels[binding.id] ?? binding.fingerprint;
    const { text, quoted } = resolveDisplayLabel(binding, pageText);
    label.className = quoted ? "label quoted" : "label";
    label.textContent = text;
    label.title = binding.name
      ? "Custom name - click to rename"
      : pageText
        ? "Current on-page text of the bound element - click to give it a custom name"
        : `Warpkey action: ${binding.action} - click to give it a custom name`;
    label.addEventListener("click", () => startRename(binding, label));
    const kbd = document.createElement("kbd");
    kbd.textContent = binding.key;
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "✕";
    remove.addEventListener("click", async () => {
      await removeBinding(hostname, binding.id);
    });
    mainRow.append(kbd, label, remove);

    li.append(mainRow, renderScopeRow(hostname, binding));
    listEl.appendChild(li);
  }
}

async function init(): Promise<void> {
  renderLeaderKey(await getLeaderKey());
  onLeaderKeyChanged(renderLeaderKey);
  leaderKeyEl.addEventListener("click", startLeaderKeyCapture);

  const tab = await getActiveTab();
  const hostname = hostnameFromUrl(tab?.url);
  if (!hostname) {
    hostEl.textContent = "Not on a regular page";
    recordBtn.disabled = true;
    return;
  }
  hostEl.textContent = hostname;
  const config = await getHostConfig(hostname);
  if (tab?.id) liveLabels = await fetchLiveLabels(tab.id);
  renderBindings(hostname, config.bindings);

  onStoreChanged((store) => {
    renderBindings(hostname, store[hostname]?.bindings ?? []);
  });

  recordBtn.addEventListener("click", async () => {
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, { type: ARM_RECORD_MESSAGE });
    // Close immediately rather than waiting for the user to click away: an
    // outside click dismisses the popup without also reaching the page, so
    // the "next click" the content script needs would otherwise be swallowed.
    window.close();
  });
}

init();
