import { describe, expect, mock, test } from "bun:test";
import { fireEvent, render } from "@testing-library/react";
import { Knob } from "../../../entries/knob.js";

function renderValue(props: Knob.Root.Props = {}, editable = true) {
  const onValueChange = mock(
    (_value: number, _details: Knob.Root.ChangeEventDetails) => undefined
  );
  const onValueCommitted = mock(
    (_value: number, _details: Knob.Root.CommitEventDetails) => undefined
  );
  const view = render(
    <Knob.Root
      onValueChange={onValueChange}
      onValueCommitted={onValueCommitted}
      {...props}
    >
      <Knob.Control>
        <Knob.Thumb aria-label="Cutoff" />
      </Knob.Control>
      <Knob.Value data-testid="value" editable={editable} />
    </Knob.Root>
  );
  return {
    onValueChange,
    onValueCommitted,
    value: view.getByTestId("value"),
    view,
  };
}

const last = <T extends unknown[]>(fn: { mock: { calls: T[] } }) =>
  fn.mock.calls.at(-1) as T;
const field = (view: ReturnType<typeof render>) =>
  view.container.querySelector("input[type=text]") as HTMLInputElement | null;

describe("Knob.Value editable", () => {
  test("a double click opens a field holding the value, selected", () => {
    const { value, view } = renderValue();
    expect(field(view)).toBeNull();
    fireEvent.doubleClick(value);
    expect(field(view)?.value).toBe("50");
  });

  test("Enter on the focused readout opens it too", () => {
    const { value, view } = renderValue();
    value.focus();
    fireEvent.keyDown(value, { key: "Enter" });
    expect(field(view)).not.toBeNull();
  });

  test("Enter commits what was typed, with a unit or a comma, clamped", () => {
    const { onValueChange, onValueCommitted, value, view } = renderValue();
    fireEvent.doubleClick(value);
    const input = field(view) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "12,6 dB" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(last(onValueChange)[0]).toBe(13);
    expect(last(onValueChange)[1].reason).toBe("input-change");
    expect(last(onValueCommitted)).toEqual([
      13,
      expect.objectContaining({ reason: "input-change" }),
    ]);
    expect(field(view)).toBeNull();

    fireEvent.doubleClick(value);
    fireEvent.change(field(view) as HTMLInputElement, {
      target: { value: "9999" },
    });
    fireEvent.keyDown(field(view) as HTMLInputElement, { key: "Enter" });
    expect(last(onValueChange)[0]).toBe(100);
  });

  test("leaving the field commits, Escape and text without a number drop it", () => {
    const { onValueChange, value, view } = renderValue();
    fireEvent.doubleClick(value);
    fireEvent.change(field(view) as HTMLInputElement, {
      target: { value: "20" },
    });
    fireEvent.blur(field(view) as HTMLInputElement);
    expect(last(onValueChange)[0]).toBe(20);

    onValueChange.mockClear();
    fireEvent.doubleClick(value);
    fireEvent.change(field(view) as HTMLInputElement, {
      target: { value: "30" },
    });
    fireEvent.keyDown(field(view) as HTMLInputElement, { key: "Escape" });
    fireEvent.doubleClick(value);
    fireEvent.change(field(view) as HTMLInputElement, {
      target: { value: "abc" },
    });
    fireEvent.keyDown(field(view) as HTMLInputElement, { key: "Enter" });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  test("a readout that is not editable stays text", () => {
    const plain = renderValue({}, false);
    fireEvent.doubleClick(plain.value);
    expect(field(plain.view)).toBeNull();
    expect(plain.value.tabIndex).not.toBe(0);
  });
});
