import { expect, test } from "bun:test";
import {
  addressOf,
  addressOfPage,
  pageOfAddress,
} from "@/lib/docs/content/addresses";

const ORIGIN = "https://www.audio-ui.dev";
const at = (href: string) => new URL(href, ORIGIN);
const shown = (url: URL) => url.href.replace(ORIGIN, "");

const PAGES = [
  "/docs",
  "/docs/installation",
  "/docs/guides/output",
  "/docs/engine/analysis",
  "/docs/components/base/xypad",
  "/docs/components/base/lcd",
];
const FRAMEWORKS = [null, "react", "vue", "svelte", "web"];
const BASES = [null, "base", "ui-sdk"];

test("an address never names the framework or the base in its query", () => {
  for (const page of PAGES) {
    for (const framework of FRAMEWORKS) {
      for (const base of BASES) {
        const url = at(page);
        if (framework) {
          url.searchParams.set("framework", framework);
        }
        if (base) {
          url.searchParams.set("base", base);
        }
        url.searchParams.set("x", "1");
        const address = addressOfPage(url);
        expect(address.searchParams.has("framework")).toBe(false);
        expect(address.searchParams.has("base")).toBe(false);
        expect(address.searchParams.get("x")).toBe("1");
        // The router reads the same page back from it, which has the same address.
        expect(shown(addressOfPage(pageOfAddress(at(shown(address)))))).toBe(
          shown(address)
        );
      }
    }
  }
});

test("React reads the base in the address, another framework's address wins over it", () => {
  const page = "/docs/components/base/xypad";
  expect(addressOf(page, "react", "ui-sdk")).toBe(
    "/docs/react/components/ui-sdk/xypad"
  );
  expect(addressOf(page, "svelte", "ui-sdk")).toBe(
    "/docs/svelte/components/base/xypad"
  );
  expect(addressOf(page, null, "ui-sdk")).toBe("/docs/components/ui-sdk/xypad");
  // A page only React reads keeps its base.
  expect(addressOf("/docs/components/base/lcd", "vue", "ui-sdk")).toBe(
    "/docs/components/ui-sdk/lcd"
  );
});

test("a query naming the framework or the base is not read: the path says them", () => {
  const page = pageOfAddress(
    at("/docs/components/base/xypad?framework=svelte")
  );
  expect(shown(page)).toBe("/docs/components/base/xypad");
  expect(
    pageOfAddress(
      at("/docs/vue/components/base/knob?framework=react")
    ).searchParams.get("framework")
  ).toBe("vue");
  expect(
    pageOfAddress(
      at("/docs/components/ui-sdk/knob?base=base")
    ).searchParams.get("base")
  ).toBe("ui-sdk");
});

test("an address outside the docs keeps its query", () => {
  for (const href of ["/init?base=ui-sdk", "/?base=ui-sdk&style=nova"]) {
    expect(shown(pageOfAddress(at(href)))).toBe(href);
    expect(shown(addressOfPage(at(href)))).toBe(href);
  }
});
