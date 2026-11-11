import { expect, test } from "bun:test";
import { buildEntries, exportsOf, MANIFEST } from "../scripts/build-entries.ts";

test("the entries' manifest is what the registry and the sources say", async () => {
  const built = `${JSON.stringify(await buildEntries(), null, 2)}\n`;
  expect(await Bun.file(MANIFEST).text()).toBe(built);
});

test("an export is read with the first sentence of its JSDoc, tags left out", () => {
  const source = `/**
 * Makes a thing: one of them,
 * on two lines. And more.
 * @default 3
 */
export function makeThing() {}
export const plain = 1;
/** A shape. */
export interface Shape {}`;
  expect(exportsOf(source)).toEqual([
    {
      kind: "function",
      name: "makeThing",
      summary: "Makes a thing: one of them, on two lines.",
    },
    { kind: "const", name: "plain", summary: "" },
    { kind: "interface", name: "Shape", summary: "A shape." },
  ]);
});
