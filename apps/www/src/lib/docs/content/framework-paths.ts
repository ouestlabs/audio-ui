/**
 * The framework addresses of the docs: `/docs/vue/knob` is the page of the
 * knob on the UI SDK, read for Vue. They are the same pages under another
 * address, so the router rewrites them to the page's own address with the
 * framework in a `?framework=` that only the router sees, and back the other way: an address the reader sees never has it. Every page of the docs a framework is shown has one (`/docs/vue/guides/output`), but the sections that are one framework's own, React's primitives (`/docs/primitives`) and the elements: their pages stay where they are.
 */

/** The addresses only a React app uses: React's primitives, the styled catalog, its guides and its API. The registry's landing page and the pages of the primitives it installs are every framework's. */
export const REACT_ADDRESSES = [
  "/components",
  "/docs/api",
  "/docs/components",
  "/docs/devices",
  "/docs/guides",
  "/docs/hooks",
  "/docs/lib",
  "/docs/primitives",
  "/docs/styling",
];

/** The sections of one framework, which have no address per framework: React's primitives and the elements. */
const OWN_SECTIONS = ["/docs/elements", "/docs/primitives"];

export const under = (url: string, prefix: string) =>
  url === prefix || url.startsWith(`${prefix}/`);

/** The address segment of each framework that has addresses of its own, and the framework it stands for. */
export const FRAMEWORK_SEGMENTS = {
  react: "react",
  svelte: "svelte",
  vue: "vue",
  "web-components": "web",
} as const;

type Segment = keyof typeof FRAMEWORK_SEGMENTS;
type Prefixed = (typeof FRAMEWORK_SEGMENTS)[Segment];

/** The primitives, which have a page on the UI SDK at `/docs/<name>-ui-sdk`. */
export const UI_SDK_PRIMITIVES = [
  "envelope",
  "fader",
  "knob",
  "meter",
  "pad",
  "piano",
  "piano-roll",
  "plot",
  "sequencer",
  "timeline",
  "waveform",
  "xypad",
] as const;

const PRIMITIVE_PAGE = new Set<string>(UI_SDK_PRIMITIVES);
const PREFIXED = /^\/docs\/(react|svelte|vue|web-components)(?:\/(.*))?$/;
const TRAILING_SLASH = /\/$/;
const UI_SDK_ADDRESS = /^\/docs\/([a-z-]+)-ui-sdk$/;
const SEGMENT_OF = new Map<string, Segment>(
  Object.entries(FRAMEWORK_SEGMENTS).map(([segment, id]) => [
    id,
    segment as Segment,
  ])
);

/** Whether a page has an address for a framework: the docs' own pages the framework is shown, not the sections that are one framework's. */
function addressable(pathname: string, framework: string): boolean {
  if (
    !(pathname === "/docs" || pathname.startsWith("/docs/")) ||
    PREFIXED.test(pathname)
  ) {
    return false;
  }
  if (OWN_SECTIONS.some((section) => under(pathname, section))) {
    return false;
  }
  return framework === "react"
    ? true
    : !REACT_ADDRESSES.some((prefix) => under(pathname, prefix));
}

/** The page a framework address is, and its framework: `/docs/vue/knob` is `/docs/knob-ui-sdk` for Vue, `/docs/vue/guides/output` is `/docs/guides/output`; `/docs/vue` is the docs' own first page. Null for any other address, and for a page the framework is not shown. */
export function pageOfFrameworkAddress(
  pathname: string
): { framework: Prefixed; pathname: string } | null {
  const match = PREFIXED.exec(pathname);
  if (!match) {
    return null;
  }
  const framework = FRAMEWORK_SEGMENTS[match[1] as Segment];
  const rest = (match[2] ?? "").replace(TRAILING_SLASH, "");
  if (rest === "") {
    return { framework, pathname: "/docs" };
  }
  const page = PRIMITIVE_PAGE.has(rest)
    ? `/docs/${rest}-ui-sdk`
    : `/docs/${rest}`;
  return addressable(page, framework) ? { framework, pathname: page } : null;
}

/** The framework address of a page read for a framework, or null when it has none. */
export function frameworkAddressOf(
  pathname: string,
  framework: string | null
): string | null {
  const segment = framework ? SEGMENT_OF.get(framework) : undefined;
  if (!(segment && framework && addressable(pathname, framework))) {
    return null;
  }
  const name = UI_SDK_ADDRESS.exec(pathname)?.[1];
  if (name && PRIMITIVE_PAGE.has(name)) {
    return `/docs/${segment}/${name}`;
  }
  return `/docs/${segment}${pathname.slice("/docs".length)}`;
}

/** The framework addresses to build: each page of the docs, `pages` being their addresses, for each framework that has addresses and is shown it. */
export function frameworkAddresses(pages: readonly string[]): string[] {
  const addresses = new Set<string>();
  for (const id of Object.values(FRAMEWORK_SEGMENTS)) {
    for (const page of pages) {
      const address = frameworkAddressOf(page, id);
      if (address) {
        addresses.add(address);
      }
    }
  }
  return [...addresses];
}

/**
 * Runs in the head, before the first paint: a page that has an address for the
 * framework the reader kept (`/docs/knob-ui-sdk` for Vue) goes to it, so the
 * page is drawn for their framework from the start. It is `frameworkAddressOf`
 * written for a document with no module, from the same lists. It runs in a function: a `var` at the top of a page would be a property of `window`, and `window.name` turns what it is given into text.
 */
export const FRAMEWORK_REDIRECT_SCRIPT = `
  (function () { try {
    var segments = ${JSON.stringify(
      Object.fromEntries(
        Object.entries(FRAMEWORK_SEGMENTS).map(([segment, id]) => [id, segment])
      )
    )};
    var primitives = ${JSON.stringify(UI_SDK_PRIMITIVES)};
    var reactOnly = ${JSON.stringify(REACT_ADDRESSES)};
    var own = ${JSON.stringify(OWN_SECTIONS)};
    var kept = localStorage['audio-ui-framework'];
    var segment = segments[kept];
    var path = location.pathname.replace(/\\/$/, '');
    var under = function (prefix) { return path === prefix || path.indexOf(prefix + '/') === 0; };
    var to = null;
    if (segment && (path === '/docs' || path.indexOf('/docs/') === 0) && !${PREFIXED.toString()}.test(path) && !own.some(under) && (kept === 'react' || !reactOnly.some(under))) {
      var name = /^\\/docs\\/([a-z-]+)-ui-sdk$/.exec(path);
      to = name && primitives.indexOf(name[1]) >= 0 ? '/docs/' + segment + '/' + name[1]
        : '/docs/' + segment + path.slice(5);
    }
    if (to) location.replace(to + location.search + location.hash);
  } catch (_) {} })();
`;
