import { flushSync, mount, unmount } from "svelte";
import Fixture from "./fixtures/meter.svelte";
import { decibels, meterSuite } from "./meter-suite.ts";

meterSuite("Svelte", ({ labels, marks, options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = mount(Fixture, {
    props: { decibels, labels, marks, options },
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
