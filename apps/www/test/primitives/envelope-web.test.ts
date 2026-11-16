import "@/registry-audio/bases/base/primitives/envelope/web/index.ts";
import { type EnvelopeTree, envelopeSuite } from "./envelope-suite.ts";

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The options as the custom envelope's attributes, as an author writes them. */
function attributes(options: EnvelopeTree["options"]) {
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

envelopeSuite("custom elements", async ({ options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  // The points and the handles are made by the envelope: only the drawing is written.
  container.innerHTML = `
    <audio-ui-envelope ${attributes(options)}>
      <audio-ui-envelope-graph>
        <audio-ui-envelope-fill></audio-ui-envelope-fill>
        <audio-ui-envelope-line></audio-ui-envelope-line>
      </audio-ui-envelope-graph>
    </audio-ui-envelope>`;
  const envelope = container.querySelector("audio-ui-envelope") as HTMLElement;
  // The callbacks are the envelope's events, a cancel its preventDefault().
  envelope.addEventListener("input", (event) => {
    const { detail } = event as Event as CustomEvent<{
      index?: number;
      reason: string;
      value: never;
    }>;
    options.onValueChange(detail.value, {
      cancel: () => event.preventDefault(),
      index: detail.index,
      reason: detail.reason,
    });
  });
  envelope.addEventListener("change", (event) => {
    const { detail } = event as Event as CustomEvent<{
      index?: number;
      reason: string;
      value: never;
    }>;
    options.onValueCommitted(detail.value, {
      index: detail.index,
      reason: detail.reason,
    });
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
