import "@/registry/bases/base/primitives/envelope/web";

/** Draws the envelope into `element`, and returns what takes it away. The points and the curve handles are made for you: styled here from their tags. */
export default function envelopeWebDemo(element) {
  element.innerHTML = `
    <style>
      audio-ui-envelope-point { width: 1rem; height: 1rem; border-radius: 9999px; background: var(--primary); cursor: grab; }
      audio-ui-envelope-segment { width: 0.75rem; height: 0.75rem; border-radius: 9999px; background: var(--muted-foreground); cursor: ns-resize; }
      audio-ui-envelope-fill { color: color-mix(in oklab, var(--primary) 20%, transparent); }
      audio-ui-envelope-line { color: var(--primary); }
    </style>
    <div class="cn-envelope cn-envelope-size-default group/envelope box-border w-full cursor-crosshair touch-none select-none p-3.5 has-data-disabled:pointer-events-none has-data-disabled:opacity-50">
      <audio-ui-envelope aria-label="Envelope" class="block size-full data-disabled:cursor-not-allowed" role="group" value='[{"x":0,"y":0},{"x":0.15,"y":1},{"x":0.6,"y":0.5},{"x":1,"y":0}]'>
        <audio-ui-envelope-graph class="size-full overflow-visible">
          <audio-ui-envelope-fill></audio-ui-envelope-fill>
          <audio-ui-envelope-line></audio-ui-envelope-line>
        </audio-ui-envelope-graph>
      </audio-ui-envelope>
    </div>`;
  return () => {
    element.innerHTML = "";
  };
}
