import { describe, expect, test } from "bun:test";
import { usableLocale } from "../src/primitives/internal/use-locale.ts";

describe("usableLocale", () => {
  test("keeps a language Intl accepts", () => {
    expect(usableLocale("fr-FR")).toBe("fr-FR");
  });

  test("falls back to the server's language for a POSIX locale", () => {
    expect(usableLocale("en-US@posix")).toBe("en-US");
    expect(usableLocale("C")).toBe("en-US");
  });

  test("the formatters built from it do not throw", () => {
    expect(() =>
      new Intl.NumberFormat(usableLocale("en-US@posix")).format(1)
    ).not.toThrow();
  });
});
