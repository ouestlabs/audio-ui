/**
 * Calls `onChange` when `element` enters or leaves the viewport, so a painter
 * can skip frames nobody sees. Returns a function that stops observing.
 */
export function observeVisibility(
  element: Element,
  onChange: (visible: boolean) => void
): () => void {
  if (typeof IntersectionObserver === "undefined") {
    return () => undefined;
  }
  const observer = new IntersectionObserver((entries) => {
    const entry = entries.at(-1);
    if (entry) {
      onChange(entry.isIntersecting);
    }
  });
  observer.observe(element);
  return () => observer.disconnect();
}
