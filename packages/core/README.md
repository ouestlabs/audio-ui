# @audio-ui/core

The logic of audio/ui's primitives with no UI framework in it: values on a grid, linear and logarithmic scales, range geometry, live sources a view can follow outside its render cycle, and frame scheduling.

`@audio-ui/react` is built on it. Use it directly to build the same controls for another framework, or for the DOM alone.

```bash
npm install @audio-ui/core
```

It has no dependencies.

## Layout

- `shared/`: language helpers, math, pitch names
- `value/`: scales, ranges, formatting, change and commit event details, live sources and stores
- `dom/`: frame scheduling, pointer release, visibility, data attributes
- `pitch/`: notes and frequencies, cents and pitch detection on samples, imported as `@audio-ui/core/pitch`
- `primitives/<name>/`: each primitive's own logic, such as timeline clips, waveform peaks or envelope geometry, imported as `@audio-ui/core/<name>`

`index.ts` is the public API of what the primitives share. `@audio-ui/core/internal` holds helpers for adapters and may change in any release.
