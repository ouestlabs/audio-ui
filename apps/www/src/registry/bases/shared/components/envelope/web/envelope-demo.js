import "@/registry/primitives/envelope/web";

/** The frame's room for the end points, which the grid's lines are measured from. */
const INSET = "0.875rem";
const STEP = `calc((100% - 2 * ${INSET}) * 0.25)`;

/** Draws the envelope into `element`, and returns what takes it away. Its look is the envelope's sheet; the points and the curve handles are made for you. */
export default function envelopeWebDemo(element) {
  element.innerHTML = `
    <div data-size="default" data-slot="envelope-frame" style="background-image: linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px); background-position: ${INSET} 0, 0 ${INSET}; background-size: ${STEP} 100%, 100% ${STEP}">
      <audio-ui-envelope aria-label="Envelope" role="group" value='[{"x":0,"y":0},{"x":0.15,"y":1},{"x":0.6,"y":0.5},{"x":1,"y":0}]'>
        <audio-ui-envelope-graph>
          <audio-ui-envelope-fill></audio-ui-envelope-fill>
          <audio-ui-envelope-line></audio-ui-envelope-line>
        </audio-ui-envelope-graph>
      </audio-ui-envelope>
    </div>`;
  return () => {
    element.innerHTML = "";
  };
}
