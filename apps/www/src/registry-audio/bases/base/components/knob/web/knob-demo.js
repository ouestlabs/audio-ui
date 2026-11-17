import "@/registry-audio/bases/base/primitives/knob/web";

/** Draws the knob into `element`, and returns what takes it away. */
export default function knobWebDemo(element) {
  element.innerHTML = `
    <audio-ui-knob class="cn-knob cn-knob-size-lg group/knob relative m-5 mb-12 inline-flex outline-none data-disabled:cursor-not-allowed" value="50" min="0" max="100" step="1">
      <audio-ui-knob-control class="cn-knob-control transform-[translateZ(0)] relative isolate flex size-full cursor-grab touch-none select-none outline-none [clip-path:circle(50%_at_50%_50%)] focus-visible:outline-none active:cursor-grabbing data-disabled:pointer-events-none data-disabled:opacity-50 data-[drag-mode=vertical]:cursor-ns-resize data-[drag-mode=vertical]:active:cursor-ns-resize">
        <div class="cn-knob-body cn-knob-body-size-lg absolute z-0"></div>
        <audio-ui-knob-track class="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full opacity-22"></audio-ui-knob-track>
        <audio-ui-knob-indicator class="cn-knob-arc pointer-events-none absolute inset-0 z-1 block size-full"></audio-ui-knob-indicator>
        <audio-ui-knob-thumb aria-label="Level" class="pointer-events-none absolute inset-0 z-2">
          <svg aria-hidden="true" class="cn-knob-indicator block size-full" viewBox="0 0 48 48"><line stroke="currentColor" stroke-linecap="round" stroke-width="2.75" x1="24" x2="24" y1="11.53" y2="18.84" /></svg>
        </audio-ui-knob-thumb>
      </audio-ui-knob-control>
      <audio-ui-knob-mark value="0">
        <span class="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2"></span>
        <span class="cn-knob-mark-label -top-6 absolute left-1/2 -translate-x-1/2 [rotate:calc(var(--knob-mark-angle)*-1)]">0</span>
      </audio-ui-knob-mark>
      <audio-ui-knob-mark value="25">
        <span class="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2"></span>
      </audio-ui-knob-mark>
      <audio-ui-knob-mark value="50">
        <span class="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2"></span>
      </audio-ui-knob-mark>
      <audio-ui-knob-mark value="75">
        <span class="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2"></span>
      </audio-ui-knob-mark>
      <audio-ui-knob-mark value="100">
        <span class="cn-knob-mark-tick -top-2.5 absolute left-1/2 h-1.5 w-px -translate-x-1/2"></span>
        <span class="cn-knob-mark-label -top-6 absolute left-1/2 -translate-x-1/2 [rotate:calc(var(--knob-mark-angle)*-1)]">100</span>
      </audio-ui-knob-mark>
      <audio-ui-knob-value class="cn-knob-value absolute top-full left-1/2 z-10 mt-6 -translate-x-1/2 cursor-text whitespace-nowrap opacity-0 transition-opacity duration-150 ease-out group-hover/knob:opacity-100 group-has-focus-visible/knob:opacity-100 group-data-dragging/knob:opacity-100 data-editing:opacity-100 motion-reduce:transition-none" editable></audio-ui-knob-value>
    </audio-ui-knob>`;
  return () => {
    element.innerHTML = "";
  };
}
