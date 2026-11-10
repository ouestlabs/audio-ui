/** happy-dom returns an all-zero rect; a test of pointer geometry pins one. */
export function mockRect(element: Element, rect: Partial<DOMRect>): void {
  element.getBoundingClientRect = () =>
    ({
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      toJSON: () => ({}),
      top: 0,
      width: 0,
      x: 0,
      y: 0,
      ...rect,
    }) as DOMRect;
}

/** A pointer event of the primary button, bubbling, as a mouse sends it. */
export function pointer(
  target: Element,
  type: "pointerdown" | "pointermove" | "pointerup",
  init: PointerEventInit
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      cancelable: true,
      ...init,
    })
  );
}

/** A key pressed on `target`, bubbling and cancelable. */
export function key(
  target: Element,
  name: string,
  init: KeyboardEventInit = {}
) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key: name,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/** What the `input` and `change` events of a control reported, in order. */
export function listen(element: Element) {
  const changes: [number, string][] = [];
  const commits: [number, string][] = [];
  element.addEventListener("input", (event) => {
    const { detail } = event as CustomEvent<{ reason: string; value: number }>;
    changes.push([detail.value, detail.reason]);
  });
  element.addEventListener("change", (event) => {
    const { detail } = event as CustomEvent<{ reason: string; value: number }>;
    commits.push([detail.value, detail.reason]);
  });
  return { changes, commits };
}
