/**
 * Digit runs, and any parenthetical count wrapping one (" (814)"), are
 * stripped entirely rather than just replaced, so a count badge that's
 * fully absent at zero normalizes the same as one with a nonzero value -
 * used only for the selector-drift staleness check in
 * src/content/selector.ts, not display. See docs/design.md.
 */
export function normalizeVolatileText(text: string): string {
  return text
    .replace(/\(\s*\d[\d,.]*\s*\)/g, "")
    .replace(/\s*\d[\d,.]*(?:[kKmM]\b)?\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
