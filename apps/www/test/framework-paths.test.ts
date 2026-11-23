import { expect, test } from "bun:test";
import { runInNewContext } from "node:vm";
import {
  FRAMEWORK_CLASS_SCRIPT,
  FRAMEWORK_REDIRECT_SCRIPT,
  frameworkAddresses,
  frameworkAddressOf,
  pageOfFrameworkAddress,
} from "@/lib/docs/content/framework-paths";
import { frameworkOfPage } from "@/lib/docs/content/frameworks";
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
const run = (kept: string | null, pathname: string, search = "?x=1") => {
  const went: string[] = [];
  const window: Record<string, unknown> = {
    history: {
      replaceState: (_state: unknown, _title: string, url: string) => {
        went.push(url);
      },
      state: null,
    },
    localStorage: { "audio-ui-framework": kept },
    location: {
      hash: "#a",
      pathname,
      replace: (url: string) => {
        went.push(url);
      },
      search,
    },
  };
  runInNewContext(FRAMEWORK_REDIRECT_SCRIPT, window);
  // A `var` at the top of a page is a property of `window`, and `window.name` turns what it is given into text.
  const leaked = Object.keys(window).filter(
    (key) => key !== "history" && key !== "localStorage" && key !== "location"
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

test("the redirect script drops a query naming the framework or the base from a docs address", () => {
  const knob = "/docs/components/base/knob";
  expect(run(null, knob, "?framework=svelte&x=1")).toBe(`${knob}?x=1#a`);
  expect(run(null, "/docs/components/ui-sdk/knob", "?base")).toBe(
    "/docs/components/ui-sdk/knob#a"
  );
  expect(run("vue", knob, "?x=1&framework=svelte&base=ui-sdk")).toBe(
    "/docs/vue/components/base/knob?x=1#a"
  );
  // Outside the docs, a query is the page's own.
  expect(run(null, "/", "?base=ui-sdk")).toBeNull();
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

test("a page that has nothing for the framework kept is read as React", () => {
  expect(frameworkOfPage("/docs/components/base/knob", "vue")).toBe("vue");
  expect(frameworkOfPage("/docs", "web")).toBe("web");
  expect(frameworkOfPage("/docs/components/base/mixer", "web")).toBe("react");
  expect(frameworkOfPage("/docs/guides/output", "svelte")).toBe("react");
  expect(frameworkOfPage("/docs/guides/output", "react")).toBe("react");
});

/** The class the document gets before its first paint, for a framework kept and a page. */
const classFor = (kept: string | null, path: string) => {
  const classes = new Set<string>();
  const window = {
    document: {
      documentElement: {
        classList: { add: (name: string) => classes.add(name) },
      },
    },
    localStorage: kept ? { "audio-ui-framework": kept } : {},
    location: { pathname: path },
  };
  runInNewContext(FRAMEWORK_CLASS_SCRIPT, window);
  return [...classes];
};

test("the class before the first paint names the framework the page is read in", () => {
  expect(classFor("web", "/docs/components/base/knob")).toEqual([
    "framework-web",
  ]);
  expect(classFor("web", "/docs/components/base/mixer")).toEqual([
    "framework-react",
  ]);
  expect(classFor("vue", "/docs/guides/output/")).toEqual(["framework-react"]);
  expect(classFor(null, "/docs/components/base/knob")).toEqual([]);
});
