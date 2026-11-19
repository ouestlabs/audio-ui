/**
 * The framework addresses of the docs: `/docs/vue/components/base/knob` is the
 * page of the knob, read for Vue. They are the same pages under another
 * address, so the router rewrites them to the page's own address with the
 * framework in a `?framework=` that only the router sees, and back the other way: an address the reader sees never has it. Every page of the docs a framework is shown has one (`/docs/vue/guides/output`).
 */

/**
 * The libraries that need React, by what they import or install: the others
 * are plain TypeScript, shown to every framework. `test/react-libs.test.ts`
 * keeps the list in step with the registry.
 */
export const REACT_LIBS = ["arrangement-engine", "clip-edits", "dawproject"];

/** The addresses only a React app uses: the styled catalog, its guides, its hooks, the libraries that need React and its API. The pages of the primitives it installs (`PRIMITIVE_PAGES`) are every framework's. */
export const REACT_ADDRESSES = [
  "/docs/api",
  "/docs/components",
  "/docs/devices",
  "/docs/guides",
  "/docs/hooks",
  ...REACT_LIBS.map((name) => `/docs/lib/${name}`),
  "/docs/styling",
];

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

/** The pages of the primitives, by name: every framework reads them, for the headless primitive each installs, where the rest of `/docs/components` is the styled catalog of React. */
export const PRIMITIVE_PAGES = {
  envelope: "/docs/components/base/envelope",
  fader: "/docs/components/base/fader",
  knob: "/docs/components/base/knob",
  meter: "/docs/components/base/meter",
  pad: "/docs/components/base/pad",
  piano: "/docs/components/base/piano",
  "piano-roll": "/docs/components/base/piano-roll",
  plot: "/docs/components/base/plot",
  sequencer: "/docs/components/base/sequencer",
  timeline: "/docs/components/base/arrangement",
  waveform: "/docs/components/base/waveform",
  xypad: "/docs/components/base/xypad",
} as const;

/** The list of every component, which a framework reads with only its primitives in it. */
export const COMPONENTS_INDEX = "/docs/components";

/** The pages of the React-only catalog every framework reads anyway: the primitives' pages and the list of components. */
export const EVERY_FRAMEWORK_PATHS: readonly string[] = [
  ...Object.values(PRIMITIVE_PAGES),
  COMPONENTS_INDEX,
];

const PRIMITIVE_PATHS = EVERY_FRAMEWORK_PATHS;

const PREFIXED = /^\/docs\/(react|svelte|vue|web-components)(?:\/(.*))?$/;
const TRAILING_SLASH = /\/$/;
const SEGMENT_OF = new Map<string, Segment>(
  Object.entries(FRAMEWORK_SEGMENTS).map(([segment, id]) => [
    id,
    segment as Segment,
  ])
);

/** Whether a page has an address for a framework: the docs' pages it is shown. */
function addressable(pathname: string, framework: string): boolean {
  if (
    !(pathname === "/docs" || pathname.startsWith("/docs/")) ||
    PREFIXED.test(pathname)
  ) {
    return false;
  }
  return (
    framework === "react" ||
    PRIMITIVE_PATHS.includes(pathname) ||
    !REACT_ADDRESSES.some((prefix) => under(pathname, prefix))
  );
}

/** The page a framework address is, and its framework: `/docs/vue/components/base/knob` is `/docs/components/base/knob` for Vue, `/docs/vue/guides/output` is `/docs/guides/output`; `/docs/vue` is the docs' own first page. Null for any other address, and for a page the framework is not shown. */
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
  const page = `/docs/${rest}`;
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
 * The class the document gets before its first paint, `framework-<id>`, which
 * the framework switch reads until the page is hydrated: the framework kept,
 * or React on a page that has nothing for it (`frameworkOfPage`), written for a
 * document with no module, from the same lists. In a function, as the script
 * below: a `var` at the top of a page would be a property of `window`.
 */
export const FRAMEWORK_CLASS_SCRIPT = `
  (function () {
    var kept = localStorage['audio-ui-framework'];
    if (!/^(react|vue|svelte|web)$/.test(kept)) return;
    var path = location.pathname.replace(/\\/$/, '');
    var under = function (prefix) { return path === prefix || path.indexOf(prefix + '/') === 0; };
    var shown = kept === 'react' || ${JSON.stringify(PRIMITIVE_PATHS)}.indexOf(path) >= 0 || !${JSON.stringify(REACT_ADDRESSES)}.some(under);
    document.documentElement.classList.add('framework-' + (shown ? kept : 'react'));
  })();
`;

/**
 * Runs in the head, before the first paint: a page that has an address for the
 * framework the reader kept (`/docs/components/base/knob` for Vue) goes to it, so the
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
    var primitives = ${JSON.stringify(PRIMITIVE_PATHS)};
    var reactOnly = ${JSON.stringify(REACT_ADDRESSES)};
    var kept = localStorage['audio-ui-framework'];
    var segment = segments[kept];
    var path = location.pathname.replace(/\\/$/, '');
    var under = function (prefix) { return path === prefix || path.indexOf(prefix + '/') === 0; };
    var to = null;
    if (segment && (path === '/docs' || path.indexOf('/docs/') === 0) && !${PREFIXED.toString()}.test(path) && (kept === 'react' || primitives.indexOf(path) >= 0 || !reactOnly.some(under))) {
      to = '/docs/' + segment + path.slice(5);
    }
    if (to) location.replace(to + location.search + location.hash);
  } catch (_) {} })();
`;
