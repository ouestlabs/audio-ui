import { flushSync, mount, unmount } from "svelte";
import Fixture from "./fixtures/xypad.svelte";
import { xypadSuite } from "./xypad-suite.ts";

xypadSuite("Svelte", (tree) => {
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
