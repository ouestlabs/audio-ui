import "@/registry-audio/bases/base/primitives/fader/web";

/** Draws the demo into `element`, and returns what takes it away. */
export default function faderWebDemo(element: HTMLElement) {
  element.innerHTML = `
    <audio-ui-fader class="group/fader relative data-[orientation=vertical]:h-full data-[orientation=horizontal]:w-full data-disabled:cursor-not-allowed data-[orientation=horizontal]:pb-6 data-[orientation=vertical]:ps-10" default-value="50" max="100" min="0" orientation="vertical" step="1">
      <audio-ui-fader-control class="relative flex w-full touch-none select-none items-center data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-[var(--fader-min-height,10rem)] data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32 transition-opacity duration-150 ease-out motion-reduce:transition-none data-disabled:pointer-events-none data-disabled:opacity-50">
        <audio-ui-fader-track class="cn-fader-track cn-fader-track-size-default relative grow cursor-pointer select-none overflow-hidden">
          <audio-ui-fader-indicator class="cn-fader-range absolute select-none data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full data-[orientation=vertical]:bottom-0"></audio-ui-fader-indicator>
        </audio-ui-fader-track>
        <div aria-hidden="true" class="pointer-events-none absolute inset-y-0 end-[calc(50%+0.75rem)]">
          <audio-ui-fader-mark class="flex items-center gap-1 end-0 translate-y-1/2 flex-row" value="0">
            <span class="cn-fader-mark-label">0</span>
            <span class="cn-fader-mark-tick h-px w-1.5"></span>
          </audio-ui-fader-mark>
          <audio-ui-fader-mark class="flex items-center gap-1 end-0 translate-y-1/2 flex-row" value="25">
            <span class="cn-fader-mark-tick h-px w-1.5"></span>
          </audio-ui-fader-mark>
          <audio-ui-fader-mark class="flex items-center gap-1 end-0 translate-y-1/2 flex-row" value="50">
            <span class="cn-fader-mark-tick h-px w-1.5"></span>
          </audio-ui-fader-mark>
          <audio-ui-fader-mark class="flex items-center gap-1 end-0 translate-y-1/2 flex-row" value="75">
            <span class="cn-fader-mark-tick h-px w-1.5"></span>
          </audio-ui-fader-mark>
          <audio-ui-fader-mark class="flex items-center gap-1 end-0 translate-y-1/2 flex-row" value="100">
            <span class="cn-fader-mark-label">100</span>
            <span class="cn-fader-mark-tick h-px w-1.5"></span>
          </audio-ui-fader-mark>
        </div>
        <audio-ui-fader-thumb aria-label="Volume" class="cn-fader-thumb cn-fader-thumb-size-default before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none outline-none before:absolute before:content-[''] active:cursor-grabbing data-disabled:pointer-events-none">
          <div class="cn-fader-thumb-inner-size-default flex h-full w-full items-center justify-center gap-0.5 data-[orientation=horizontal]:flex-row data-[orientation=vertical]:flex-col" data-orientation="vertical">
            <div class="cn-fader-thumb-mark cn-fader-thumb-mark-size-default" data-orientation="vertical"></div>
            <div class="cn-fader-thumb-mark cn-fader-thumb-mark-size-default" data-orientation="vertical"></div>
            <div class="cn-fader-thumb-mark cn-fader-thumb-mark-size-default" data-orientation="vertical"></div>
          </div>
          <audio-ui-fader-value class="cn-fader-value absolute z-20 whitespace-nowrap cursor-text start-full top-1/2 ms-2 -translate-y-1/2 opacity-0 transition-opacity duration-150 ease-out group-hover/fader:opacity-100 group-has-focus-visible/fader:opacity-100 group-has-data-dragging/fader:opacity-100 data-editing:opacity-100 motion-reduce:transition-none" editable></audio-ui-fader-value>
        </audio-ui-fader-thumb>
      </audio-ui-fader-control>
    </audio-ui-fader>`;
  return () => {
    element.innerHTML = "";
  };
}
