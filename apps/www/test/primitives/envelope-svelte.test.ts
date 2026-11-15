import { flushSync, mount, unmount } from "svelte";
import { envelopeSuite } from "./envelope-suite.ts";
import Fixture from "./fixtures/envelope.svelte";

envelopeSuite("Svelte", ({ options }) => {
  const container = document.body.appendChild(document.createElement("div"));
  const app = mount(Fixture, { props: { options }, target: container });
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
