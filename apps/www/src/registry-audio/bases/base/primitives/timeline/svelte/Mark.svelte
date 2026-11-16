<script lang="ts">
import type { ComponentProps } from "svelte";
import { type Known, parts } from "./parts";

/** A point of interest at a `value`. With `movable`, a drag or the arrows move it. The `mark` name defaults to the value. */
let {
  mark,
  value,
  ...rest
}: Omit<Known<ComponentProps<typeof parts.Mark>>, "mark"> & { mark?: string } =
  $props();
</script>

<parts.Mark {...rest} mark={mark ?? String(value)} {value} />
