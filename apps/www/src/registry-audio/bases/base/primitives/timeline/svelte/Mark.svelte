<script lang="ts">
import type { ComponentProps } from "svelte";
import { parts } from "./parts.ts";

/** A point of interest at a `value`. With `movable`, a drag or the arrows move it. The `mark` name defaults to the value. */
let {
  mark,
  value,
  ...rest
}: Omit<ComponentProps<typeof parts.Mark>, "mark"> & { mark?: string } =
  $props();
</script>

<parts.Mark {...rest} mark={mark ?? String(value)} {value} />
