# @audio-ui/core

The logic of audio/ui's primitives with no UI framework in it: values on a grid, linear and logarithmic scales, range geometry, live sources a view can follow outside its render cycle, and frame scheduling.

`@audio-ui/react` is built on it. Use it directly to build the same controls for another framework, or for the DOM alone.

```bash
npm install @audio-ui/core
```

It has no dependencies.

## Layout

Two kinds of module are published, each as its own subpath, and the folders tell them apart:

- `primitives/<name>/`: the logic of a UI primitive (a knob, a timeline, a piano roll): its controller, geometry and value handling. Imported as `@audio-ui/core/<name>`.
- `audio/<name>/`: audio and music logic with no interface in it: `pitch` (notes, frequencies, pitch detection), `midi` (messages, files, the Web MIDI input) and `time` (tempo, bars and beats, ticks and seconds, the grid, the look-ahead scheduler). Imported as `@audio-ui/core/<name>`.

What both build on:

- `value/`: scales, ranges, formatting, change and commit event details, live sources and stores
- `dom/`: frame scheduling, pointer release, visibility, data attributes
- `shared/`: language helpers, math, pitch names

`index.ts` is the public API of what the primitives share. `@audio-ui/core/internal` holds helpers for adapters and may change in any release.
