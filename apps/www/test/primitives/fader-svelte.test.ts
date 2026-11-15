import { flushSync, mount, unmount } from "svelte";
import { faderSuite } from "./fader-suite.ts";
import Fixture from "./fixtures/fader.svelte";

faderSuite("Svelte", (tree) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = mount(Fixture, { props: tree, target: container });
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
