# @audio-ui/primitives

The behavior of audio/ui's primitives, written once on the [UI SDK](https://ui-sdk.dev) kernel: a knob, a fader, a meter, a timeline, a piano roll and the rest. Each one is a description of its parts, attributes, events and state over the controllers of [`@audio-ui/core`](../core). It draws nothing and has no framework in it.

You do not use it directly. The adapters for React, Vue, Svelte and the web are files of the audio/ui registry that you copy into your project and own, and they import this package:

```bash
npx shadcn@latest add @audio-ui/knob-react
```

`-vue`, `-svelte` and `-web` install the other adapters. Every primitive has a page with its parts, options and what a change reports: https://www.audio-ui.dev/docs/registry

`@ui-sdk/core` is a peer dependency, pinned to the beta the primitives are written for.

## Entries

One entry per primitive, imported as `@audio-ui/primitives/<name>`: `envelope`, `fader`, `knob`, `meter`, `pad`, `piano`, `piano-roll`, `plot`, `sequencer`, `timeline`, `waveform` and `xypad`.
