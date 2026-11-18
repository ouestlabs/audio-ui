import { expect, test } from "bun:test";
import {
  baseAddresses,
  baseAddressOf,
  pageOfBaseAddress,
} from "@/lib/docs/content/base-paths";
import { frameworkAddressOf } from "@/lib/docs/content/framework-paths";

test("a base address is the component page, read for the base", () => {
  expect(pageOfBaseAddress("/docs/components/ui-sdk/knob")).toEqual({
    base: "ui-sdk",
    pathname: "/docs/components/base/knob",
  });
  expect(pageOfBaseAddress("/docs/components/ui-sdk/arrangement")).toEqual({
    base: "ui-sdk",
    pathname: "/docs/components/base/arrangement",
  });
});

test("the default base and any other address are left alone", () => {
  expect(pageOfBaseAddress("/docs/components/base/knob")).toBeNull();
  expect(pageOfBaseAddress("/docs/components/ui-sdk")).toBeNull();
  expect(pageOfBaseAddress("/docs/guides/output")).toBeNull();
});

test("a component page read for a base goes back to its base address", () => {
  expect(baseAddressOf("/docs/components/base/knob", "ui-sdk")).toBe(
    "/docs/components/ui-sdk/knob"
  );
  expect(baseAddressOf("/docs/components/base/knob", "base")).toBeNull();
  expect(baseAddressOf("/docs/components/base/knob", null)).toBeNull();
  expect(baseAddressOf("/docs/installation", "ui-sdk")).toBeNull();
});

test("the base address of a page has its React address too", () => {
  const [address] = baseAddresses(["/docs/components/base/knob"]);
  expect(address).toBe("/docs/components/ui-sdk/knob");
  expect(frameworkAddressOf(address ?? "", "react")).toBe(
    "/docs/react/components/ui-sdk/knob"
  );
  // The other frameworks have no styled catalog, so no base to choose.
  expect(frameworkAddressOf(address ?? "", "vue")).toBeNull();
});

test("only a component page has a base address", () => {
  expect(baseAddresses(["/docs/guides/output", "/docs/installation"])).toEqual(
    []
  );
});
