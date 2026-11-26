import "@/registry/primitives/meter/web";
import { createSimulatedLevels } from "@/registry/lib/devices/simulated-levels";

// The marks of a dBFS scale, down to the floor.
const SCALE = [6, 0, -6, -12, -20, -30, -40, -60];

const channel = (index) => `
      <audio-ui-meter-channel aria-label="Stereo output ${index + 1}" index="${index}">
        <audio-ui-meter-indicator></audio-ui-meter-indicator>
        <audio-ui-meter-peak></audio-ui-meter-peak>
      </audio-ui-meter-channel>`;

const mark = (level) => `
      <audio-ui-meter-mark value="${level}">
        <span aria-hidden="true" data-orientation="vertical" data-slot="meter-mark-tick"></span>
        <span data-slot="meter-mark-label">${level}</span>
      </audio-ui-meter-mark>`;

/** Draws the meter into `element`, and returns what takes it away. Its look is the meter's sheet, on its parts and attributes. */
export default function meterWebDemo(element) {
  element.innerHTML = `
    <audio-ui-meter aria-label="Stereo output" data-marks="labels" data-size="default" scale="iec" warn-threshold="-12">${channel(0)}${channel(1)}${SCALE.map(mark).join("")}
    </audio-ui-meter>`;
  const simulated = createSimulatedLevels(2);
  const meter = element.querySelector("audio-ui-meter");
  if (meter) {
    meter.source = simulated.source;
  }
  const stop = simulated.run();
  return () => {
    stop();
    element.innerHTML = "";
  };
}
