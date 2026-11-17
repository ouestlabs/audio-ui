import { expect, test } from "bun:test";
import { transformStyleClassNames } from "@/lib/code/code-utils";

test("a class string of another style is dropped with its line", () => {
  const code = 'cn(\n  "px-2",\n  "style-vega:shadow-xs",\n)';
  expect(transformStyleClassNames(code, "base-nova")).toBe('cn(\n  "px-2",\n)');
});

test("an empty string written as such stays, on a line of its own", () => {
  const code = 'return (\n  label ??\n  ""\n);';
  expect(transformStyleClassNames(code, "base-nova")).toBe(code);
});
