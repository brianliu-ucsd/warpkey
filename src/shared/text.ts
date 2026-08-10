/**
 * Digit runs are normalized away so text that legitimately changes as a side
 * effect of interacting with an element (unread counts, cart badges, "N
 * selected") doesn't read as materially different - used both for the
 * selector-drift staleness check and for popup display labels.
 */
export function normalizeVolatileText(text: string): string {
  return text.replace(/\d+/g, "#");
}
