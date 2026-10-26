import { describe, expect, test } from "bun:test";
import { addressOfLayoutPath } from "@/lib/seo/layout-paths";

describe("addressOfLayoutPath", () => {
  // The two addresses Search Console reported as 404, and their kin.
  test.each([
    ["/_site/", "/"],
    ["/_site", "/"],
    ["/_site/docs", "/docs"],
    ["/_site/docs/", "/docs"],
    ["/_site/components", "/components"],
    ["/_site/docs/components/base/knob", "/docs/components/base/knob"],
  ])("%s stands for %s", (pathname, address) => {
    expect(addressOfLayoutPath(pathname)).toBe(address);
  });

  test.each(["/", "/docs", "/_sites", "/docs/_site", "/site"])(
    "%s is no layout route id",
    (pathname) => {
      expect(addressOfLayoutPath(pathname)).toBeUndefined();
    }
  );
});
