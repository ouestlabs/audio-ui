import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createMidiInput } from "./input.ts";
import type { MidiMessage } from "./message.ts";

interface FakePort {
  name: string | null;
  onmidimessage: ((event: { data: Uint8Array }) => void) | null;
}

/** A Web MIDI access with the ports it is given, and a way to send from them. */
function fakeAccess(names: (string | null)[]) {
  const ports: FakePort[] = names.map((name) => ({
    name,
    onmidimessage: null,
  }));
  const access = {
    inputs: new Map(ports.map((port, index) => [String(index), port])),
    onstatechange: null as (() => void) | null,
  };
  return {
    access,
    ports,
    send: (port: number, ...bytes: number[]) =>
      ports[port]?.onmidimessage?.({ data: new Uint8Array(bytes) }),
  };
}

const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");
function setNavigator(value: unknown) {
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value,
  });
}

beforeEach(() => {
  setNavigator({});
});
afterEach(() => {
  if (original) {
    Object.defineProperty(globalThis, "navigator", original);
  }
});

describe("createMidiInput", () => {
  test("reports it is unsupported without Web MIDI", async () => {
    const input = createMidiInput();
    expect(input.getSnapshot().supported).toBe(false);
    await input.connect();
    expect(input.getSnapshot()).toMatchObject({
      connected: false,
      error: "This browser has no Web MIDI.",
    });
  });

  test("connects, names the devices and delivers parsed messages", async () => {
    const fake = fakeAccess(["Keystation", null]);
    let options: unknown;
    setNavigator({
      requestMIDIAccess: (given: unknown) => {
        options = given;
        return Promise.resolve(fake.access);
      },
    });
    const input = createMidiInput();
    const heard: MidiMessage[] = [];
    input.listen((message) => heard.push(message));
    await input.connect();

    // System exclusive is not asked for.
    expect(options).toEqual({ sysex: false });
    expect(input.getSnapshot()).toEqual({
      connected: true,
      error: null,
      inputs: ["Keystation", "MIDI device"],
      supported: true,
    });

    fake.send(0, 0x90, 60, 100);
    fake.send(1, 0xe0, 0, 0x40);
    fake.send(0, 0xf8); // the clock is not a message it reads
    expect(heard).toEqual([
      { channel: 0, note: 60, type: "noteon", velocity: 100 / 127 },
      { channel: 0, type: "pitchbend", value: 0 },
    ]);
  });

  test("tells listeners about changes, and stops them on unsubscribe", async () => {
    const fake = fakeAccess(["A"]);
    setNavigator({ requestMIDIAccess: () => Promise.resolve(fake.access) });
    const input = createMidiInput();
    let changes = 0;
    const stop = input.subscribe(() => {
      changes += 1;
    });
    await input.connect();
    expect(changes).toBe(1);
    stop();
    input.disconnect();
    expect(changes).toBe(1);
  });

  test("keeps a stable snapshot until the state changes", async () => {
    const fake = fakeAccess(["A"]);
    setNavigator({ requestMIDIAccess: () => Promise.resolve(fake.access) });
    const input = createMidiInput();
    expect(input.getSnapshot()).toBe(input.getSnapshot());
    await input.connect();
    expect(input.getSnapshot()).toBe(input.getSnapshot());
  });

  test("picks up a device plugged in later", async () => {
    const fake = fakeAccess(["A"]);
    setNavigator({ requestMIDIAccess: () => Promise.resolve(fake.access) });
    const input = createMidiInput();
    await input.connect();
    const late: FakePort = { name: "B", onmidimessage: null };
    fake.access.inputs.set("late", late);
    fake.access.onstatechange?.();
    expect(input.getSnapshot().inputs).toEqual(["A", "B"]);
  });

  test("stops listening to every device on disconnect", async () => {
    const fake = fakeAccess(["A"]);
    setNavigator({ requestMIDIAccess: () => Promise.resolve(fake.access) });
    const input = createMidiInput();
    const heard: MidiMessage[] = [];
    input.listen((message) => heard.push(message));
    await input.connect();
    input.disconnect();
    fake.send(0, 0x90, 60, 100);
    expect(heard).toEqual([]);
    expect(fake.ports[0]?.onmidimessage).toBeNull();
    expect(input.getSnapshot()).toMatchObject({ connected: false, inputs: [] });
  });

  test("says so when permission is denied or there is no device", async () => {
    setNavigator({ requestMIDIAccess: () => Promise.reject(new Error("no")) });
    const denied = createMidiInput();
    await denied.connect();
    expect(denied.getSnapshot().error).toBe("MIDI access was denied.");

    setNavigator({
      requestMIDIAccess: () => Promise.resolve(fakeAccess([]).access),
    });
    const empty = createMidiInput();
    await empty.connect();
    expect(empty.getSnapshot()).toMatchObject({
      connected: false,
      error: "No MIDI device found.",
    });
  });

  test("renders on the server as unsupported", () => {
    expect(createMidiInput().getServerSnapshot()).toMatchObject({
      connected: false,
      supported: false,
    });
  });
});
