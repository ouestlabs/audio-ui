import { flushSync, mount, unmount } from "svelte";
import Fixture from "./fixtures/sequencer.svelte";
import { sequencerSuite } from "./sequencer-suite.ts";

sequencerSuite("Svelte", ({ options, velocityBars }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = mount(Fixture, {
    props: { options, velocityBars },
    target: container,
  });
  flushSync();
  return Promise.resolve({
    act: (interact) => {
      interact();
      flushSync();
      return Promise.resolve();
    },
    container,
    unmount: () => {
      unmount(app);
      container.remove();
    },
  });
});
