import type { Binding } from "../types/binding";
import { getHostConfig, onStoreChanged, removeBinding } from "../storage/store";
import { ARM_RECORD_MESSAGE } from "../content/messages";

const hostEl = document.querySelector<HTMLParagraphElement>("#host")!;
const listEl = document.querySelector<HTMLUListElement>("#bindings")!;
const recordBtn = document.querySelector<HTMLButtonElement>("#record")!;

async function getActiveTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function hostnameFromUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

function renderBindings(hostname: string, bindings: Binding[]): void {
  listEl.innerHTML = "";
  if (bindings.length === 0) {
    const empty = document.createElement("li");
    empty.textContent = "No bindings yet on this site.";
    listEl.appendChild(empty);
    return;
  }
  for (const binding of bindings) {
    const li = document.createElement("li");
    const label = document.createElement("span");
    label.textContent = binding.fingerprint || binding.action;
    const kbd = document.createElement("kbd");
    kbd.textContent = `\` ${binding.key}`;
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.textContent = "✕";
    remove.addEventListener("click", async () => {
      await removeBinding(hostname, binding.id);
      renderBindings(hostname, bindings.filter((b) => b.id !== binding.id));
    });
    li.append(kbd, label, remove);
    listEl.appendChild(li);
  }
}

async function init(): Promise<void> {
  const tab = await getActiveTab();
  const hostname = hostnameFromUrl(tab?.url);
  if (!hostname) {
    hostEl.textContent = "Not on a regular page";
    recordBtn.disabled = true;
    return;
  }
  hostEl.textContent = hostname;
  const config = await getHostConfig(hostname);
  renderBindings(hostname, config.bindings);

  onStoreChanged((store) => {
    renderBindings(hostname, store[hostname]?.bindings ?? []);
  });

  recordBtn.addEventListener("click", async () => {
    if (!tab?.id) return;
    await chrome.tabs.sendMessage(tab.id, { type: ARM_RECORD_MESSAGE });
    recordBtn.classList.add("armed");
    recordBtn.textContent = "Go click something on the page…";
  });
}

init();
