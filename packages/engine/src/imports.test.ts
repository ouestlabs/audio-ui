import { expect, test } from "bun:test";

const SOURCE = `${import.meta.dir}`;
// An app's alias, such as the registry's `@/registry-audio/...`: a published package has none.
const APP_ALIAS = /from "@\/[^"]*"/;
// The package's own name: its modules import each other by path.
const SELF = /from "@audio-ui\/engine[^"]*"/;

test("the engine imports no app path and not itself by name", async () => {
  const files = [...new Bun.Glob("**/*.ts").scanSync(SOURCE)].filter(
    (file) => !file.endsWith("imports.test.ts")
  );
  const texts = await Promise.all(
    files.map((file) => Bun.file(`${SOURCE}/${file}`).text())
  );
  const wrong = files.filter((_, index) => {
    const text = texts[index] ?? "";
    return APP_ALIAS.test(text) || SELF.test(text);
  });
  expect(wrong).toEqual([]);
});
