import { describe, expect, test } from "bun:test";
import { END, reference, START } from "../scripts/headless-reference.ts";

describe("headless styling reference", () => {
  test("the page holds the reference generated from the primitives' source", async () => {
    const page = await Bun.file(
      new URL(
        "../src/content/docs/(root)/headless-styling.mdx",
        import.meta.url
      )
    ).text();
    const from = page.indexOf(START) + START.length;
    const to = page.indexOf(END);
    expect(page.slice(from, to).trim()).toBe((await reference()).trim());
  });
});
