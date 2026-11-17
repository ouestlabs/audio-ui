import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import {
  FRAMEWORK_REDIRECT_SCRIPT,
  frameworkAddresses,
  frameworkAddressOf,
  pageOfFrameworkAddress,
} from "@/lib/docs/content/framework-paths";
import { docsPages } from "../scripts/site-paths.mts";

test("a framework address is the page of the primitive, read for the framework", () => {
  expect(pageOfFrameworkAddress("/docs/vue/components/base/knob")).toEqual({
    framework: "vue",
    pathname: "/docs/components/base/knob",
  });
  expect(
    pageOfFrameworkAddress("/docs/web-components/components/base/piano-roll")
  ).toEqual({
    framework: "web",
    pathname: "/docs/components/base/piano-roll",
  });
  // The rest of the styled catalog is React's.
  expect(pageOfFrameworkAddress("/docs/vue/components/base/lcd")).toBeNull();
  expect(pageOfFrameworkAddress("/docs/svelte")).toEqual({
    framework: "svelte",
    pathname: "/docs",
  });
});

test("an address with no framework prefix is left alone", () => {
  expect(pageOfFrameworkAddress("/docs/components/base/knob")).toBeNull();
  expect(pageOfFrameworkAddress("/docs/vuex")).toBeNull();
});

test("a page read for a framework goes back to its framework address", () => {
  expect(frameworkAddressOf("/docs/components/base/knob", "vue")).toBe(
    "/docs/vue/components/base/knob"
  );
  expect(frameworkAddressOf("/docs/components/base/lcd", "vue")).toBeNull();
  expect(frameworkAddressOf("/docs", "web")).toBe("/docs/web-components");
  expect(frameworkAddressOf("/docs/installation", "web")).toBe(
    "/docs/web-components/installation"
  );
  expect(frameworkAddressOf("/docs/components/base/lcd", "react")).toBe(
    "/docs/react/components/base/lcd"
  );
  expect(frameworkAddressOf("/docs/styling", "vue")).toBeNull();
});

/** Every page of the docs, as the build lists them. */
const PAGES = docsPages().map(({ path }) => path);

test("every page of the docs has the address of each framework it is shown to", () => {
  expect(frameworkAddressOf("/docs/guides/output", "react")).toBe(
    "/docs/react/guides/output"
  );
  expect(frameworkAddressOf("/docs/guides/output", "vue")).toBeNull();
  expect(frameworkAddressOf("/docs/engine/analysis", "vue")).toBe(
    "/docs/vue/engine/analysis"
  );
  expect(pageOfFrameworkAddress("/docs/vue/engine/analysis")).toEqual({
    framework: "vue",
    pathname: "/docs/engine/analysis",
  });
  expect(pageOfFrameworkAddress("/docs/vue/guides/output")).toBeNull();
});

test("every framework address built is one the router reads", () => {
  for (const address of frameworkAddresses(PAGES)) {
    const page = pageOfFrameworkAddress(address);
    expect(page).not.toBeNull();
    expect(
      frameworkAddressOf(page?.pathname ?? "", page?.framework ?? null)
    ).toBe(address);
  }
});

/** Runs the script as a page does, as a global script. */
const run = (kept: string | null, pathname: string) => {
  const went: string[] = [];
  const window: Record<string, unknown> = {
    localStorage: { "audio-ui-framework": kept },
    location: {
      hash: "#a",
      pathname,
      replace: (url: string) => {
        went.push(url);
      },
      search: "?x=1",
    },
  };
  runInNewContext(FRAMEWORK_REDIRECT_SCRIPT, window);
  // A `var` at the top of a page is a property of `window`, and `window.name` turns what it is given into text.
  const leaked = Object.keys(window).filter(
    (key) => key !== "localStorage" && key !== "location"
  );
  if (leaked.length > 0) {
    throw new Error(`the script leaks globals: ${leaked.join(", ")}`);
  }
  return went.at(0) ?? null;
};

test("the redirect script goes to the address of the framework kept", () => {
  expect(run("vue", "/docs/components/base/knob")).toBe(
    "/docs/vue/components/base/knob?x=1#a"
  );
  expect(run("web", "/docs")).toBe("/docs/web-components?x=1#a");
  expect(run("svelte", "/docs/components/base/piano-roll/")).toBe(
    "/docs/svelte/components/base/piano-roll?x=1#a"
  );
});

test("the redirect script stays where it is without a framework kept or an address for the page", () => {
  expect(run(null, "/docs/components/base/knob")).toBeNull();
  expect(run("vue", "/docs/guides/output")).toBeNull();
  expect(run("vue", "/docs/vue/knob")).toBeNull();
});

test("the redirect script goes where frameworkAddressOf does, for every page", () => {
  for (const id of ["react", "svelte", "vue", "web"]) {
    for (const page of PAGES) {
      const address = frameworkAddressOf(page, id);
      expect(run(id, page)).toEqual(address ? `${address}?x=1#a` : null);
    }
  }
});
