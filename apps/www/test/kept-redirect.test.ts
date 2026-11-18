import { expect, test } from "bun:test";
import { keptRedirectSearch } from "@/lib/docs/content/kept-redirect";

const PAGE = "/docs/components/base/fader";
const kept = {
  base: "ui-sdk",
  framework: "react",
  inSite: true,
  pathname: PAGE,
};

test("a link to a component page goes to the framework and the base the reader chose, in one step", () => {
  expect(keptRedirectSearch({ ...kept, search: {} })).toEqual({
    base: "ui-sdk",
    framework: "react",
  });
});

test("a redirect keeps the key the address already has: the two never send the page back and forth", () => {
  const withBase = keptRedirectSearch({ ...kept, search: { base: "ui-sdk" } });
  expect(withBase).toEqual({ base: "ui-sdk", framework: "react" });
  const withFramework = keptRedirectSearch({
    ...kept,
    search: { framework: "react" },
  });
  expect(withFramework).toEqual({ base: "ui-sdk", framework: "react" });
  // What it leads to needs no other.
  expect(keptRedirectSearch({ ...kept, search: withBase ?? {} })).toBeNull();
  expect(
    keptRedirectSearch({ ...kept, search: withFramework ?? {} })
  ).toBeNull();
});

test("any starting address settles in at most one redirect", () => {
  for (const search of [{}, { base: "ui-sdk" }, { framework: "react" }]) {
    const first = keptRedirectSearch({ ...kept, search });
    expect(keptRedirectSearch({ ...kept, search: first ?? search })).toBeNull();
  }
});

test("a page loaded whole keeps the base of its address", () => {
  expect(
    keptRedirectSearch({ ...kept, framework: null, inSite: false, search: {} })
  ).toBeNull();
});

test("a page with no base address, or a reader with no choice, is left alone", () => {
  expect(
    keptRedirectSearch({ ...kept, pathname: "/docs/installation", search: {} })
  ).toEqual({ framework: "react" });
  expect(
    keptRedirectSearch({ ...kept, base: null, framework: null, search: {} })
  ).toBeNull();
  expect(keptRedirectSearch({ ...kept, base: "base", search: {} })).toEqual({
    framework: "react",
  });
});
