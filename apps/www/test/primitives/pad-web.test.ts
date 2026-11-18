import "@/registry/bases/base/primitives/pad/web/index.ts";
import { type PadTree, padSuite } from "./pad-suite.ts";

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The options as the custom grid's attributes, as an author writes them: callbacks are events. */
function attributes(options: PadTree["options"]) {
  const written: string[] = [];
  for (const [name, value] of Object.entries(options)) {
    if (typeof value === "function" || value === false || value === undefined) {
      continue;
    }
    const text = typeof value === "object" ? JSON.stringify(value) : value;
    written.push(value === true ? kebab(name) : `${kebab(name)}='${text}'`);
  }
  return written.join(" ");
}

padSuite("custom elements", async ({ options, pads }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const items = pads
    .map(
      (pad) => `
        <audio-ui-pad-item value="${pad.value}" ${pad.chokeGroup ? `choke-group="${pad.chokeGroup}"` : ""} ${pad.disabled ? "disabled" : ""}>
          <button>${pad.value}</button>
        </audio-ui-pad-item>`
    )
    .join("");
  container.innerHTML = `<audio-ui-pad ${attributes(options)}>${items}</audio-ui-pad>`;
  const grid = container.querySelector("audio-ui-pad") as HTMLElement;
  // The callbacks are the grid's events, a cancel its preventDefault().
  grid.addEventListener("padon", (event) => {
    const { detail } = event as Event as CustomEvent<{
      reason: string;
      source?: string;
      value: string;
      velocity: number;
    }>;
    options.onPadOn(detail.value, {
      cancel: () => event.preventDefault(),
      reason: detail.reason,
      source: detail.source,
      velocity: detail.velocity,
    });
  });
  grid.addEventListener("padoff", (event) => {
    const { detail } = event as Event as CustomEvent<{
      reason: string;
      value: string;
    }>;
    options.onPadOff(detail.value, { reason: detail.reason });
  });
  await Promise.resolve();
  await Promise.resolve();
  return {
    act: async (interact) => {
      interact();
      await Promise.resolve();
      await Promise.resolve();
    },
    container,
    unmount: () => container.remove(),
  };
});
