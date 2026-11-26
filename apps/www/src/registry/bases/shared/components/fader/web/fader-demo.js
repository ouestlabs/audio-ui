import "@/registry/primitives/fader/web";

/** A graduation beside the track, with its label when it has one. */
const mark = (value, label) => `
          <audio-ui-fader-mark value="${value}">
            <span data-slot="fader-mark-tick"></span>${label === undefined ? "" : `<span data-slot="fader-mark-label">${label}</span>`}
          </audio-ui-fader-mark>`;

const GRIP = `<div data-orientation="vertical" data-slot="fader-thumb-mark"></div>`;

/** Draws the demo into `element`, and returns what takes it away. Its look is the fader's sheet, on its parts and attributes. */
export default function faderWebDemo(element) {
  element.innerHTML = `
    <audio-ui-fader data-marks="labels" data-readout="auto" data-size="default" default-value="50" max="100" min="0" orientation="vertical" step="1">
      <audio-ui-fader-control>
        <audio-ui-fader-track>
          <audio-ui-fader-indicator></audio-ui-fader-indicator>
        </audio-ui-fader-track>
        <div aria-hidden="true" data-slot="fader-scale">${mark(0, "0")}${mark(25)}${mark(50)}${mark(75)}${mark(100, "100")}
        </div>
        <audio-ui-fader-thumb aria-label="Volume">
          <div data-orientation="vertical" data-slot="fader-thumb-inner">${GRIP}${GRIP}${GRIP}</div>
          <audio-ui-fader-value></audio-ui-fader-value>
        </audio-ui-fader-thumb>
      </audio-ui-fader-control>
    </audio-ui-fader>`;
  return () => {
    element.innerHTML = "";
  };
}
