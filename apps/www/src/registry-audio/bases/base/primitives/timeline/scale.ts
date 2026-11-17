/** A point held still through a zoom: a value, and how far from the viewport's start it sits, in px. */
export interface ZoomAnchor {
  offset: number;
  value: number;
}

/** Keeps `zoom` within its bounds; anything that is not a positive number is refused. */
export function clampZoom(
  zoom: number,
  minZoom: number,
  maxZoom: number
): number | null {
  if (!(Number.isFinite(zoom) && zoom > 0)) {
    return null;
  }
  return Math.min(maxZoom, Math.max(minZoom, zoom));
}

/**
 * Where the viewport must scroll so `anchor.value` stays `anchor.offset` px
 * from its start at the new zoom. `origin` is where value 0 sits in the
 * scrolled content, in px: past a column of headers, for instance.
 */
export function anchoredScroll(
  anchor: ZoomAnchor,
  zoom: number,
  origin: number
): number {
  return Math.max(0, origin + anchor.value * zoom - anchor.offset);
}

/** The value under a point `offset` px from the viewport's start. */
export function valueAtOffset(
  offset: number,
  scrollStart: number,
  zoom: number,
  origin: number
): number {
  return (scrollStart + offset - origin) / zoom;
}
