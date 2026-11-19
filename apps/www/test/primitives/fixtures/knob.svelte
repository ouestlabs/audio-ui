<script lang="ts">
import { Knob } from "@/registry/primitives/knob/svelte/index.ts";

/** The knob the shared suite drives: its options, how it is named, and its provider. */
let {
  label,
  options = {},
  provider,
  thumbLabel,
}: {
  label?: string;
  options?: Record<string, unknown>;
  provider?: { dragMode: "circular" | "revolution" | "vertical" };
  thumbLabel?: string;
} = $props();
</script>

{#snippet knob()}
  <Knob.Root {...options}>
    {#if label}
      <Knob.Label>{label}</Knob.Label>
    {/if}
    <Knob.Control>
      <Knob.Track />
      <Knob.Indicator />
      <Knob.Thumb aria-label={thumbLabel} />
    </Knob.Control>
    <Knob.Value />
  </Knob.Root>
{/snippet}

{#if provider}
  <Knob.Provider {...provider}>{@render knob()}</Knob.Provider>
{:else}
  {@render knob()}
{/if}
