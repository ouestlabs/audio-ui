import "@/components/audio-ui/knob/web";
import type { NumberParameter } from "@/lib/engine/device";
import {
  type PolarisParam,
  type PolarisState,
  polarisDevice,
} from "../audio/device";

/**
 * Draws Polaris-1's panel into `root` from its description alone, with the
 * knob's custom elements and no framework: a knob per parameter, its range,
 * its scale and its default from the description, its value written by the
 * description's own `format`. It is what a plugin's web view would hold.
 * Returns what takes it away.
 */
export function drawPanel(
  root: HTMLElement,
  state: PolarisState,
  onChange: (id: PolarisParam, value: number) => void
) {
  const cleanups = polarisDevice.parameters.map((parameter) =>
    drawKnob(root, parameter, state[parameter.id], (value) =>
      onChange(parameter.id, value)
    )
  );
  return () => {
    for (const cleanup of cleanups) {
      cleanup();
    }
    root.replaceChildren();
  };
}

function drawKnob(
  root: HTMLElement,
  parameter: NumberParameter & { id: PolarisParam },
  value: number,
  onChange: (value: number) => void
) {
  const cell = document.createElement("div");
  cell.className = "polaris-cell";

  const knob = document.createElement("audio-ui-knob");
  knob.className = "polaris-knob";
  const attributes: Record<string, number | string | undefined> = {
    "default-value": parameter.default,
    max: parameter.max,
    min: parameter.min,
    scale: typeof parameter.scale === "string" ? parameter.scale : undefined,
    step: parameter.step,
    value,
  };
  for (const [name, attribute] of Object.entries(attributes)) {
    if (attribute !== undefined) {
      knob.setAttribute(name, String(attribute));
    }
  }
  knob.innerHTML = `
    <audio-ui-knob-control class="polaris-control">
      <audio-ui-knob-track class="polaris-track"></audio-ui-knob-track>
      <audio-ui-knob-indicator class="polaris-indicator"></audio-ui-knob-indicator>
      <audio-ui-knob-thumb class="polaris-thumb"></audio-ui-knob-thumb>
    </audio-ui-knob-control>`;
  knob
    .querySelector("audio-ui-knob-thumb")
    ?.setAttribute("aria-label", parameter.label);

  const label = document.createElement("span");
  label.className = "polaris-label";
  label.textContent = parameter.label;
  const readout = document.createElement("output");
  readout.className = "polaris-readout";
  readout.textContent = polarisDevice.format(parameter.id, value);

  const input = (event: Event) => {
    const next = (event as CustomEvent<{ value: number }>).detail.value;
    readout.textContent = polarisDevice.format(parameter.id, next);
    onChange(next);
  };
  knob.addEventListener("input", input);

  cell.append(label, knob, readout);
  root.append(cell);
  return () => knob.removeEventListener("input", input);
}
