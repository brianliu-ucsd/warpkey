/**
 * Digit runs are normalized away so text that legitimately changes as a side
 * effect of interacting with an element (unread counts, cart badges, "N
 * selected") doesn't read as materially different - used only for the
 * selector-drift staleness check in src/content/selector.ts, not display.
 */
export function normalizeVolatileText(text: string): string {
  return text.replace(/\d+/g, "#");
}

/**
 * Marks a display label as literal on-page text (live-resolved or a stored
 * fingerprint), not a value Warpkey itself computed. A bound element's text
 * can be anything - a counter, a status word, a price - and without this cue
 * it can read as a Warpkey-native stat (e.g. a per-binding usage count) when
 * it's really just whatever the page happens to say right now.
 */
export function quoteLiveLabel(text: string): string {
  return `“${text}”`;
}
