import { flushSync, mount, unmount } from "svelte";
import Fixture from "./fixtures/piano-roll.svelte";
import { pianoRollSuite } from "./piano-roll-suite.ts";

pianoRollSuite("Svelte", (tree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = mount(Fixture, { props: { tree }, target: container });
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
