import { expect, test } from "bun:test";

const PREVIEW = /<ComponentPreview[^>]*\bname="([^"]+)"/g;
const DOCS = `${import.meta.dir}/../src/content/docs`;

test("a docs page never shows the same block or demo twice", async () => {
  const repeated: string[] = [];
  for await (const path of new Bun.Glob("**/*.mdx").scan(DOCS)) {
    const names = [
      ...(await Bun.file(`${DOCS}/${path}`).text()).matchAll(PREVIEW),
    ].map((match) => match[1]);
    for (const name of new Set(names)) {
      if (names.filter((each) => each === name).length > 1) {
        repeated.push(`${path}: ${name}`);
      }
    }
  }
  expect(repeated).toEqual([]);
});
