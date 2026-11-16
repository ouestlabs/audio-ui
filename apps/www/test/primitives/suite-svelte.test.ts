import { flushSync, mount, unmount } from "svelte";
import Fixture from "./fixtures/knob.svelte";
import { knobSuite } from "./knob-suite.ts";

knobSuite("Svelte", (tree) => {
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
