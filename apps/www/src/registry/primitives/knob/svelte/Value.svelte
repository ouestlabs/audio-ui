<script lang="ts">
import type { ComponentProps, Snippet } from "svelte";
import { editableReadout, type KnobPublicState } from "@/primitives/knob";
import { parts } from "./parts";

let {
  children: content,
  editable = false,
  ...rest
}: Omit<ComponentProps<typeof parts.Value>, "children"> & {
  children?: Snippet<[KnobPublicState]>;
  /** Lets you type the value: a double click on the readout, or Enter or F2 while it has focus. */
  editable?: boolean;
} = $props();

// An editable readout lays a field over the text Svelte keeps drawing.
const editing = (el: HTMLElement) =>
  editable ? editableReadout(el, "knob") : undefined;
</script>

<parts.Value {...rest} {@attach editing}>
  {#snippet children(
    state
  )}
    {#if content}
      {@render content(state)}
    {:else}
      {state.formatted}
    {/if}
  {/snippet}
</parts.Value>
