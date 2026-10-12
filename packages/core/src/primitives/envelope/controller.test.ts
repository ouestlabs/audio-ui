import { afterEach, describe, expect, mock, test } from "bun:test";
import { createEnvelopeController } from "./controller";

const key = (name: string, extra: Partial<KeyboardEventInit> = {}) =>
  new KeyboardEvent("keydown", { key: name, ...extra });

const TWO_POINTS = [
  { x: 0, y: 0.2 },
  { x: 1, y: 0.8 },
];

const controllers: { dispose: () => void }[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.dispose();
  }
});
const create = (options: Parameters<typeof createEnvelopeController>[0]) => {
  const controller = createEnvelopeController(options);
  controllers.push(controller);
  return controller;
};

describe("Envelope controller value", () => {
  test("holds the default shape when uncontrolled, sorted and clamped", () => {
    const envelope = create({
      defaultValue: [
        { x: 1.4, y: 0.5 },
        { x: -1, y: 2 },
      ],
    });
    expect(envelope.getSnapshot().value).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 0.5 },
    ]);
  });

  test("a snapshot is the same object while nothing it shows has changed", () => {
    const envelope = create({ value: TWO_POINTS });
    expect(envelope.getSnapshot()).toBe(envelope.getSnapshot());
  });

  test("a controlled value is shown as given, and a change only reports itself", () => {
    const onValueChange = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const envelope = create({ onValueChange, value: TWO_POINTS });
    envelope.keyPoint(0, key("ArrowUp"));
    expect(envelope.getSnapshot().value).toEqual(TWO_POINTS);
    expect(onValueChange).toHaveBeenCalledTimes(1);
  });

  test("the formatted point uses the given locale and format", () => {
    const envelope = create({
      format: { maximumFractionDigits: 1 },
      locale: "en-US",
    });
    expect(envelope.formatPoint(0.25, 0.5)).toBe("0.3, 0.5");
  });
});

describe("Envelope controller keys", () => {
  test("arrows move a point by one step, Shift by ten, committed once", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const envelope = create({
      onValueCommitted,
      step: 0.1,
      value: TWO_POINTS,
    });
    const handled = envelope.keyPoint(0, key("ArrowRight"));
    expect(handled).toBe(true);
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
    const committed = onValueCommitted.mock.calls[0]?.[0] as unknown as {
      x: number;
    }[];
    expect(committed[0]?.x).toBeCloseTo(0.1, 10);
  });

  test("Delete on a point removes it, unless that would go below minPoints", () => {
    const envelope = create({ minPoints: 2, value: TWO_POINTS });
    expect(envelope.keyPoint(0, key("Delete"))).toBe(true);
    expect(envelope.getSnapshot().value).toEqual(TWO_POINTS);
    expect(envelope.getSnapshot().blockedIndex).toBeNull();
  });

  test("keys on a flat segment bend nothing", () => {
    const envelope = create({
      value: [
        { x: 0, y: 0.5 },
        { x: 1, y: 0.5 },
      ],
    });
    expect(envelope.keySegment(0, key("ArrowUp"))).toBe(false);
  });

  test("a disabled envelope ignores keys", () => {
    const envelope = create({ disabled: true, value: TWO_POINTS });
    expect(envelope.keyPoint(0, key("ArrowUp"))).toBe(false);
  });
});

describe("Envelope controller add, remove and bend", () => {
  test("a double click adds a point at the spot, snapped unless Cmd is held", () => {
    const onValueCommitted = mock(
      (_value: unknown, _details: unknown) => undefined
    );
    const envelope = create({
      onValueCommitted,
      snap: 0.5,
      defaultValue: TWO_POINTS,
    });
    const index = envelope.addPointAt(
      { x: 0.3, y: 0.6 },
      new MouseEvent("dblclick")
    );
    expect(index).toBe(1);
    expect(envelope.getSnapshot().value[1]).toEqual({ x: 0.5, y: 0.5 });
    expect(onValueCommitted).toHaveBeenCalledTimes(1);
  });

  test("adding is blocked at maxPoints and says so briefly", () => {
    const envelope = create({ maxPoints: 2, value: TWO_POINTS });
    expect(
      envelope.addPointAt({ x: 0.5, y: 0.5 }, new MouseEvent("dblclick"))
    ).toBeNull();
    expect(envelope.getSnapshot().value).toEqual(TWO_POINTS);
  });

  test("straightening a segment sets its curve back to zero", () => {
    const envelope = create({
      defaultValue: [
        { x: 0, y: 0.2, curve: 0.5 },
        { x: 1, y: 0.8 },
      ],
    });
    envelope.straightenSegment(0, new MouseEvent("dblclick"));
    expect(envelope.getSnapshot().value[0]?.curve).toBeUndefined();
  });
});

describe("Envelope controller subscriptions", () => {
  test("subscribers hear every change, and stop when they unsubscribe", () => {
    const envelope = create({ value: TWO_POINTS });
    const listener = mock(() => undefined);
    const unsubscribe = envelope.subscribe(listener);
    envelope.keyPoint(0, key("ArrowUp"));
    expect(listener).toHaveBeenCalled();
    unsubscribe();
    listener.mockClear();
    envelope.keyPoint(0, key("ArrowUp"));
    expect(listener).not.toHaveBeenCalled();
  });
});
