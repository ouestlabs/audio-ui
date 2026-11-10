/**
 * What every element of the package shares: a base class that exists on a
 * server too, registration, the structural styles, and state written as
 * data attributes.
 */

/**
 * `HTMLElement` to extend, or a stand-in where there is none, such as a
 * server rendering the page: importing a module of elements never throws,
 * and nothing is registered until it runs in a browser.
 */
export const ElementBase: typeof HTMLElement =
  typeof HTMLElement === "undefined"
    ? (class {} as unknown as typeof HTMLElement)
    : HTMLElement;

/** Registers each element under its name, once: a second import of the same module keeps the first. Nothing happens on a server. */
export function define(elements: Record<string, CustomElementConstructor>) {
  if (typeof customElements === "undefined") {
    return;
  }
  for (const [name, element] of Object.entries(elements)) {
    if (!customElements.get(name)) {
      customElements.define(name, element);
    }
  }
}

const added = new Set<string>();

/**
 * Adds rules an element needs to work, such as `display: block` on a part
 * that rotates, to one `<style>` in the page's head. They sit in `:where()`,
 * with no specificity, so any rule of the page wins over them. No color,
 * size or spacing: the look is the page's.
 */
export function structure(rules: string) {
  if (typeof document === "undefined" || added.has(rules)) {
    return;
  }
  added.add(rules);
  let style = document.head.querySelector<HTMLStyleElement>(
    "style[data-audio-ui-elements]"
  );
  if (!style) {
    style = document.createElement("style");
    style.dataset.audioUiElements = "";
    document.head.insertBefore(style, document.head.firstChild);
  }
  style.appendChild(document.createTextNode(rules));
}

/** Sets each attribute to its value, and removes the ones whose value is `null`, touching only what changed. */
export function reflect(
  element: Element,
  attributes: Record<string, string | null>
) {
  for (const [name, value] of Object.entries(attributes)) {
    if (value === null) {
      if (element.hasAttribute(name)) {
        element.removeAttribute(name);
      }
    } else if (element.getAttribute(name) !== value) {
      element.setAttribute(name, value);
    }
  }
}

/**
 * Connects a part to the root element it sits in, the closest one around it:
 * at once when the root is already upgraded, or as soon as its element is
 * defined.
 */
export function connectPart<Root extends Element>(
  part: Element,
  tag: string,
  isRoot: (element: Element | null) => element is Root,
  attach: (root: Root) => void
) {
  const found = part.closest(tag);
  if (isRoot(found)) {
    attach(found);
    return;
  }
  if (found && typeof customElements !== "undefined") {
    customElements.whenDefined(tag).then(() => {
      const root = part.closest(tag);
      if (part.isConnected && isRoot(root)) {
        attach(root);
      }
    });
  }
}

/** A JSON attribute, such as a `format` of `Intl.NumberFormat` options, or `undefined` when it is missing or not JSON. */
export function jsonAttribute<T>(
  element: Element,
  name: string
): T | undefined {
  const text = element.getAttribute(name);
  if (!text) {
    return;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    // Not JSON: as if it were missing.
  }
}

const LIST_SEPARATOR = /[\s,]+/;

/** A list attribute: values separated by spaces or commas, none when it is missing. */
export function listAttribute(element: Element, name: string): string[] {
  return (element.getAttribute(name) ?? "")
    .split(LIST_SEPARATOR)
    .filter(Boolean);
}

/** A number attribute, or `undefined` when it is missing or not a number. */
export function numberAttribute(
  element: Element,
  name: string
): number | undefined {
  const text = element.getAttribute(name);
  if (text === null || text.trim() === "") {
    return;
  }
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}

/** Keeps an element in the accessibility tree and focusable, but out of sight. */
export function hideVisually(element: HTMLElement) {
  Object.assign(element.style, {
    border: "0",
    clipPath: "inset(50%)",
    height: "1px",
    margin: "-1px",
    overflow: "hidden",
    padding: "0",
    position: "absolute",
    whiteSpace: "nowrap",
    width: "1px",
  });
}

let nextId = 0;

/** An id for an element that has none, unique in the page. */
export function ensureId(element: Element, prefix: string): string {
  if (!element.id) {
    nextId += 1;
    element.id = `${prefix}-${nextId}`;
  }
  return element.id;
}

/** The language numbers are formatted in: the element's `locale`, else the browser's, else the runtime's. */
export function localeOf(element: Element): string | undefined {
  const requested =
    element.getAttribute("locale") ??
    (typeof navigator === "undefined" ? undefined : navigator.language);
  if (!requested) {
    return;
  }
  try {
    Intl.getCanonicalLocales(requested);
    return requested;
  } catch {
    // Some platforms report a POSIX locale, which Intl refuses.
  }
}
