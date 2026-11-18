import "@/registry/bases/base/primitives/knob/web/index.ts";
import { type KnobTree, knobSuite } from "./knob-suite.ts";

type KnobEvent = CustomEvent<{ reason: string; value: number }>;
const detailOf = (event: Event) => (event as KnobEvent).detail;

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The options as the custom knob's attributes, as an author writes them. */
function attributes(options: KnobTree["options"]) {
  const written: string[] = [];
  for (const [name, value] of Object.entries(options)) {
    if (typeof value === "function" || value === false) {
      continue;
    }
    const text = typeof value === "object" ? JSON.stringify(value) : value;
    written.push(value === true ? kebab(name) : `${kebab(name)}='${text}'`);
  }
  return written.join(" ");
}

knobSuite(
  "custom elements",
  async ({ label, options, thumbLabel }) => {
    const container = document.body.appendChild(document.createElement("div"));
    container.innerHTML = `
    <audio-ui-knob ${attributes(options)}>
      ${label ? `<audio-ui-knob-label>${label}</audio-ui-knob-label>` : ""}
      <audio-ui-knob-control>
        <audio-ui-knob-track></audio-ui-knob-track>
        <audio-ui-knob-indicator></audio-ui-knob-indicator>
        <audio-ui-knob-thumb ${thumbLabel ? `aria-label="${thumbLabel}"` : ""}></audio-ui-knob-thumb>
      </audio-ui-knob-control>
      <audio-ui-knob-value></audio-ui-knob-value>
    </audio-ui-knob>`;
    const knob = container.querySelector("audio-ui-knob") as HTMLElement;
    // The callbacks are the knob's events, a cancel its preventDefault().
    knob.addEventListener("input", (event) => {
      const detail = detailOf(event);
      options.onValueChange(detail.value, {
        cancel: () => event.preventDefault(),
        reason: detail.reason,
      });
    });
    knob.addEventListener("change", (event) => {
      const detail = detailOf(event);
      options.onValueCommitted(detail.value, { reason: detail.reason });
    });
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
  // Neither the published custom elements nor these have a provider.
  { provider: false }
);
