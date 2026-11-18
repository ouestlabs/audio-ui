import { afterEach, describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { createAgent } from "@ui-sdk/react/agent";
import { useState } from "react";

// The icons come from the design system's provider and the site's utils reach its SEO: a test needs neither.
mock.module("@/components/icon-placeholder", () => ({
  IconPlaceholder: () => null,
}));
mock.module("@/lib/utils", () => ({
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(" "),
}));

const { Button } = await import("@/registry-audio/bases/ui-sdk/ui/button");
const { ButtonGroup, ButtonGroupText } = await import(
  "@/registry-audio/bases/ui-sdk/ui/button-group"
);
const {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} = await import("@/registry-audio/bases/ui-sdk/ui/dropdown-menu");
const { Input } = await import("@/registry-audio/bases/ui-sdk/ui/input");
const {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} = await import("@/registry-audio/bases/ui-sdk/ui/select");
const { Slider } = await import("@/registry-audio/bases/ui-sdk/ui/slider");
const { Tabs, TabsContent, TabsList, TabsTrigger } = await import(
  "@/registry-audio/bases/ui-sdk/ui/tabs"
);
const { Toggle } = await import("@/registry-audio/bases/ui-sdk/ui/toggle");

// What ui-sdk expects of a DOM, and happy-dom leaves out.
HTMLElement.prototype.showPopover = () => undefined;
HTMLElement.prototype.hidePopover = () => undefined;
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = () => undefined;
Element.prototype.checkVisibility = () => true;
globalThis.ResizeObserver ??= class {
  observe = () => undefined;
  unobserve = () => undefined;
  disconnect = () => undefined;
};
(
  globalThis as typeof globalThis & { __UI_SDK_STRICT__?: boolean }
).__UI_SDK_STRICT__ = true;

const SPEEDS = [
  { label: "Slow", value: "slow" },
  { label: "Fast", value: "fast" },
] as const;

const settled = () => act(() => new Promise<void>((done) => setTimeout(done)));

afterEach(async () => {
  await settled();
});

describe("a popup of the ui-sdk base", () => {
  test("renders in the page's body, so a button group never holds it", async () => {
    render(
      <ButtonGroup>
        <Button aria-label="Undo">Undo</Button>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger aria-label="View" render={<Button />}>
            View
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Waveform</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </ButtonGroup>
    );
    await settled();
    const menu = await screen.findByRole("menu");
    expect(menu.closest("[data-slot=button-group]")).toBeNull();
    expect(menu.closest("body")).not.toBeNull();
  });
});

describe("the menu's shadcn API", () => {
  function Rows() {
    const [row, setRow] = useState(2);
    return (
      <>
        <output aria-label="row">{row}</output>
        <output aria-label="row type">{typeof row}</output>
        <DropdownMenu defaultOpen>
          <DropdownMenuTrigger aria-label="Rows" render={<Button />}>
            Rows
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuRadioGroup onValueChange={setRow} value={row}>
              <DropdownMenuRadioItem value={2}>Two</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value={5}>Five</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  test("a radio group over numbers gives its callback a number", async () => {
    render(<Rows />);
    await settled();
    const five = await screen.findByRole("menuitemradio", { name: "Five" });
    expect(
      screen
        .getByRole("menuitemradio", { name: "Two" })
        .getAttribute("aria-checked")
    ).toBe("true");
    act(() => {
      fireEvent.click(five);
    });
    await settled();
    expect(screen.getByLabelText("row").textContent).toBe("5");
    expect(screen.getByLabelText("row type").textContent).toBe("number");
    expect(five.getAttribute("aria-checked")).toBe("true");
  });
});

describe("the select's shadcn API", () => {
  test("takes its items as a const list, with the items straight in the content", async () => {
    render(
      <Select defaultOpen defaultValue="slow" items={SPEEDS}>
        <SelectTrigger aria-label="Speed">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {SPEEDS.map((speed) => (
              <SelectItem key={speed.value} value={speed.value}>
                {speed.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    await settled();
    const trigger = screen.getByRole("combobox", { name: "Speed" });
    expect(trigger.textContent).toContain("Slow");
    // A group without a label is no group: its items are the content's own.
    expect(document.querySelector("[data-slot=select-group]")).toBeNull();
    expect(screen.getAllByRole("option")).toHaveLength(2);
  });
});

describe("the tabs", () => {
  test("move focus with the arrows and select on a press", async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList aria-label="Letters">
          <TabsTrigger value="a">A</TabsTrigger>
          <TabsTrigger value="b">B</TabsTrigger>
        </TabsList>
        <TabsContent value="a">First</TabsContent>
        <TabsContent value="b">Second</TabsContent>
      </Tabs>
    );
    await settled();
    const [a, b] = screen.getAllByRole("tab");
    act(() => a?.focus());
    act(() => {
      fireEvent.keyDown(a as Element, { key: "ArrowRight" });
    });
    expect(document.activeElement).toBe(b as Element);
    expect(a?.getAttribute("aria-selected")).toBe("true");
    act(() => {
      fireEvent.click(b as Element);
    });
    expect(b?.getAttribute("aria-selected")).toBe("true");
  });
});

describe("the fields", () => {
  test("an input takes a number as its value", () => {
    render(<Input aria-label="A4" readOnly type="number" value={442} />);
    expect(screen.getByLabelText<HTMLInputElement>("A4").value).toBe("442");
  });

  test("a button that renders a link needs no flag and leaves none in the page", () => {
    render(
      <Button nativeButton={false} render={<a href="/docs" />}>
        Docs
      </Button>
    );
    const link = screen.getByRole("link", { name: "Docs" });
    expect(link.getAttribute("href")).toBe("/docs");
    expect(link.hasAttribute("nativebutton")).toBe(false);
  });
});

describe("an agent", () => {
  function Panel() {
    const [speed, setSpeed] = useState<string | null>("slow");
    return (
      <>
        <Button>Save</Button>
        <Toggle aria-label="Mute">M</Toggle>
        <Input aria-label="Name" defaultValue="Apollo" />
        <Slider aria-label="Volume" defaultValue={50} />
        <Select items={SPEEDS} onValueChange={setSpeed} value={speed}>
          <SelectTrigger aria-label="Speed">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SPEEDS.map((each) => (
              <SelectItem key={each.value} value={each.value}>
                {each.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ButtonGroup>
          <ButtonGroupText>Rate</ButtonGroupText>
        </ButtonGroup>
        <output aria-label="speed">{speed}</output>
      </>
    );
  }

  test("finds every control by name and changes them", async () => {
    const agent = createAgent();
    render(<Panel />);
    await settled();

    const entries = agent
      .snapshot()
      .filter((entry) => !entry.offPage && entry.component !== "more");
    for (const entry of entries) {
      expect(
        entry.label,
        `${entry.component} ${entry.ref} has no name`
      ).toBeTruthy();
    }
    const labels = entries.map((entry) => entry.label);
    for (const label of ["Save", "Mute", "Name", "Volume", "Speed"]) {
      expect(labels, `${label} is missing from the snapshot`).toContain(label);
    }

    const result = await agent.act({
      steps: [
        { action: "setValue", args: ["Atlas"], ref: "Name" },
        { action: "setValue", args: ["fast"], ref: "Speed" },
      ],
    });
    expect(result.ok, result.error?.message).toBe(true);
    await settled();
    expect(screen.getByLabelText<HTMLInputElement>("Name").value).toBe("Atlas");
    expect(screen.getByLabelText("speed").textContent).toBe("fast");
  });
});
