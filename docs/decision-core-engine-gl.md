# Core, engine and gl: they stay packages

Decided 2026-11-17, from what each package weighs for the registry. The question was whether `@audio-ui/core`, `@audio-ui/engine` and `@audio-ui/gl` become files a user copies, or stay published packages that registry items depend on.

**They stay published packages.** What the registry copies is what a user changes: the adapters of each framework and the styled components. What they run on is installed.

## What the sources say

| | Files | Lines | Registry files that import it | Other users |
| --- | --- | --- | --- | --- |
| `@audio-ui/core` | 73 | 13,800 | 62 | `@audio-ui/primitives` (75 registry files), the DAW (42 files), the lab (20), the video (6) |
| `@audio-ui/engine` | 86 | 14,100 | 206 | the DAW (182 files), the lab (8), the video (1) |
| `@audio-ui/gl` | 3 | 2,300 | 7 | the DAW (10 files) |

## Why

- **The user already gets one command.** A registry item declares its npm dependencies, so `npx shadcn@latest add` installs `@audio-ui/core` or `@audio-ui/engine` with the component: nothing to configure, in four frameworks (tested in empty projects of each, 2026-11-17). Copying them would not make the install simpler.
- **Core cannot be copied without primitives.** The behavior of every control is `@audio-ui/primitives`, over `@audio-ui/core`: the UI SDK decision (ADR 0001) put it in a package so each adapter is thin (120 to 150 lines). Copying core means copying the 10,000 lines of primitives with it, into each project, and losing the one place a fix lands.
- **Engine is in 206 registry files.** A copy per item is not an option, and one copy for all would be a package by another name. It also wraps audio.js atoms and holds generated files (the worklet's source, the kernels) that a test keeps in sync: a registry file never imports an `@audio/*` atom, so that a user is not tied to them.
- **Gl is small, but its weight is not its lines.** It is 3 files over `gl-waveform` and `gl-spectrogram`, which a user would still install. Copying the 2,300 lines saves nothing.
- **Copying has no update path.** A fix in copied logic never reaches the people who copied it (the shadcn model has none). For an adapter, which is a few parts, that is the right trade. For 28,000 lines of audio logic, it is not.

## What follows

- The docs say it: the packages are under Components, beside the hooks and libs that use them, and an item's page says which package it installs.
- Nothing is deprecated or removed. The changesets keep releasing `core`, `engine`, `gl` and `primitives`.
- A web page with no build runs the adapters from `https://www.audio-ui.dev/web/<version>/<name>.js`, which carry their packages inside: that is the case where "nothing to install" is real, and it is done.

## What would change it

Revisit if one of these stops being true:

- the registry's items stop declaring npm dependencies, or a CLI cannot install them;
- a package has one registry file left, as `gl` nearly does (7 today): then fold it into its only user;
- UI SDK, or the shadcn CLI, ships a way to update copied files, which would remove the cost of copying.
