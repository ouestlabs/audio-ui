// Writes each device's kernels file from the installed packages: run it after
// adding a kernel to `kernels.ts` or bumping one of the packages.
import { KERNEL_SETS, KERNELS_DIR, kernelFile } from "./kernels.ts";

await Promise.all(
  KERNEL_SETS.map(async (set) => {
    await Bun.write(`${KERNELS_DIR}/${set.file}`, await kernelFile(set));
    console.log(`Wrote lib/${set.file}`);
  })
);
