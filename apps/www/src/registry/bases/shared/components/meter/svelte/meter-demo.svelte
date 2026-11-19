<script lang="ts">
import { createSimulatedLevels } from "@/registry/bases/shared/lib/simulated-levels";
import { Meter } from "@/registry/primitives/meter/svelte/index";

const simulated = createSimulatedLevels(2);
$effect(() => simulated.run());

const decibels = (formattedValue: string) => `${formattedValue} dB`;
</script>

<Meter.Root
  aria-label="Stereo output"
  class="cn-meter cn-meter-size-default flex select-none gap-1 data-[orientation=horizontal]:mb-6 data-[orientation=horizontal]:w-full data-[orientation=horizontal]:flex-col data-[orientation=vertical]:me-8 data-[orientation=vertical]:w-fit"
  source={simulated.source}
  warnThreshold={-12}
>
  {#snippet children(
    state
  )}
    {#each Array.from(
      { length: state.channelCount },
      (_, index) => index
    ) as index (index)}
      <Meter.Channel
        aria-label={`Stereo output ${index + 1}`}
        class="cn-meter-channel relative flex-1 overflow-hidden data-[orientation=horizontal]:h-(--meter-thickness,auto) data-[orientation=horizontal]:flex-none data-[orientation=vertical]:w-(--meter-thickness,auto) data-[orientation=vertical]:flex-none"
        getAriaValueText={decibels}
        {index}
      >
        <Meter.Indicator class="cn-meter-fill absolute inset-0" />
        <Meter.Peak
          class="cn-meter-peak absolute data-[orientation=horizontal]:top-0 data-[orientation=horizontal]:bottom-0 data-[orientation=horizontal]:w-0.5 data-[orientation=vertical]:right-0 data-[orientation=vertical]:left-0 data-[orientation=vertical]:h-0.5"
        />
      </Meter.Channel>
    {/each}
    <Meter.Mark
      class="cn-meter-mark flex items-center gap-1 text-[10px] tabular-nums data-[orientation=vertical]:left-full data-[orientation=vertical]:ms-1 data-[orientation=horizontal]:top-full data-[orientation=horizontal]:mt-1 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=horizontal]:flex-col"
      value={6}
    >
      <span
        aria-hidden="true"
        class="bg-current opacity-40 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-1.5"
        data-orientation="vertical"
      ></span>
      <span class="min-w-4 text-end data-[orientation=horizontal]:text-center"
        >6</span
      >
    </Meter.Mark>
    <Meter.Mark
      class="cn-meter-mark flex items-center gap-1 text-[10px] tabular-nums data-[orientation=vertical]:left-full data-[orientation=vertical]:ms-1 data-[orientation=horizontal]:top-full data-[orientation=horizontal]:mt-1 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=horizontal]:flex-col"
      value={0}
    >
      <span
        aria-hidden="true"
        class="bg-current opacity-40 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-1.5"
        data-orientation="vertical"
      ></span>
      <span class="min-w-4 text-end data-[orientation=horizontal]:text-center"
        >0</span
      >
    </Meter.Mark>
    <Meter.Mark
      class="cn-meter-mark flex items-center gap-1 text-[10px] tabular-nums data-[orientation=vertical]:left-full data-[orientation=vertical]:ms-1 data-[orientation=horizontal]:top-full data-[orientation=horizontal]:mt-1 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=horizontal]:flex-col"
      value={-6}
    >
      <span
        aria-hidden="true"
        class="bg-current opacity-40 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-1.5"
        data-orientation="vertical"
      ></span>
      <span class="min-w-4 text-end data-[orientation=horizontal]:text-center"
        >-6</span
      >
    </Meter.Mark>
    <Meter.Mark
      class="cn-meter-mark flex items-center gap-1 text-[10px] tabular-nums data-[orientation=vertical]:left-full data-[orientation=vertical]:ms-1 data-[orientation=horizontal]:top-full data-[orientation=horizontal]:mt-1 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=horizontal]:flex-col"
      value={-12}
    >
      <span
        aria-hidden="true"
        class="bg-current opacity-40 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-1.5"
        data-orientation="vertical"
      ></span>
      <span class="min-w-4 text-end data-[orientation=horizontal]:text-center"
        >-12</span
      >
    </Meter.Mark>
    <Meter.Mark
      class="cn-meter-mark flex items-center gap-1 text-[10px] tabular-nums data-[orientation=vertical]:left-full data-[orientation=vertical]:ms-1 data-[orientation=horizontal]:top-full data-[orientation=horizontal]:mt-1 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=horizontal]:flex-col"
      value={-20}
    >
      <span
        aria-hidden="true"
        class="bg-current opacity-40 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-1.5"
        data-orientation="vertical"
      ></span>
      <span class="min-w-4 text-end data-[orientation=horizontal]:text-center"
        >-20</span
      >
    </Meter.Mark>
    <Meter.Mark
      class="cn-meter-mark flex items-center gap-1 text-[10px] tabular-nums data-[orientation=vertical]:left-full data-[orientation=vertical]:ms-1 data-[orientation=horizontal]:top-full data-[orientation=horizontal]:mt-1 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=horizontal]:flex-col"
      value={-30}
    >
      <span
        aria-hidden="true"
        class="bg-current opacity-40 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-1.5"
        data-orientation="vertical"
      ></span>
      <span class="min-w-4 text-end data-[orientation=horizontal]:text-center"
        >-30</span
      >
    </Meter.Mark>
    <Meter.Mark
      class="cn-meter-mark flex items-center gap-1 text-[10px] tabular-nums data-[orientation=vertical]:left-full data-[orientation=vertical]:ms-1 data-[orientation=horizontal]:top-full data-[orientation=horizontal]:mt-1 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=horizontal]:flex-col"
      value={-40}
    >
      <span
        aria-hidden="true"
        class="bg-current opacity-40 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-1.5"
        data-orientation="vertical"
      ></span>
      <span class="min-w-4 text-end data-[orientation=horizontal]:text-center"
        >-40</span
      >
    </Meter.Mark>
    <Meter.Mark
      class="cn-meter-mark flex items-center gap-1 text-[10px] tabular-nums data-[orientation=vertical]:left-full data-[orientation=vertical]:ms-1 data-[orientation=horizontal]:top-full data-[orientation=horizontal]:mt-1 data-[orientation=horizontal]:-translate-x-1/2 data-[orientation=vertical]:translate-y-1/2 data-[orientation=horizontal]:flex-col"
      value={-60}
    >
      <span
        aria-hidden="true"
        class="bg-current opacity-40 data-[orientation=horizontal]:h-1 data-[orientation=horizontal]:w-px data-[orientation=vertical]:h-px data-[orientation=vertical]:w-1.5"
        data-orientation="vertical"
      ></span>
      <span class="min-w-4 text-end data-[orientation=horizontal]:text-center"
        >-60</span
      >
    </Meter.Mark>
  {/snippet}
</Meter.Root>
