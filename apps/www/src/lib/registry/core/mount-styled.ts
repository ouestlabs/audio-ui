/** The elements another framework draws from their sheet alone, by the folder of their demos. */
const STYLED_DEMO =
  /\/components\/(knob|fader|meter|xypad|envelope|pad|piano)\/(?:vue|svelte|web)\//;

/** The element a demo of another framework draws from its sheet, if it is one. */
export const styledElementOf = (path: string) => STYLED_DEMO.exec(path)?.[1];

const styleOf = () =>
  [...document.body.classList]
    .find((name) => name.startsWith("style-"))
    ?.slice("style-".length) ?? "nova";

/** A skin the element is drawn in: its sheet, and the classes and style of the element it is set on. */
export interface ShadowSkin {
  className: string;
  sheet: string;
  style: string;
}

const stylesheet = (href = "") => {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  return link;
};

/**
 * Mounts a demo in a shadow root that holds the element's sheet for the
 * page's style and nothing of the site's CSS: what a project that copies the
 * element gets. The theme's variables come in by inheritance; the dark class,
 * which a selector cannot see across the root, is copied onto its container.
 * A skin is set on an element inside the container, where `.dark .skin-neu`
 * finds it, with its sheet beside the element's.
 */
export function mountInShadow(
  host: HTMLElement,
  element: string,
  mount: (target: HTMLElement) => () => void,
  skin?: ShadowSkin
) {
  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  const sheet = stylesheet();
  const target = document.createElement("div");
  // A row as wide as the preview, centering what it holds as the React preview's frame does: an element of full width (a piano) keeps it.
  target.style.cssText =
    "display: flex; align-items: center; justify-content: center; width: 100%";
  const follow = () => {
    sheet.href = `/css/${styleOf()}/${element}.css`;
    target.classList.toggle(
      "dark",
      document.documentElement.classList.contains("dark")
    );
  };
  follow();
  const skinSheet = skin ? [stylesheet(skin.sheet)] : [];
  let into = target;
  if (skin) {
    into = document.createElement("div");
    into.className = skin.className;
    into.style.cssText = skin.style;
    target.appendChild(into);
  }
  root.append(sheet, ...skinSheet, target);
  const observer = new MutationObserver(follow);
  observer.observe(document.body, { attributeFilter: ["class"] });
  observer.observe(document.documentElement, { attributeFilter: ["class"] });
  const unmount = mount(into);
  return () => {
    observer.disconnect();
    unmount();
    for (const each of [sheet, ...skinSheet, target]) {
      each.remove();
    }
  };
}
