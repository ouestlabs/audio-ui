import { expect, test } from "bun:test";
import { SHIPPED_PRIMITIVES } from "@/registry/bases/primitives";

const PRIMITIVES = `${import.meta.dir}/../src/registry/primitives`;
const ALIAS = /"@\/primitives\/([a-z-]+)": \[\s*"([^"]+)"/g;

test("a primitive written in the registry is shipped and aliased, and only those", async () => {
  const written = [
    ...new Bun.Glob("*/*.ts").scanSync({ cwd: PRIMITIVES }),
  ].flatMap((path) => {
    const [folder, file] = path.split("/");
    return file === `${folder}.ts` ? [folder] : [];
  });
  const tsconfig = await Bun.file(`${import.meta.dir}/../tsconfig.json`).text();
  const aliased = new Map(
    [...tsconfig.matchAll(ALIAS)].map((match) => [match[1], match[2]])
  );
  expect([...SHIPPED_PRIMITIVES].sort()).toEqual(written.sort());
  for (const name of written) {
    expect(aliased.get(name)).toBe(
      `./src/registry/primitives/${name}/${name}.ts`
    );
  }
  expect([...aliased.keys()].sort()).toEqual(written.sort());
});
