import { describe, expect, mock, test } from "bun:test";
import { act, fireEvent, render, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { useCallback, useState } from "react";
import { defineDevice } from "@/engine/device";

// The list a long choice goes in is the site's own select, which asks the router where it is.
mock.module("@tanstack/react-router", () => ({
  useLocation: ({ select }: { select: (l: { pathname: string }) => string }) =>
    select({ pathname: "/" }),
}));
const { DeviceHeader, DevicePanel } = await import(
  "@/registry/bases/shared/audio-ui/panels/device-panel"
);

// A device the registry has never heard of: the panel is made from its descriptors.
const tremolo = defineDevice({
  description: "Moves the level up and down.",
  id: "acme.tremolo",
  name: "Tremolo",
  parameters: [
    { default: true, id: "on", kind: "toggle", label: "Active" },
    {
      default: 5,
      id: "rate",
      label: "Rate",
      max: 20,
      min: 0.5,
      scale: "log",
      step: 0.5,
      unit: "Hz",
    },
    {
      default: 50,
      id: "depth",
      label: "Depth",
      max: 100,
      min: 0,
      step: 1,
      unit: "%",
    },
  ],
});

function setup(
  value = tremolo.defaults(),
  options: {
    disabled?: readonly string[];
    exclude?: readonly string[];
    groups?: { label: string; parameters: readonly string[] }[];
  } = {}
) {
  const onValueChange = mock((_state: unknown) => undefined);
  const view = render(
    <DevicePanel
      device={tremolo}
      disabled={options.disabled as never}
      exclude={options.exclude as never}
      groups={options.groups as never}
      onValueChange={onValueChange}
      value={value}
    />
  );
  return { onValueChange, view: within(view.container) };
}

describe("DevicePanel", () => {
  test("is a group named after the device", () => {
    const { view } = setup();
    expect(view.getByRole("group", { name: "Tremolo" })).toBeTruthy();
  });

  test("makes a knob per number and a toggle per switch, from the descriptors", () => {
    const { view } = setup();
    expect(
      view
        .getAllByRole("slider")
        .map((slider) => slider.getAttribute("aria-label"))
    ).toEqual(["Rate", "Depth"]);
    expect(
      view.getByRole("button", { name: "Active" }).getAttribute("aria-pressed")
    ).toBe("true");
  });

  test("prints a value as the device formats it, with its unit", () => {
    const { view } = setup();
    expect(
      view.getByRole("slider", { name: "Rate" }).getAttribute("aria-valuetext")
    ).toBe("5.0 Hz");
    expect(
      view.getByRole("slider", { name: "Depth" }).getAttribute("aria-valuetext")
    ).toBe("50 %");
  });

  test("draws the state it is given and keeps none of its own", () => {
    const { view } = setup(tremolo.set(tremolo.defaults(), "depth", 80));
    const depth = view.getByRole("slider", {
      name: "Depth",
    }) as HTMLInputElement;
    expect(depth.value).toBe("80");
  });

  test("a toggle sends the whole new state, through the device", () => {
    const { onValueChange, view } = setup();
    fireEvent.click(view.getByRole("button", { name: "Active" }));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.calls[0]?.[0]).toEqual({
      depth: 50,
      on: false,
      rate: 5,
    });
  });

  test("a key on a knob sends a state with that parameter changed and inside its bounds", () => {
    const { onValueChange, view } = setup(
      tremolo.set(tremolo.defaults(), "depth", 100)
    );
    const slider = view.getByRole("slider", { name: "Depth" });
    fireEvent.keyDown(slider, { key: "ArrowUp" });
    for (const [state] of onValueChange.mock.calls) {
      expect((state as { depth: number }).depth).toBeLessThanOrEqual(100);
    }
    fireEvent.keyDown(slider, { key: "ArrowDown" });
    expect(onValueChange).toHaveBeenCalled();
    const [[state]] = onValueChange.mock.calls.slice(-1) as [
      [{ depth: number }],
    ];
    expect(state.depth).toBe(99);
  });

  test("leaves out the parameters it is told to", () => {
    const { view } = setup(tremolo.defaults(), { exclude: ["rate"] });
    expect(
      view
        .getAllByRole("slider")
        .map((slider) => slider.getAttribute("aria-label"))
    ).toEqual(["Depth"]);
  });

  test("a switch is one button with its own label, not a label twice", () => {
    const { view } = setup();
    expect(view.getAllByText("Active")).toHaveLength(1);
    expect(view.getByRole("button", { name: "Active" }).textContent).toBe(
      "Active"
    );
  });

  test("gathers parameters under a named group, in order, and the rest after", () => {
    const { view } = setup(tremolo.defaults(), {
      groups: [{ label: "Motion", parameters: ["rate"] }],
    });
    const motion = view.getByRole("group", { name: "Motion" });
    expect(
      within(motion)
        .getAllByRole("slider")
        .map((slider) => slider.getAttribute("aria-label"))
    ).toEqual(["Rate"]);
    // Depth and the switch are in no group: they still show.
    expect(view.getByRole("slider", { name: "Depth" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Active" })).toBeTruthy();
  });

  test("draws a knob off when told it has no effect for now", () => {
    const { view } = setup(tremolo.defaults(), { disabled: ["rate"] });
    expect(
      (view.getByRole("slider", { name: "Rate" }) as HTMLInputElement).disabled
    ).toBe(true);
    expect(
      (view.getByRole("slider", { name: "Depth" }) as HTMLInputElement).disabled
    ).toBe(false);
  });
});

describe("DevicePanel with a choice", () => {
  const voice = defineDevice({
    description: "A voice.",
    id: "acme.voice",
    kind: "instrument",
    name: "Voice",
    parameters: [
      {
        default: "square",
        id: "wave",
        kind: "choice",
        label: "Wave",
        options: [
          { label: "Sine", value: "sine" },
          { label: "Square", value: "square" },
        ],
      },
    ],
  });

  test("draws a choice of waveforms as the waves, the picked one pressed, and a press sets it", () => {
    const onValueChange = mock((_state: unknown) => undefined);
    const view = render(
      <DevicePanel
        device={voice}
        onValueChange={onValueChange}
        value={voice.defaults()}
      />
    );
    const group = view.getByRole("group", { name: "Wave" });
    expect(within(group).getAllByRole("button")).toHaveLength(2);
    expect(
      view
        .getByRole("button", { name: "Square wave" })
        .getAttribute("aria-pressed")
    ).toBe("true");
    fireEvent.click(view.getByRole("button", { name: "Sine wave" }));
    expect(onValueChange).toHaveBeenCalledWith({ wave: "sine" });
  });

  test("a label that starts with its group's name drops it, the accessible name keeps it", () => {
    const device = defineDevice({
      description: "x",
      id: "acme.bands",
      name: "Bands",
      parameters: [
        { default: 1, id: "lowGain", label: "Low gain", max: 2, min: 0 },
      ],
    });
    const view = render(
      <DevicePanel
        device={device}
        groups={[{ label: "Low", parameters: ["lowGain"] }]}
        onValueChange={mock((_state: unknown) => undefined)}
        value={device.defaults()}
      />
    );
    expect(view.getByText("Gain")).toBeTruthy();
    expect(view.getByRole("slider", { name: "Low gain" })).toBeTruthy();
  });
});

describe("DevicePanel with a long choice", () => {
  const notes = defineDevice({
    description: "A note value.",
    id: "acme.notes",
    name: "Notes",
    parameters: [
      {
        default: "a",
        id: "note",
        kind: "choice",
        label: "Note",
        options: ["a", "b", "c", "d", "e", "f", "g", "h"].map((value) => ({
          label: value.toUpperCase(),
          value,
        })),
      },
    ],
  });

  test("more options than fit as buttons go in a list, and the list can be drawn off", () => {
    const view = render(
      <NuqsTestingAdapter>
        <DevicePanel
          device={notes}
          disabled={["note"]}
          onValueChange={mock((_state: unknown) => undefined)}
          value={notes.defaults()}
        />
      </NuqsTestingAdapter>
    );
    expect(view.queryAllByRole("button", { name: "A" })).toHaveLength(0);
    const trigger = view.getByRole("combobox", { name: "Note" });
    expect(trigger).toBeTruthy();
    expect(
      trigger.hasAttribute("disabled") ||
        trigger.getAttribute("aria-disabled") === "true" ||
        trigger.hasAttribute("data-disabled")
    ).toBe(true);
  });
});

/** A host that stores each change, as one that records automation does, and notes what it hears in order. */
function Host({ heard }: { heard: unknown[][] }) {
  const [state, setState] = useState(tremolo.defaults);
  const change = useCallback(
    (next: typeof state) => {
      heard.push(["change", next]);
      setState(next);
    },
    [heard]
  );
  const commit = useCallback(
    (next: typeof state, id: string) => heard.push(["commit", next, id]),
    [heard]
  );
  return (
    <>
      <DeviceHeader
        activator="on"
        device={tremolo}
        onValueChange={change}
        onValueCommitted={commit}
        value={state}
      />
      <DevicePanel
        device={tremolo}
        exclude={["on"]}
        onValueChange={change}
        onValueCommitted={commit}
        value={state}
      />
    </>
  );
}

function hosted() {
  const heard: unknown[][] = [];
  const view = render(<Host heard={heard} />);
  return { heard, view: within(view.container) };
}

describe("the end of a change", () => {
  test("a key on a knob changes the value, then commits it with the parameter's id", () => {
    const { heard, view } = hosted();
    fireEvent.keyDown(view.getByRole("slider", { name: "Depth" }), {
      key: "ArrowDown",
    });
    const state = { depth: 49, on: true, rate: 5 };
    expect(heard).toEqual([
      ["change", state],
      ["commit", state, "depth"],
    ]);
  });

  test("a drag on a knob commits once, when it is let go", async () => {
    const { heard, view } = hosted();
    const control = view
      .getByRole("slider", { name: "Depth" })
      .closest('[data-slot="knob"]')
      ?.querySelector('[data-slot="knob-control"]') as HTMLElement;
    const move = async (type: string, clientY: number) => {
      fireEvent(
        control,
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          buttons: type === "pointerup" ? 0 : 1,
          clientX: 50,
          clientY,
          pointerId: 1,
        })
      );
      // A drag reports its moves on the next frame.
      await act(() => new Promise((resolve) => setTimeout(resolve, 30)));
    };
    await move("pointerdown", 90);
    await move("pointermove", 80);
    await move("pointermove", 70);
    expect(heard.length).toBeGreaterThan(0);
    expect(heard.every(([kind]) => kind === "change")).toBe(true);
    await move("pointerup", 70);
    const commits = heard.filter(([kind]) => kind === "commit");
    expect(commits).toEqual([["commit", heard.at(-2)?.[1], "depth"]]);
  });

  test("a press on the header's switch is a whole change", () => {
    const { heard, view } = hosted();
    fireEvent.click(view.getByRole("button", { name: "Active" }));
    const state = { depth: 50, on: false, rate: 5 };
    expect(heard).toEqual([
      ["change", state],
      ["commit", state, "on"],
    ]);
  });
});
