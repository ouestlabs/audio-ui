# Ducker as a VST3

A trial: the registry's Ducker, described once, built as a native plugin. It is not part of the registry or of the workspaces, and nothing here is published.

The processor is the one the web engine plays, `DUCKER_PROCESSOR` in `apps/www/src/registry/bases/shared/devices/ducker/device.ts`, with the parameters `contractParams` derives from `duckerDevice`. It is compiled with [`@audio/plugin-vst`](https://github.com/audiojs/plugin) and [jz](https://github.com/dy/jz).

## Build

macOS, with Xcode's command line tools, [wabt](https://github.com/WebAssembly/wabt) (`brew install wabt`) and the workspaces installed at the root.

```sh
cd trials/ducker-vst3
bun install
bun run build   # dist/audio-ui Ducker.vst3
bun run check   # the compiled processor against JavaScript, then the sidechain and the saved state
cp -R "dist/audio-ui Ducker.vst3" ~/Library/Audio/Plug-Ins/VST3/
```

## Tried

2026-11-28, macOS 27 on Apple Silicon, jz 1.0.3, plugin-vst 0.0.2, wabt 1.0.42, in Ableton Live 10.1.43:

- it loads, its parameters automate, and it ducks from another track, by the range set;
- an export matches the JavaScript processor within 2e-7 from the third beat to the fifteenth;
- after Live is quit and started again, the export is the same, to 3e-7.

## Limits

- No interface of ours: the host draws its own controls, named by parameter id.
- Values show from 0 to 1, and `ratio`, `attackMs` and `releaseMs` travel linearly: the VST3 shell has no value text and no curve.
- The saved state holds values off their step, which a restored instance snaps.
- No validator has run on the bundle, and no other DAW has loaded it.

## Workarounds

`build.ts` puts two wrappers in front of the tools:

- `wasm2c` without `--enable-exceptions`, which wabt 1.0.42 refuses;
- `clang` for `arm64` and `x86_64`, since the build targets one architecture and a host under Rosetta needs the other.
