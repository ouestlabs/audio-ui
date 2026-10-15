import {
  type MidiEvent,
  parseMidiMessage,
} from "@/registry-audio/bases/base/lib/midi";

export interface MidiInputState {
  /** Whether a device is connected and its notes are coming in. */
  connected: boolean;
  error: string | null;
  /** The names of the connected devices. */
  inputs: string[];
  /** Whether the browser has the Web MIDI API. */
  supported: boolean;
}

const UNSUPPORTED: MidiInputState = {
  connected: false,
  error: null,
  inputs: [],
  supported: false,
};

const isSupported = () =>
  typeof navigator !== "undefined" && "requestMIDIAccess" in navigator;

/**
 * The page's one MIDI input: whatever connects it, a button anywhere on the
 * page, every component listening hears the same notes. Connecting asks the
 * browser for access, so call `connect` from a user gesture.
 */
export class MidiInput {
  #access: MIDIAccess | null = null;
  #handlers = new Set<(event: MidiEvent) => void>();
  #listeners = new Set<() => void>();
  #state: MidiInputState | null = null;

  getSnapshot = (): MidiInputState => {
    this.#state ??= { ...UNSUPPORTED, supported: isSupported() };
    return this.#state;
  };

  getServerSnapshot = (): MidiInputState => UNSUPPORTED;

  /** Listens to the state: connected or not, the devices, an error. */
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  /** Listens to the notes and pitch bend of every connected device. */
  listen = (handler: (event: MidiEvent) => void) => {
    this.#handlers.add(handler);
    return () => {
      this.#handlers.delete(handler);
    };
  };

  connect = async () => {
    if (!isSupported()) {
      this.#set({ error: "This browser has no Web MIDI." });
      return;
    }
    try {
      const access = await navigator.requestMIDIAccess();
      this.#access = access;
      this.#attach();
      access.onstatechange = () => this.#attach();
    } catch {
      this.#set({ error: "MIDI access was denied." });
    }
  };

  disconnect = () => {
    const access = this.#access;
    if (access) {
      access.onstatechange = null;
      for (const input of access.inputs.values()) {
        input.onmidimessage = null;
      }
    }
    this.#access = null;
    this.#set({ connected: false, error: null, inputs: [] });
  };

  #attach() {
    const access = this.#access;
    if (!access) {
      return;
    }
    const inputs: string[] = [];
    for (const input of access.inputs.values()) {
      input.onmidimessage = (message) => {
        const event = parseMidiMessage(message.data);
        if (event) {
          for (const handler of this.#handlers) {
            handler(event);
          }
        }
      };
      inputs.push(input.name ?? "MIDI device");
    }
    this.#set({
      connected: inputs.length > 0,
      error: inputs.length > 0 ? null : "No MIDI device found.",
      inputs,
    });
  }

  #set(change: Partial<MidiInputState>) {
    this.#state = { ...this.getSnapshot(), ...change };
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

export const $midiInput = new MidiInput();
