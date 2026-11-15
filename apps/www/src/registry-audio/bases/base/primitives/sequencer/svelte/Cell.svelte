<script lang="ts">
import type { ComponentProps } from "svelte";
import { parts } from "./parts.ts";

/** One step of a row: a toggle button, pressed when the step is on. */
let {
  row,
  step,
  ...rest
}: Omit<ComponentProps<typeof parts.Cell>, "cell"> = $props();
</script>

<parts.Cell {...rest} cell={`${row}:${step}`} {row} {step} />
