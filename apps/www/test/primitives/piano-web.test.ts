import { pitchName } from "@audio-ui/core";
import "@/registry-audio/bases/base/primitives/piano/web.ts";
import { type PianoTree, pianoSuite } from "./piano-suite.ts";

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The options as the custom keyboard's attributes, as an author writes them: callbacks are events. */
function attributes(options: PianoTree["options"]) {
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

pianoSuite("custom elements", async ({ labels, options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  // The keys are made by the keyboard, unless the author writes them, as a label needs.
  const written = labels
    ? [60, 61, 62]
        .map(
          (pitch) =>
            `<audio-ui-piano-key pitch="${pitch}"><button aria-label="${pitchName(pitch)}"><audio-ui-piano-label></audio-ui-piano-label></button></audio-ui-piano-key>`
        )
        .join("")
    : "";
  container.innerHTML = `<audio-ui-piano ${attributes(options)}>${written}</audio-ui-piano>`;
  const keyboard = container.querySelector("audio-ui-piano") as HTMLElement;
  // The callbacks are the keyboard's events, a cancel its preventDefault().
  keyboard.addEventListener("noteon", (event) => {
    const { detail } = event as Event as CustomEvent<{
      reason: string;
      source?: string;
      value: number;
      velocity: number;
    }>;
    options.onNoteOn(detail.value, {
      cancel: () => event.preventDefault(),
      reason: detail.reason,
      source: detail.source,
      velocity: detail.velocity,
    });
  });
  keyboard.addEventListener("noteoff", (event) => {
    const { detail } = event as Event as CustomEvent<{
      reason: string;
      value: number;
    }>;
    options.onNoteOff(detail.value, { reason: detail.reason });
  });
  await Promise.resolve();
  await Promise.resolve();
  // What an author writes is drawn once the observer of its children has run.
  await new Promise((resolve) => setTimeout(resolve, 0));
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
