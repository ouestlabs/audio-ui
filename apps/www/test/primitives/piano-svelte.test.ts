import { flushSync, mount, unmount } from "svelte";
import Fixture from "./fixtures/piano.svelte";
import { pianoSuite } from "./piano-suite.ts";

pianoSuite("Svelte", ({ labels, options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = mount(Fixture, { props: { labels, options }, target: container });
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
