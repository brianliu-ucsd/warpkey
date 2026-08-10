import type { Binding, HostConfig, WarpkeyStore } from "../types/binding";

const STORAGE_KEY = "warpkey:hosts";

async function readAll(): Promise<WarpkeyStore> {
  const result = await chrome.storage.sync.get(STORAGE_KEY);
  return (result[STORAGE_KEY] as WarpkeyStore | undefined) ?? {};
}

async function writeAll(store: WarpkeyStore): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: store });
}

export async function getHostConfig(hostname: string): Promise<HostConfig> {
  const store = await readAll();
  return store[hostname] ?? { hostname, bindings: [] };
}

export async function addBinding(hostname: string, binding: Binding): Promise<void> {
  const store = await readAll();
  const existing = store[hostname] ?? { hostname, bindings: [] };
  store[hostname] = { ...existing, bindings: [...existing.bindings, binding] };
  await writeAll(store);
}

export async function updateBinding(
  hostname: string,
  bindingId: string,
  patch: Partial<Binding>,
): Promise<void> {
  const store = await readAll();
  const existing = store[hostname];
  if (!existing) return;
  store[hostname] = {
    ...existing,
    bindings: existing.bindings.map((b) => (b.id === bindingId ? { ...b, ...patch } : b)),
  };
  await writeAll(store);
}

export async function removeBinding(hostname: string, bindingId: string): Promise<void> {
  const store = await readAll();
  const existing = store[hostname];
  if (!existing) return;
  store[hostname] = {
    ...existing,
    bindings: existing.bindings.filter((b) => b.id !== bindingId),
  };
  await writeAll(store);
}

export function onStoreChanged(callback: (store: WarpkeyStore) => void): void {
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "sync") return;
    const change = changes[STORAGE_KEY];
    if (change) callback((change.newValue as WarpkeyStore | undefined) ?? {});
  });
}
