import { flushSync, mount, unmount } from "svelte";
import Fixture from "./fixtures/pad.svelte";
import { padSuite } from "./pad-suite.ts";

padSuite("Svelte", ({ options, pads }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = mount(Fixture, { props: { options, pads }, target: container });
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
