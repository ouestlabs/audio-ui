import { readdirSync } from "node:fs";
import path from "node:path";
import type { WebpackOverrideFn } from "@remotion/bundler";

// Remotion compiles its config to CommonJS, where `import.meta` is empty: the
// package scripts run from apps/video, so paths start from there.
const root = path.resolve(process.cwd(), "../..");
const www = path.join(root, "apps/www/src");
const primitives = path.join(www, "registry/primitives");

/** `@/primitives/<name>` for every primitive, as www's tsconfig `paths` resolve it. */
const primitiveFiles = Object.fromEntries(
  readdirSync(primitives, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => [
      `@/primitives/${entry.name}$`,
      path.join(primitives, entry.name, `${entry.name}.ts`),
    ])
);

const CSS_TEST = /\.css$/i;

type Rule = NonNullable<
  NonNullable<Parameters<WebpackOverrideFn>[0]["module"]>["rules"]
>[number];

const isCssRule = (rule: Rule) =>
  Boolean(
    rule &&
      typeof rule === "object" &&
      rule.test instanceof RegExp &&
      rule.test.test("x.css")
  );

/**
 * Remotion's loader reads the JSX runtime from tsconfig through
 * `typescript.sys`, which TypeScript 7 no longer has: without it esbuild falls
 * back to `React.createElement`. Ask for the automatic runtime outright.
 */
function withAutomaticJsx(rule: Rule): Rule {
  if (!(rule && typeof rule === "object" && Array.isArray(rule.use))) {
    return rule;
  }
  return {
    ...rule,
    use: rule.use.map((entry) =>
      entry &&
      typeof entry === "object" &&
      typeof entry.loader === "string" &&
      entry.loader.includes("esbuild-loader") &&
      typeof entry.options === "object"
        ? { ...entry, options: { ...entry.options, jsx: "automatic" } }
        : entry
    ),
  };
}

/**
 * Renders the registry's own components: `@/` is www's `src`, the packages
 * resolve to their sources (no build needed), there is one React, and CSS goes
 * through the same Tailwind as the site.
 */
export const webpackOverride: WebpackOverrideFn = (config) => ({
  ...config,
  module: {
    ...config.module,
    rules: [
      ...(config.module?.rules ?? [])
        .filter((rule) => !isCssRule(rule))
        .map(withAutomaticJsx),
      {
        test: CSS_TEST,
        use: [
          require.resolve("style-loader"),
          { loader: require.resolve("css-loader"), options: { url: false } },
          {
            loader: require.resolve("postcss-loader"),
            options: {
              postcssOptions: {
                plugins: [[require.resolve("@tailwindcss/postcss"), {}]],
              },
            },
          },
        ],
      },
    ],
  },
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      ...primitiveFiles,
      // The site's icon customizer drags the whole design system along, for
      // menu icons a video never opens.
      "@/components/icon-placeholder$": path.resolve(
        "src/icon-placeholder.tsx"
      ),
      // `@/lib/utils` imports one function of it, and the module loads the
      // whole registry through Vite's `import.meta.glob`.
      "@/lib/seo/seo$": path.resolve("src/seo.ts"),
      // The elements that name a behavior library: a video draws the ui-sdk ones, as the site does.
      "@/components/audio-ui/parameter-field$": path.join(
        www,
        "registry/bases/ui-sdk/audio-ui/elements/parameter-field.tsx"
      ),
      "@/components/audio-ui/rocker-switch$": path.join(
        www,
        "registry/bases/ui-sdk/audio-ui/elements/rocker-switch.tsx"
      ),
      "@/engine": path.join(www, "registry/lib/engine"),
      "@/webgl": path.join(www, "registry/lib/webgl"),
      "@": www,
      react: path.dirname(require.resolve("react/package.json")),
      "react-dom": path.dirname(require.resolve("react-dom/package.json")),
    },
  },
});
