import type { Binding } from "../types/binding";
import { quoteLiveLabel } from "./text";

export interface DisplayLabel {
  text: string;
  /** True when `text` is quoted on-page text rather than a user-given name or the bare action. */
  quoted: boolean;
}

/**
 * Shared by the popup and the on-page overlay so a binding displays
 * identically in both places: a user-given name wins if set, otherwise
 * quoted on-page text (live-resolved or the stored fingerprint), otherwise
 * the bare action name as a last resort.
 */
export function resolveDisplayLabel(binding: Binding, pageText: string | undefined): DisplayLabel {
  if (binding.name) return { text: binding.name, quoted: false };
  if (pageText) return { text: quoteLiveLabel(pageText), quoted: true };
  return { text: binding.action, quoted: false };
}
