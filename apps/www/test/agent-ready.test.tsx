import { afterEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";

// happy-dom lacks the popover and layout APIs the ui-sdk popups read.
HTMLElement.prototype.showPopover = () => undefined;
HTMLElement.prototype.hidePopover = () => undefined;
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = () => undefined;

// Bun's mocks outlive the file, so every export of lib/utils stays: it reaches the SEO helpers
// and, through them, the registry's lookup, a Vite glob that Bun does not have.
const { cn } = await import("cn");
const TRAILING_SLASH = /\/$/;
mock.module("@/lib/utils", () => ({
  absoluteUrl: (path: string) =>
    new URL(path, "https://www.audio-ui.dev/").toString(),
  cn,
  formatLabel: (value: string) =>
    value
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  isActive: (pathname: string, href: string) =>
    pathname.replace(TRAILING_SLASH, "") === href.replace(TRAILING_SLASH, ""),
  isFileUrl: (url: string) => url.includes("."),
  normalizeSlug: (value: string) => value.toLowerCase().replaceAll(" ", "-"),
}));
const { default: SequencerDemo } = await import(
  "@/registry/bases/shared/components/sequencer/react/sequencer-demo"
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
  agent
    .snapshot()
    .filter((entry) => !entry.offPage && entry.component !== "more");

describe("the drum machine demo, for an agent", () => {
  test("every control in the snapshot has a name an agent can find", () => {
    render(<SequencerDemo />);
    const entries = named();
    for (const entry of entries) {
      expect(
        entry.label,
        `${entry.component} ${entry.ref} has no name`
      ).toBeTruthy();
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
