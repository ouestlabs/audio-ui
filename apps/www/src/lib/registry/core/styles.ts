/** The styles the registry is built in, each at `/r/styles/<style>/`. */
export const BUILT_STYLES = [
  "vega",
  "nova",
  "maia",
  "lyra",
  "mira",
  "luma",
  "rhea",
  "sera",
].flatMap((name) => [`base-${name}`, `ui-sdk-${name}`]);

/** What a project that names a style we do not build installs. */
export const DEFAULT_STYLE = "base-nova";
