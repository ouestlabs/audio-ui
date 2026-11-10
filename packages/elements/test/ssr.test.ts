import { expect, test } from "bun:test";

test("importing the elements where there is no DOM, as a server does, throws nothing and registers nothing", () => {
  const entry = `${import.meta.dir}/../src/index.ts`;
  const run = Bun.spawnSync(
    [
      process.execPath,
      "-e",
      `const elements = await import(${JSON.stringify(entry)}); console.log(typeof elements.KnobElement, typeof globalThis.customElements);`,
    ],
    { cwd: `${import.meta.dir}/..` }
  );
  expect(run.stderr.toString()).toBe("");
  expect(run.stdout.toString().trim()).toBe("function undefined");
});
