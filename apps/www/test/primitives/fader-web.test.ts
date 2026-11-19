import "@/registry/primitives/fader/web/index.ts";
import { type FaderTree, faderSuite } from "./fader-suite.ts";

type FaderEvent = CustomEvent<{ reason: string; value: number }>;
const detailOf = (event: Event) => (event as FaderEvent).detail;

const kebab = (name: string) =>
  name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

/** The options as the custom fader's attributes, as an author writes them. */
function attributes(options: FaderTree["options"]) {
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

faderSuite("custom elements", async ({ label, marks, options, thumbLabel }) => {
  const container = document.body.appendChild(document.createElement("div"));
  container.innerHTML = `
    <audio-ui-fader ${attributes(options)}>
      ${label ? `<audio-ui-fader-label>${label}</audio-ui-fader-label>` : ""}
      <audio-ui-fader-control>
        <audio-ui-fader-track>
          <audio-ui-fader-indicator></audio-ui-fader-indicator>
          ${(marks ?? []).map((mark) => `<audio-ui-fader-mark value="${mark}"></audio-ui-fader-mark>`).join("")}
        </audio-ui-fader-track>
        <audio-ui-fader-thumb ${thumbLabel ? `aria-label="${thumbLabel}"` : ""}></audio-ui-fader-thumb>
      </audio-ui-fader-control>
      <audio-ui-fader-value></audio-ui-fader-value>
    </audio-ui-fader>`;
  const fader = container.querySelector("audio-ui-fader") as HTMLElement;
  // The callbacks are the fader's events, a cancel its preventDefault().
  fader.addEventListener("input", (event) => {
    const detail = detailOf(event);
    options.onValueChange(detail.value, {
      cancel: () => event.preventDefault(),
      reason: detail.reason,
    });
  });
  fader.addEventListener("change", (event) => {
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
