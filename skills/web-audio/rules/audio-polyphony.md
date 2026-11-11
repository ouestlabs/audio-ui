---
title: Chords from an instrument that plays one voice
impact: HIGH
impactDescription: every held note sounds, and a note past the last voice cuts the oldest one cleanly
tags: web-audio, instrument, device, chords, voices, midi
---

## Chords from an instrument that plays one voice

The engine of an instrument device plays one note at a time: a second `noteOn` moves the held note to the new pitch. One engine played by a keyboard turns every chord into its last note. Making an engine per note on demand leaks nodes and starts each one late, and a pool written by hand tends to cut the newest note instead of the oldest, or never lets the cut note go, so it sticks when its key comes up.

**Incorrect (one engine for every note, or a voice made per key):**

```tsx
const engine = createPolySynthEngine(ctx, state);
engine.output.connect(output);

const midi = useMidiInput({
  onNoteOff: () => engine.noteOff(), // one key up silences the whole chord
  onNoteOn: (pitch, velocity) =>
    engine.noteOn({ frequency: midiToHz(pitch), velocity }), // the chord glides to its last note
});
```

**Correct (`use-polyphony`: one engine per voice, a note per voice by its id):**

```bash
npx shadcn@latest add @audio-ui/use-polyphony @audio-ui/poly-synth
```

```tsx
import { midiToHz } from "@audio-ui/engine/pitch";
import { createPolySynthEngine } from "@/components/audio-ui/devices/poly-synth/engine";
import { useMasterBus } from "@/hooks/use-master-bus";
import { useMidiInput } from "@/hooks/use-midi-input";
import { usePolyphony } from "@/hooks/use-polyphony";

const output = useMasterBus(1);
const { noteOff, noteOn } = usePolyphony({
  create: createPolySynthEngine,
  destination: output,
  state, // every voice follows it
  voices: 8, // a ninth note takes the voice held longest
});

const midi = useMidiInput({
  onNoteOff: (pitch) => noteOff(`midi-${pitch}`),
  onNoteOn: (pitch, velocity) =>
    noteOn({ frequency: midiToHz(pitch), velocity }, `midi-${pitch}`),
});
```

A note is named by an id its note off gives again, so a key up releases its own note and nothing else. The voices are made once the destination is there and disposed on unmount. To schedule notes ahead on the audio clock, `createPolyphony(engines)` from `@/lib/polyphony` takes engines you made and connected: `noteOn(note, id, at)`, `noteOff(id, at)`, and `release(at)` on a stop.
