/**
 * The framework addresses of the docs: `/docs/vue/knob` is the page of the
 * knob on the UI SDK, read for Vue. They are the same pages under another
 * address, so the router rewrites them to the page's own address with the
 * framework in a `?framework=` that only the router sees, and back the other way: an address the reader sees never has it. The published React package's pages are at `/docs/react-package`.
 */

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

/** The page a framework address is, and its framework: `/docs/vue/knob` is `/docs/knob-ui-sdk` for Vue; `/docs/vue` is the registry's. Null for any other address. */
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
    return { framework, pathname: "/docs/registry" };
  }
  return {
    framework,
    pathname: PRIMITIVE_PAGE.has(rest)
      ? `/docs/${rest}-ui-sdk`
      : `/docs/${rest}`,
  };
}

/** The framework address of a page read for a framework, or null when it has none: only the registry and the pages of the primitives on the UI SDK do. */
export function frameworkAddressOf(
  pathname: string,
  framework: string | null
): string | null {
  const segment = framework ? SEGMENT_OF.get(framework) : undefined;
  if (!segment) {
    return null;
  }
  if (pathname === "/docs/registry") {
    return `/docs/${segment}`;
  }
  const name = UI_SDK_ADDRESS.exec(pathname)?.[1];
  return name && PRIMITIVE_PAGE.has(name) ? `/docs/${segment}/${name}` : null;
}

/** The framework addresses to build: the registry's, and each primitive's, for each framework that has addresses. */
export function frameworkAddresses(): string[] {
  return Object.keys(FRAMEWORK_SEGMENTS).flatMap((segment) => [
    `/docs/${segment}`,
    ...UI_SDK_PRIMITIVES.map((name) => `/docs/${segment}/${name}`),
  ]);
}
