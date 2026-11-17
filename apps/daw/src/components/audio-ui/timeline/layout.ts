export const UNIT_PROPERTY = "--timeline-unit";
/** Set on every placed part: where it sits, in units. */
export const OFFSET_PROPERTY = "--timeline-offset";
/** Set on every part that spans a stretch of the lane: how long it is, in units. */
export const LENGTH_PROPERTY = "--timeline-length";

/** The width of one unit: px when zoomed, a share of the lane when fitted. */
export const unitLength = (zoom: number | null, duration: number) =>
  zoom === null ? `calc(100% / ${duration > 0 ? duration : 1})` : `${zoom}px`;

/** Sets a lane's unit and width from the zoom, on the element itself. */
export function paintScale(
  el: HTMLElement,
  zoom: number | null,
  duration: number
) {
  el.style.setProperty(UNIT_PROPERTY, unitLength(zoom, duration));
  el.style.minWidth = zoom === null ? "" : `${duration * zoom}px`;
}

/** Places a part at its `--timeline-offset` along the lane. */
export const placedAt = (value: number) => ({
  [OFFSET_PROPERTY]: String(value),
  left: `calc(var(${UNIT_PROPERTY}) * var(${OFFSET_PROPERTY}))`,
  position: "absolute",
});

/** Places a part from `start` along the lane, `length` units long. */
export const placedOver = (start: number, length: number) => ({
  ...placedAt(start),
  [LENGTH_PROPERTY]: String(length),
  width: `calc(var(${UNIT_PROPERTY}) * var(${LENGTH_PROPERTY}))`,
});

/** The lane an element sits in. */
export const laneOf = (el: Element | null) =>
  el?.closest<HTMLElement>("[data-timeline-lane]") ?? null;