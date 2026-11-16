import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import {
  FRAMEWORK_REDIRECT_SCRIPT,
  frameworkAddresses,
  frameworkAddressOf,
  pageOfFrameworkAddress,
} from "@/lib/docs/content/framework-paths";
import { docsPages } from "../scripts/site-paths.mts";

test("a framework address is the page of the primitive on the UI SDK, read for the framework", () => {
  expect(pageOfFrameworkAddress("/docs/vue/knob")).toEqual({
    framework: "vue",
    pathname: "/docs/knob-ui-sdk",
  });
  expect(pageOfFrameworkAddress("/docs/web-components/piano-roll")).toEqual({
    framework: "web",
    pathname: "/docs/piano-roll-ui-sdk",
  });
  expect(pageOfFrameworkAddress("/docs/svelte")).toEqual({
    framework: "svelte",
    pathname: "/docs",
  });
});

test("an address with no framework prefix is left alone", () => {
  expect(pageOfFrameworkAddress("/docs/vue/primitives/knob")).toBeNull();
  expect(pageOfFrameworkAddress("/docs/react/elements/knob")).toBeNull();
  expect(pageOfFrameworkAddress("/docs/knob-ui-sdk")).toBeNull();
  expect(pageOfFrameworkAddress("/docs/vuex")).toBeNull();
});

test("a page read for a framework goes back to its framework address", () => {
  expect(frameworkAddressOf("/docs/knob-ui-sdk", "vue")).toBe("/docs/vue/knob");
  expect(frameworkAddressOf("/docs", "web")).toBe("/docs/web-components");
  expect(frameworkAddressOf("/docs/registry", "web")).toBe(
    "/docs/web-components/registry"
  );
  expect(frameworkAddressOf("/docs/knob-ui-sdk", "react")).toBe(
    "/docs/react/knob"
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
  // Each framework has the section that is made for it.
  expect(frameworkAddressOf("/docs/primitives/knob", "react")).toBe(
    "/docs/react/primitives/knob"
  );
  expect(frameworkAddressOf("/docs/elements/knob", "vue")).toBe(
    "/docs/vue/elements/knob"
  );
  expect(frameworkAddressOf("/docs/primitives/knob", "vue")).toBeNull();
  expect(frameworkAddressOf("/docs/elements/knob", "react")).toBeNull();
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
  expect(run("vue", "/docs/knob-ui-sdk")).toBe("/docs/vue/knob?x=1#a");
  expect(run("web", "/docs")).toBe("/docs/web-components?x=1#a");
  expect(run("svelte", "/docs/piano-roll-ui-sdk/")).toBe(
    "/docs/svelte/piano-roll?x=1#a"
  );
});

test("the redirect script stays where it is without a framework kept or an address for the page", () => {
  expect(run(null, "/docs/knob-ui-sdk")).toBeNull();
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
