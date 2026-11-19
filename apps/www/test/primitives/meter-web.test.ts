import "@/registry/primitives/meter/web/index.ts";
import { decibels, type MeterTree, meterSuite } from "./meter-suite.ts";

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** Options a custom element reads from attributes, as an author writes them: a source is a property. */
function attributes(options: MeterTree["options"]) {
  const written: string[] = [];
  for (const [name, value] of Object.entries(options)) {
    if (name === "source" || typeof value === "function" || value === false) {
      continue;
    }
    const text = typeof value === "object" ? JSON.stringify(value) : value;
    written.push(value === true ? kebab(name) : `${kebab(name)}='${text}'`);
  }
  return written.join(" ");
}

meterSuite(
  "custom elements",
  async ({ count, labels, marks, options }) => {
    const container = document.body.appendChild(document.createElement("div"));
    const channels = Array.from(
      { length: count },
      (_, index) => `
        <audio-ui-meter-channel index="${index}" aria-label="Output ${index + 1}">
          <audio-ui-meter-track>
            <audio-ui-meter-indicator></audio-ui-meter-indicator>
            <audio-ui-meter-peak></audio-ui-meter-peak>
          </audio-ui-meter-track>
          ${labels ? "<audio-ui-meter-label>Channel</audio-ui-meter-label>" : ""}
          <audio-ui-meter-value></audio-ui-meter-value>
        </audio-ui-meter-channel>`
    ).join("");
    container.innerHTML = `
      <audio-ui-meter aria-label="Output" ${attributes(options)}>
        ${(marks ?? []).map((mark) => `<audio-ui-meter-mark value="${mark}"></audio-ui-meter-mark>`).join("")}
        ${channels}
      </audio-ui-meter>`;
    const meter = container.querySelector("audio-ui-meter") as HTMLElement & {
      source?: unknown;
    };
    if (options.source) {
      meter.source = options.source;
    }
    for (const channel of container.querySelectorAll<
      HTMLElement & { getAriaValueText?: unknown }
    >("audio-ui-meter-channel")) {
      channel.getAriaValueText = decibels;
    }
    await Promise.resolve();
    return {
      act: async (interact) => {
        interact();
        await Promise.resolve();
      },
      container,
      unmount: () => container.remove(),
    };
  },
  // The channels are written in the markup: a count that follows a source is not.
  { dynamicCount: false }
);
