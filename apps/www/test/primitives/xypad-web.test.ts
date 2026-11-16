import "@/registry-audio/bases/base/primitives/xypad/web/index.ts";
import { type XYPadTree, xypadSuite } from "./xypad-suite.ts";

type PadEvent = CustomEvent<{
  reason: string;
  value: { x: number; y: number };
}>;
const detailOf = (event: Event) => (event as PadEvent).detail;

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The options as the custom pad's attributes, as an author writes them. */
function attributes(options: XYPadTree["options"]) {
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

xypadSuite("custom elements", async ({ label, options, thumbLabel }) => {
  const container = document.body.appendChild(document.createElement("div"));
  container.innerHTML = `
    <audio-ui-xypad ${attributes(options)}>
      ${label ? `<audio-ui-xypad-label>${label}</audio-ui-xypad-label>` : ""}
      <audio-ui-xypad-control>
        <audio-ui-xypad-thumb ${thumbLabel ? `aria-label="${thumbLabel}"` : ""}></audio-ui-xypad-thumb>
      </audio-ui-xypad-control>
      <audio-ui-xypad-value></audio-ui-xypad-value>
    </audio-ui-xypad>`;
  const pad = container.querySelector("audio-ui-xypad") as HTMLElement;
  // The callbacks are the pad's events, a cancel its preventDefault().
  pad.addEventListener("input", (event) => {
    const detail = detailOf(event);
    options.onValueChange(detail.value, {
      cancel: () => event.preventDefault(),
      reason: detail.reason,
    });
  });
  pad.addEventListener("change", (event) => {
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
});
