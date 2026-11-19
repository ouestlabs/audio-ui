<script lang="ts">
import type { ComponentProps } from "svelte";
import { type Known, parts } from "./parts";

/** One step of a row: a toggle button, pressed when the step is on. */
let {
  row,
  step,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.Cell>>, "cell"> = $props();
</script>

<parts.Cell {...rest} cell={`${row}:${step}`} {row} {step} />
