import { createMidiInput } from "@audio-ui/core/midi";

/**
 * The page's one MIDI input: whatever connects it, a button anywhere on the
 * page, every component listening hears the same messages. Connecting asks the
 * browser for access, so call `connect` from a user gesture.
 */
export const midiInput = createMidiInput();
