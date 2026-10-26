import { describe, expect, test } from "bun:test";
import { negotiate } from "@/lib/agents/negotiate";

const BOTH = ["text/html", "text/markdown"];

/** The header Chrome sends for a page. */
const CHROME =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";

describe("negotiate", () => {
  // The test vectors of acceptmarkdown.com's guide to parsing Accept.
  test.each([
    ["text/markdown", BOTH, "text/markdown"],
    ["text/markdown, text/html;q=0.8", BOTH, "text/markdown"],
    ["text/html", BOTH, "text/html"],
    ["text/markdown;q=0, text/html", BOTH, "text/html"],
    ["text/markdown;q=0", ["text/markdown"], undefined],
    [null, BOTH, "text/html"],
    ["*/*", BOTH, "text/html"],
  ])("Accept %p, offers %p: %p", (accept, offers, expected) => {
    expect(negotiate(accept, offers)).toBe(expected);
  });

  test("a browser gets HTML, even though it takes anything at a lower q", () => {
    expect(negotiate(CHROME, BOTH)).toBe("text/html");
  });

  test("q=0 on markdown alone means anything but markdown", () => {
    expect(negotiate("text/markdown;q=0", BOTH)).toBe("text/html");
  });

  test("at the same q the more specific range wins", () => {
    expect(negotiate("text/*, text/markdown", BOTH)).toBe("text/markdown");
  });

  test("at the same q and specificity the range listed first wins", () => {
    expect(negotiate("text/markdown, text/html", BOTH)).toBe("text/markdown");
    expect(negotiate("text/html, text/markdown", BOTH)).toBe("text/html");
  });

  test("the most specific range decides, even against a higher wildcard", () => {
    expect(negotiate("*/*, text/html;q=0", BOTH)).toBe("text/markdown");
  });

  test("a type no range matches is a 406", () => {
    expect(negotiate("application/pdf", BOTH)).toBeUndefined();
  });

  test("types and parameters are case-insensitive, whitespace is ignored", () => {
    expect(negotiate(" Text/Markdown ; Q=1 ", BOTH)).toBe("text/markdown");
  });

  test("an empty header is no constraint", () => {
    expect(negotiate("  ", BOTH)).toBe("text/html");
  });

  test("malformed ranges and q values are skipped", () => {
    expect(negotiate("garbage, */html, text/html;q=2", BOTH)).toBeUndefined();
    expect(negotiate("garbage, text/markdown", BOTH)).toBe("text/markdown");
  });

  test("the shadcn CLI's header picks JSON", () => {
    expect(
      negotiate("application/vnd.shadcn.v1+json, application/json;q=0.9", [
        "text/html",
        "text/markdown",
        "application/json",
      ])
    ).toBe("application/json");
  });
});
