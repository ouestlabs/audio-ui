import { describe, expect, test } from "bun:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { Fader } from "@/registry/bases/base/primitives/fader/react/index.tsx";
import { Knob } from "@/registry/bases/base/primitives/knob/react/index.tsx";

async function mount(ui: React.ReactNode) {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(() => root.render(ui));
  return { container, unmount: () => act(() => root.unmount()) };
}

const typeInto = (input: HTMLInputElement, text: string) => {
  input.value = text;
};

describe("an editable readout", () => {
  for (const [name, ui] of [
    [
      "knob",
      (onChange: (value: number) => void) => (
        <Knob.Root defaultValue={10} max={100} min={0} onValueChange={onChange}>
          <Knob.Control>
            <Knob.Thumb aria-label="Gain" />
          </Knob.Control>
          <Knob.Value editable />
        </Knob.Root>
      ),
    ],
    [
      "fader",
      (onChange: (value: number) => void) => (
        <Fader.Root
          defaultValue={10}
          max={100}
          min={0}
          onValueChange={onChange}
        >
          <Fader.Control>
            <Fader.Thumb aria-label="Gain">
              <Fader.Value editable />
            </Fader.Thumb>
          </Fader.Control>
        </Fader.Root>
      ),
    ],
  ] as const) {
    test(`a double click on the ${name}'s readout swaps it for a field that commits the typed number`, async () => {
      const changes: number[] = [];
      const { container, unmount } = await mount(
        ui((value) => changes.push(value))
      );
      const readout = container.querySelector("output") as HTMLElement;
      await act(() => {
        readout.dispatchEvent(
          new MouseEvent("dblclick", { bubbles: true, cancelable: true })
        );
      });
      const field = container.querySelector(
        'output input[type="text"]'
      ) as HTMLInputElement;
      expect(field).not.toBeNull();
      typeInto(field, "42");
      await act(() => {
        field.dispatchEvent(
          new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            key: "Enter",
          })
        );
      });
      expect(changes.at(-1)).toBe(42);
      expect(container.querySelector('output input[type="text"]')).toBeNull();
      await unmount();
    });
  }

  test("Escape drops what was typed", async () => {
    const changes: number[] = [];
    const record = (value: number) => changes.push(value);
    const { container, unmount } = await mount(
      <Knob.Root defaultValue={10} onValueChange={record}>
        <Knob.Control>
          <Knob.Thumb aria-label="Gain" />
        </Knob.Control>
        <Knob.Value editable />
      </Knob.Root>
    );
    const readout = container.querySelector("output") as HTMLElement;
    await act(() => {
      readout.dispatchEvent(
        new MouseEvent("dblclick", { bubbles: true, cancelable: true })
      );
    });
    const field = container.querySelector(
      'output input[type="text"]'
    ) as HTMLInputElement;
    typeInto(field, "55");
    await act(() => {
      field.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "Escape",
        })
      );
    });
    expect(changes).toEqual([]);
    await unmount();
  });
});
