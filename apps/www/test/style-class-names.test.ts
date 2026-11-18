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

test("the blank lines around a dropped class string go with it", () => {
  const code = 'cn(\n  "px-2",\n\n  "style-vega:shadow-xs",\n\n  "py-1",\n)';
  expect(transformStyleClassNames(code, "base-nova")).toBe(
    'cn(\n  "px-2",\n  "py-1",\n)'
  );
});

test("a class string emptied beside other code stays, as an empty string", () => {
  const code = 'cn("px-2", "style-vega:shadow-xs")';
  expect(transformStyleClassNames(code, "base-nova")).toBe('cn("px-2", "")');
});
