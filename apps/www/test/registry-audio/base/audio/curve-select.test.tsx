import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { CurveSelect } from "@/registry-audio/bases/base/audio/elements/curve-select";
import { saturate } from "@/registry-audio/bases/base/lib/saturator-device";

const OPTIONS = [
  { label: "Soft", value: "soft" },
  { label: "Hard", value: "hard" },
  { label: "Fold", value: "fold" },
  { label: "Tube", value: "tube" },
] as const;
const NOTHING = () => undefined;
const SEGMENT = /[ML]/;
const shape = (curve: string, input: number) =>
  saturate(curve as "soft", input);

describe("CurveSelect", () => {
  test("one button per curve, the picked one pressed, a press picks it", () => {
    const onValueChange = mock((_value: string) => undefined);
    const view = render(
      <CurveSelect
        onValueChange={onValueChange}
        options={OPTIONS}
        shape={shape}
        value="soft"
      />
    );
    expect(view.getAllByRole("button")).toHaveLength(4);
    expect(
      view.getByRole("button", { name: "Soft" }).getAttribute("aria-pressed")
    ).toBe("true");
    fireEvent.click(view.getByRole("button", { name: "Fold" }));
    expect(onValueChange).toHaveBeenCalledWith("fold");
  });

  test("each icon is drawn from the curve itself: hard is a straight ramp that clips, soft is round", () => {
    const view = render(
      <CurveSelect
        onValueChange={NOTHING}
        options={OPTIONS}
        shape={shape}
        value="soft"
      />
    );
    const paths = Object.fromEntries(
      OPTIONS.map(({ label, value }) => [
        value,
        view
          .getByRole("button", { name: label })
          .querySelector("path")
          ?.getAttribute("d") ?? "",
      ])
    );
    expect(new Set(Object.values(paths)).size).toBe(4);
    const points = (d: string) =>
      d
        .slice(1)
        .split(SEGMENT)
        .map((p) => p.split(" ").map(Number) as [number, number]);
    const hard = points(paths.hard ?? "");
    // The hard curve is flat at both ends: the first and last points share a height with their neighbour.
    expect(hard[0]?.[1]).toBe(hard[1]?.[1]);
    expect(hard.at(-1)?.[1]).toBe(hard.at(-2)?.[1]);
    // And the first point is the lowest, the last the highest: it goes up the page.
    expect(hard[0]?.[1]).toBeGreaterThan(hard.at(-1)?.[1] ?? 0);
  });

  test("it can be drawn off", () => {
    const view = render(
      <CurveSelect
        disabled
        onValueChange={NOTHING}
        options={OPTIONS}
        shape={shape}
        value="soft"
      />
    );
    expect(
      view.getByRole("button", { name: "Hard" }).hasAttribute("disabled") ||
        view
          .getByRole("button", { name: "Hard" })
          .getAttribute("aria-disabled") === "true" ||
        view.getByRole("button", { name: "Hard" }).hasAttribute("data-disabled")
    ).toBe(true);
  });
});
