import { type Component, createApp } from "vue";

/** Runs a Vue component in an element, and returns what unmounts it. */
export function mountVue(element: HTMLElement, component: Component) {
  const app = createApp(component);
  app.mount(element);
  return () => app.unmount();
}
