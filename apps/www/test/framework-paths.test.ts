import { expect, test } from "bun:test";
import {
  FRAMEWORK_REDIRECT_SCRIPT,
  frameworkAddresses,
  frameworkAddressOf,
  pageOfFrameworkAddress,
} from "@/lib/docs/content/framework-paths";

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
    pathname: "/docs/registry",
  });
});

test("an address with no framework prefix is left alone", () => {
  expect(pageOfFrameworkAddress("/docs/react-package/knob")).toBeNull();
  expect(pageOfFrameworkAddress("/docs/knob-ui-sdk")).toBeNull();
  expect(pageOfFrameworkAddress("/docs/vuex")).toBeNull();
});

test("a page read for a framework goes back to its framework address", () => {
  expect(frameworkAddressOf("/docs/knob-ui-sdk", "vue")).toBe("/docs/vue/knob");
  expect(frameworkAddressOf("/docs/registry", "web")).toBe(
    "/docs/web-components"
  );
  expect(frameworkAddressOf("/docs/knob-ui-sdk", "react")).toBe(
    "/docs/react/knob"
  );
  expect(frameworkAddressOf("/docs/styling", "vue")).toBeNull();
});

test("every framework address built is one the router reads", () => {
  for (const address of frameworkAddresses()) {
    const page = pageOfFrameworkAddress(address);
    expect(page).not.toBeNull();
    expect(
      frameworkAddressOf(page?.pathname ?? "", page?.framework ?? null)
    ).toBe(address);
  }
});

const run = (kept: string | null, pathname: string) => {
  const went: string[] = [];
  new Function("localStorage", "location", FRAMEWORK_REDIRECT_SCRIPT)(
    { "audio-ui-framework": kept },
    {
      hash: "#a",
      pathname,
      replace: (url: string) => {
        went.push(url);
      },
      search: "?x=1",
    }
  );
  return went[0] ?? null;
};

test("the redirect script goes to the address of the framework kept", () => {
  expect(run("vue", "/docs/knob-ui-sdk")).toBe("/docs/vue/knob?x=1#a");
  expect(run("web", "/docs/registry")).toBe("/docs/web-components?x=1#a");
  expect(run("svelte", "/docs/piano-roll-ui-sdk/")).toBe(
    "/docs/svelte/piano-roll?x=1#a"
  );
});

test("the redirect script stays where it is without a framework kept or an address for the page", () => {
  expect(run(null, "/docs/knob-ui-sdk")).toBeNull();
  expect(run("vue", "/docs/guides/output")).toBeNull();
  expect(run("vue", "/docs/vue/knob")).toBeNull();
});
