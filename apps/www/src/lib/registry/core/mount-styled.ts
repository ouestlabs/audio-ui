/** The elements another framework draws from their sheet alone, by the folder of their demos. */
const STYLED_DEMO = /\/components\/(knob|fader|meter)\/(?:vue|svelte|web)\//;

/** The element a demo of another framework draws from its sheet, if it is one. */
export const styledElementOf = (path: string) => STYLED_DEMO.exec(path)?.[1];

const styleOf = () =>
  [...document.body.classList]
    .find((name) => name.startsWith("style-"))
    ?.slice("style-".length) ?? "nova";

/**
 * Mounts a demo in a shadow root that holds the element's sheet for the
 * page's style and nothing of the site's CSS: what a project that copies the
 * element gets. The theme's variables come in by inheritance; the dark class,
 * which a selector cannot see across the root, is copied onto its container.
 */
export function mountInShadow(
  host: HTMLElement,
  element: string,
  mount: (target: HTMLElement) => () => void
) {
  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  const sheet = document.createElement("link");
  sheet.rel = "stylesheet";
  const target = document.createElement("div");
  const follow = () => {
    sheet.href = `/css/${styleOf()}/${element}.css`;
    target.classList.toggle(
      "dark",
      document.documentElement.classList.contains("dark")
    );
  };
  follow();
  root.append(sheet, target);
  const observer = new MutationObserver(follow);
  observer.observe(document.body, { attributeFilter: ["class"] });
  observer.observe(document.documentElement, { attributeFilter: ["class"] });
  const unmount = mount(target);
  return () => {
    observer.disconnect();
    unmount();
    sheet.remove();
    target.remove();
  };
}
