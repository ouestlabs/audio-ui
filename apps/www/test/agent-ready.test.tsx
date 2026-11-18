import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";

// happy-dom lacks the popover and layout APIs the ui-sdk popups read.
HTMLElement.prototype.showPopover = () => undefined;
HTMLElement.prototype.hidePopover = () => undefined;
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = () => undefined;
globalThis.ResizeObserver ??= class {
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
  disconnect() {
    return undefined;
  }
};

// `cn` sits beside the SEO helpers, which load the registry through Vite's glob: Bun has none.
mock.module("@/lib/seo/seo", () => ({ absoluteUrl: (path: string) => path }));
const { default: SequencerDemo } = await import(
  "@/registry/bases/base/components/sequencer/react/sequencer-demo"
);

let approved = false;
const agent = createAgent({
  allow: (step) => !step.confirm || approved,
});

afterEach(() => {
  cleanup();
  approved = false;
});

const named = () =>
  agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");

describe("the drum machine demo, for an agent", () => {
  test("every control in the snapshot has a name an agent can find", () => {
    render(<SequencerDemo />);
    const entries = named();
    for (const entry of entries) {
      expect(entry.label, `${entry.component} ${entry.ref} has no name`).toBeTruthy();
    }
    const labels = entries.map((entry) => entry.label);
    expect(labels).toContain("Play");
    expect(labels).toContain("Clear");
  });

  test("Clear is a person's decision: refused until approved, then it runs", async () => {
    const { container } = render(<SequencerDemo />);
    const marked = container.querySelector("[data-agent-confirm]");
    expect(marked?.textContent).toBe("Clear");
    const clear = {
      steps: [{ action: "press", ref: "Clear" }],
    };

    const refused = await agent.act(clear);
    expect(refused.ok).toBe(false);

    approved = true;
    const done = await agent.act(clear);
    expect(done.ok, done.error?.message).toBe(true);
  });
});
