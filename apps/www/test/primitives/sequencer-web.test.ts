import "@/registry-audio/bases/base/primitives/sequencer/web.ts";
import { type SequencerTree, sequencerSuite } from "./sequencer-suite.ts";

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The options as the custom sequencer's attributes, as an author writes them: a source is a property. */
function attributes(options: SequencerTree["options"]) {
  const written: string[] = [];
  for (const [name, value] of Object.entries(options)) {
    if (
      name === "source" ||
      typeof value === "function" ||
      value === false ||
      value === undefined
    ) {
      continue;
    }
    const text = typeof value === "object" ? JSON.stringify(value) : value;
    written.push(value === true ? kebab(name) : `${kebab(name)}='${text}'`);
  }
  return written.join(" ");
}

sequencerSuite("custom elements", async ({ options, velocityBars }) => {
  const container = document.body.appendChild(document.createElement("div"));
  container.innerHTML = `<audio-ui-sequencer ${attributes(options)} ${velocityBars ? "velocity-bars" : ""}></audio-ui-sequencer>`;
  const sequencer = container.querySelector(
    "audio-ui-sequencer"
  ) as HTMLElement & {
    source?: unknown;
  };
  if (options.source) {
    sequencer.source = options.source;
  }
  // The callbacks are the sequencer's events, a cancel its preventDefault().
  sequencer.addEventListener("input", (event) => {
    const { detail } = event as Event as CustomEvent<{
      reason: string;
      value: boolean[][];
    }>;
    options.onValueChange(detail.value, {
      cancel: () => event.preventDefault(),
      reason: detail.reason,
    });
  });
  sequencer.addEventListener("change", (event) => {
    const { detail } = event as Event as CustomEvent<{
      reason: string;
      value: boolean[][];
    }>;
    options.onValueCommitted(detail.value, { reason: detail.reason });
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
