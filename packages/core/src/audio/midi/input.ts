import { type MidiMessage, parseMidiMessage } from "./message.ts";

export interface MidiInputState {
  /** Whether a device is connected and its messages are coming in. */
  connected: boolean;
  /** Why it is not connected, when it is not: no Web MIDI, permission denied, no device. */
  error: string | null;
  /** The names of the connected devices. */
  inputs: string[];
  /** Whether this browser has the Web MIDI API, which needs a secure context. */
  supported: boolean;
}

export interface MidiInput {
  /** Asks for access and listens to every input. Call it from a user gesture: browsers may prompt for permission. */
  connect: () => Promise<void>;
  /** Stops listening to every input. */
  disconnect: () => void;
  getServerSnapshot: () => MidiInputState;
  /** The current state: stable between changes, for `useSyncExternalStore` and the like. */
  getSnapshot: () => MidiInputState;
  /** Calls `handler` with each channel voice message of every connected input. Returns its unsubscribe. */
  listen: (handler: (message: MidiMessage) => void) => () => void;
  /** Calls `listener` when the state changes. Returns its unsubscribe. */
  subscribe: (listener: () => void) => () => void;
}

const UNSUPPORTED: MidiInputState = {
  connected: false,
  error: null,
  inputs: [],
  supported: false,
};

const isSupported = () =>
  typeof navigator !== "undefined" &&
  typeof navigator.requestMIDIAccess === "function";

/**
 * The MIDI inputs of the page through the Web MIDI API, as one source: every
 * listener hears the messages of every connected device, and devices plugged
 * or unplugged later are picked up. System exclusive access is not asked for.
 * Make one and share it, so the browser is asked once.
 */
export function createMidiInput(): MidiInput {
  const handlers = new Set<(message: MidiMessage) => void>();
  const listeners = new Set<() => void>();
  let access: MIDIAccess | null = null;
  let state: MidiInputState | null = null;

  const getSnapshot = () => {
    state ??= { ...UNSUPPORTED, supported: isSupported() };
    return state;
  };
  const update = (change: Partial<MidiInputState>) => {
    state = { ...getSnapshot(), ...change };
    for (const listener of listeners) {
      listener();
    }
  };

  const attach = () => {
    if (!access) {
      return;
    }
    const names: string[] = [];
    for (const input of access.inputs.values()) {
      input.onmidimessage = (event) => {
        const message = parseMidiMessage(event.data);
        if (message) {
          for (const handler of handlers) {
            handler(message);
          }
        }
      };
      names.push(input.name ?? "MIDI device");
    }
    update({
      connected: names.length > 0,
      error: names.length > 0 ? null : "No MIDI device found.",
      inputs: names,
    });
  };

  const detach = () => {
    if (!access) {
      return;
    }
    access.onstatechange = null;
    for (const input of access.inputs.values()) {
      input.onmidimessage = null;
    }
    access = null;
  };

  return {
    connect: async () => {
      if (!isSupported()) {
        update({ error: "This browser has no Web MIDI." });
        return;
      }
      try {
        detach();
        access = await navigator.requestMIDIAccess({ sysex: false });
        access.onstatechange = attach;
        attach();
      } catch {
        update({ error: "MIDI access was denied." });
      }
    },
    disconnect: () => {
      detach();
      update({ connected: false, error: null, inputs: [] });
    },
    getServerSnapshot: () => UNSUPPORTED,
    getSnapshot,
    listen: (handler) => {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
