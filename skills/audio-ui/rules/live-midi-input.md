---
title: One MIDI input for the page, connected from a click
impact: HIGH
impactDescription: a MIDI keyboard that plays every instrument, with no stuck notes
tags: midi, web-midi, keyboard, piano, velocity
---

## One MIDI input for the page, connected from a click

`navigator.requestMIDIAccess()` may prompt for permission, so asking on mount either shows a prompt nobody asked for or is refused. Each component that opens its own access replaces the others' `onmidimessage` handler, so only the last one hears the keyboard. And raw messages hide traps: many keyboards send a note-on with velocity 0 to release a key, so a parser that only reads note-off leaves notes stuck.

**Incorrect (access on mount, one handler per component, raw bytes):**

```tsx
useEffect(() => {
  navigator.requestMIDIAccess().then((access) => {
    for (const input of access.inputs.values()) {
      input.onmidimessage = ({ data }) => {
        if (data?.[0] === 0x90) voices.triggerNote(data[1], envelope); // velocity 0 never releases
        if (data?.[0] === 0x80) voices.releaseNote(data[1], envelope);
      };
    }
  });
}, []);
```

**Correct (the registry hook, and a connect button anywhere on the page):**

```bash
npx shadcn@latest add @audio-ui/use-midi-input @audio-ui/midi-connect-control
```

```tsx
import { MidiConnectControl } from "@/components/audio-ui/midi-connect-control";
import { Piano } from "@/components/audio-ui/piano";
import { useMidiInput } from "@/hooks/use-midi-input";

const midi = useMidiInput({
  onNoteOff: (note) => voices.releaseNote(note, envelope),
  // velocity from 0 to 1; notes arrive outside a click, so resume a suspended context
  onNoteOn: (note, velocity) => {
    if (ctx.state === "suspended") ctx.resume();
    voices.triggerNote(note, envelope, velocity);
  },
});

<MidiConnectControl /> {/* asks for access on click; renders nothing without Web MIDI */}
<Piano activeNotes={midi.activeNotes} aria-label="Piano" />
```

Every component that calls `useMidiInput` hears the same devices, and one `MidiConnectControl` (or `midi.requestAccess` from a click) connects them all. Held keys are released when the device goes away. Without React, `createMidiInput()` from `@audio-ui/core/midi` is the same input as a source, and `parseMidiMessage` reads a raw message (channel, velocity from 0 to 1, pitch bend from -1 to 1).
