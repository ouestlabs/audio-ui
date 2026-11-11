import { expect, test } from "bun:test";
import {
  KERNEL_SETS,
  KERNELS_DIR,
  kernelFile,
  kernelIndex,
} from "../../scripts/kernels.ts";

test("every device's kernels are the packages' own, as installed", async () => {
  const stale = await Promise.all(
    KERNEL_SETS.map(async (set) =>
      (await Bun.file(`${KERNELS_DIR}/${set.file}`).text()) ===
      (await kernelFile(set))
        ? null
        : set.file
    )
  );
  // When it fails: bun run kernels:build, from packages/engine.
  expect(stale.filter(Boolean)).toEqual([]);
});

test("the module's index exports every kernel set", async () => {
  expect(await Bun.file(`${KERNELS_DIR}/index.ts`).text()).toBe(kernelIndex());
});
