const HOST_ID = "warpkey-overlay-host";

export interface OverlayEntry {
  key: string;
  label: string;
  /** True when `label` is quoted on-page text, styled distinctly from a user-given name or the bare action. */
  quoted?: boolean;
}

function getHost(): HTMLElement {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement("div");
    host.id = HOST_ID;
    document.documentElement.appendChild(host);
  }
  return host;
}

function getPanel(): HTMLElement {
  const host = getHost();
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  let panel = shadow.querySelector<HTMLElement>(".panel");
  if (!panel) {
    const style = document.createElement("style");
    style.textContent = `
      .panel {
        position: fixed;
        bottom: 16px;
        right: 16px;
        background: #1a1a1a;
        color: #f2f2f2;
        font: 12px ui-monospace, monospace;
        border-radius: 8px;
        padding: 8px 10px;
        z-index: 2147483647;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
        max-width: 260px;
        display: none;
      }
      .row { display: flex; gap: 8px; padding: 2px 0; }
      kbd { background: #333; border-radius: 3px; padding: 0 4px; color: #ffc846; }
      .label { color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .label.quoted { font-style: italic; }
      .message { color: #f2f2f2; }
    `;
    panel = document.createElement("div");
    panel.className = "panel";
    shadow.append(style, panel);
  }
  return panel;
}

export function showBindingList(entries: OverlayEntry[]): void {
  const panel = getPanel();
  panel.innerHTML = "";
  for (const entry of entries) {
    const row = document.createElement("div");
    row.className = "row";
    const kbd = document.createElement("kbd");
    kbd.textContent = entry.key;
    const label = document.createElement("span");
    label.className = entry.quoted ? "label quoted" : "label";
    label.textContent = entry.label;
    label.title = entry.label;
    row.append(kbd, label);
    panel.appendChild(row);
  }
  panel.style.display = "block";
}

export function showMessage(text: string): void {
  const panel = getPanel();
  panel.innerHTML = "";
  const row = document.createElement("div");
  row.className = "message";
  row.textContent = text;
  panel.appendChild(row);
  panel.style.display = "block";
}

export function hide(): void {
  const host = document.getElementById(HOST_ID);
  const panel = host?.shadowRoot?.querySelector<HTMLElement>(".panel");
  if (panel) panel.style.display = "none";
}
