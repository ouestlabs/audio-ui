import { expect, test } from "bun:test";
import { KERNEL_SETS, KERNELS_DIR, kernelFile } from "../scripts/kernels.ts";

test("every device's kernels are the packages' own, as installed", async () => {
  const stale = await Promise.all(
    KERNEL_SETS.map(async (set) =>
      (await Bun.file(`${KERNELS_DIR}/${set.file}`).text()) ===
      (await kernelFile(set))
        ? null
        : set.file
    )
  );
  // When it fails: bun run kernels:build, from apps/www.
  expect(stale.filter(Boolean)).toEqual([]);
});
