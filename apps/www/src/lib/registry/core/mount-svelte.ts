import { type Component, mount, unmount } from "svelte";

/** Runs a Svelte component in an element, and returns what unmounts it. */
export function mountSvelte(element: HTMLElement, component: Component) {
  const app = mount(component, { target: element });
  return () => unmount(app);
}
