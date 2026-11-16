import { flushSync, mount, unmount } from "svelte";
import Fixture from "./fixtures/plot.svelte";
import { plotSuite } from "./plot-suite.ts";

plotSuite("Svelte", (tree) => {
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
