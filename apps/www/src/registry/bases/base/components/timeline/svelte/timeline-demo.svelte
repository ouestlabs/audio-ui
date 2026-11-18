<script lang="ts">
import { Timeline } from "@/registry/bases/base/primitives/timeline/svelte/index";
</script>

<Timeline.Root
  class="cn-timeline flex w-full min-w-0 flex-col data-disabled:opacity-50"
  duration={32}
  snapStep={1}
>
  <Timeline.Viewport
    class="cn-timeline-viewport relative min-h-0 min-w-0 overscroll-x-contain"
  >
    <Timeline.Ruler
      aria-label="Position"
      class="cn-timeline-ruler h-6 shrink-0 cursor-pointer touch-none select-none"
    />
    <Timeline.Lane class="cn-timeline-lane h-16">
      <Timeline.Playhead
        class="cn-timeline-playhead pointer-events-none inset-y-0 w-px"
      />
      <Timeline.Clip
        aria-label="Kick"
        class="cn-timeline-clip group/clip isolate inset-y-0 touch-none data-dragging:z-10 data-disabled:cursor-not-allowed"
        clip="kick"
        defaultValue={{
          start: 2,
          length: 10,
          offset: 0,
          fadeIn: 0,
          fadeOut: 0,
        }}
      >
        <Timeline.ClipHeader
          class="cn-timeline-clip-header flex h-5 cursor-grab items-center truncate px-2 text-xs data-dragging:cursor-grabbing data-disabled:cursor-not-allowed"
          clip="kick"
          >Kick</Timeline.ClipHeader
        >
        <Timeline.ClipHandle
          aria-label="Trim start of Kick"
          class="cn-timeline-clip-handle absolute inset-y-0 z-10 w-2 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0"
          clip="kick"
          edge="start"
        />
        <Timeline.ClipHandle
          aria-label="Trim end of Kick"
          class="cn-timeline-clip-handle absolute inset-y-0 z-10 w-2 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0"
          clip="kick"
          edge="end"
        />
      </Timeline.Clip>
      <Timeline.Clip
        aria-label="Fill"
        class="cn-timeline-clip group/clip isolate inset-y-0 touch-none data-dragging:z-10 data-disabled:cursor-not-allowed"
        clip="fill"
        defaultValue={{
          start: 14,
          length: 8,
          offset: 0,
          fadeIn: 0,
          fadeOut: 0,
        }}
      >
        <Timeline.ClipHeader
          class="cn-timeline-clip-header flex h-5 cursor-grab items-center truncate px-2 text-xs data-dragging:cursor-grabbing data-disabled:cursor-not-allowed"
          clip="fill"
          >Fill</Timeline.ClipHeader
        >
        <Timeline.ClipHandle
          aria-label="Trim start of Fill"
          class="cn-timeline-clip-handle absolute inset-y-0 z-10 w-2 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0"
          clip="fill"
          edge="start"
        />
        <Timeline.ClipHandle
          aria-label="Trim end of Fill"
          class="cn-timeline-clip-handle absolute inset-y-0 z-10 w-2 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0"
          clip="fill"
          edge="end"
        />
      </Timeline.Clip>
    </Timeline.Lane>
    <Timeline.Lane class="cn-timeline-lane h-16">
      <Timeline.Playhead
        class="cn-timeline-playhead pointer-events-none inset-y-0 w-px"
      />
      <Timeline.Clip
        aria-label="Bass"
        class="cn-timeline-clip group/clip isolate inset-y-0 touch-none data-dragging:z-10 data-disabled:cursor-not-allowed"
        clip="bass"
        defaultValue={{
          start: 6,
          length: 12,
          offset: 0,
          fadeIn: 0,
          fadeOut: 0,
        }}
      >
        <Timeline.ClipHeader
          class="cn-timeline-clip-header flex h-5 cursor-grab items-center truncate px-2 text-xs data-dragging:cursor-grabbing data-disabled:cursor-not-allowed"
          clip="bass"
          >Bass</Timeline.ClipHeader
        >
        <Timeline.ClipHandle
          aria-label="Trim start of Bass"
          class="cn-timeline-clip-handle absolute inset-y-0 z-10 w-2 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0"
          clip="bass"
          edge="start"
        />
        <Timeline.ClipHandle
          aria-label="Trim end of Bass"
          class="cn-timeline-clip-handle absolute inset-y-0 z-10 w-2 cursor-ew-resize data-[edge=end]:right-0 data-[edge=start]:left-0"
          clip="bass"
          edge="end"
        />
      </Timeline.Clip>
    </Timeline.Lane>
  </Timeline.Viewport>
</Timeline.Root>
