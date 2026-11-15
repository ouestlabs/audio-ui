import { describe, expect, mock, test } from "bun:test";
import { envelope } from "../src/envelope/index.ts";

const POINTS = [
  { x: 0, y: 0 },
  { x: 0.5, y: 1 },
  { x: 1, y: 0 },
];

/** The envelope with no framework: the kernel's instance, driven through its api. */
function instance(options: Record<string, unknown> = {}) {
  const onValueChange = mock(
    (_value: unknown, _details: { index?: number; reason: string }) => undefined
  );
  const onValueCommitted = mock(
    (_value: unknown, _details: { reason: string }) => undefined
  );
  const envelopeInstance = envelope({
    id: "e",
    onValueChange,
    onValueCommitted,
    ...options,
  } as never);
  return { envelopeInstance, onValueChange, onValueCommitted };
}

describe("the envelope primitive", () => {
  test("starts with an ADSR-like shape of five points", () => {
    const { envelopeInstance } = instance();
    expect(envelopeInstance.get().view.value).toHaveLength(5);
  });

  test("a point is added where asked, reporting an add with its index", () => {
    const { envelopeInstance, onValueChange } = instance({
      defaultValue: POINTS,
    });
    envelopeInstance.api.addPoint(
      { x: 0.25, y: 0.5 },
      new MouseEvent("dblclick")
    );
    expect(envelopeInstance.get().view.value).toHaveLength(4);
    const [, details] = onValueChange.mock.calls[0] ?? [];
    expect(details).toMatchObject({ index: 1, reason: "add" });
    expect(envelopeInstance.get().focused).toBe(1);
  });

  test("a point is removed, but not below the least number of points", () => {
    const { envelopeInstance } = instance({
      defaultValue: POINTS,
      minPoints: 3,
    });
    envelopeInstance.api.removePoint(1, new MouseEvent("dblclick"));
    expect(envelopeInstance.get().view.value).toHaveLength(3);
    const free = instance({ defaultValue: POINTS });
    free.envelopeInstance.api.removePoint(1, new MouseEvent("dblclick"));
    expect(free.envelopeInstance.get().view.value).toHaveLength(2);
  });

  test("a change an app refuses is not applied", () => {
    const { envelopeInstance } = instance({
      defaultValue: POINTS,
      onValueChange: (_value: unknown, details: { cancel: () => void }) =>
        details.cancel(),
    });
    envelopeInstance.api.removePoint(1, new MouseEvent("dblclick"));
    expect(envelopeInstance.get().view.value).toHaveLength(3);
  });

  test("controlled points follow the options it is given", () => {
    const { envelopeInstance } = instance({ value: POINTS });
    expect(envelopeInstance.get().view.value).toEqual(POINTS);
    const next = [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
    ];
    envelopeInstance.setOptions({ id: "e", value: next } as never);
    expect(envelopeInstance.get().view.value).toEqual(next);
  });
});
