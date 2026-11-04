# DAW behavior spec

What `apps/daw` must do, written as rules it can be tested against. The app exists to put audio/ui under the load of a real product: when it cannot follow a rule because a package or a registry item falls short, the fix goes upstream ([gaps.md](gaps.md) keeps the list).

## Where the rules come from

- **The reference manual**: the public manual of a commercial DAW, read chapter by chapter. Each chapter here restates its behavior in neutral terms; nothing is copied from it, and no product is named in this folder, in the code or in the interface.
- **Observations** (`OBS-nn`): when the manual is silent or unclear, the installed reference DAW is put in a precise state and filmed or captured; the result is written into the rule it settles. An observation of an older version stands only where the manual of the current one does not contradict it.
- **Measurements** (`PRF-nn`): numbers taken on the same machine, from the reference and from `apps/daw`, with the protocol written next to them.

Where `apps/daw` departs from the reference on purpose, the rule says so and why (a **Deviation**).

## How a rule reads

```
### CLP-003 Fade-in
From the clip's start, over its fade-in length, the gain rises from 0 to 1 along the fade's shape.
Test: packages/core/src/audio/playback/render.test.ts "CLP-003"
```

- The id is the chapter's prefix and a number that never changes. A rule that goes keeps its number, marked **Withdrawn**.
- **Test** says what proves it: a unit test (its name starts with the rule id), a browser check (`apps/daw/test/`), or a measurement.
- **Status**, when the rule does not hold yet: `planned (phase n)` or `partial: <what is missing>`.

## Chapters

| Prefix | Chapter | Phase |
| --- | --- | --- |
| `TRN` | [Transport](transport.md) | 1 |
| `ARR` | [Arrangement playback](arrangement.md) | 1 |
| `CLP` | [Audio clips](audio-clips.md) | 1 (warp modes, tempo: 4) |
| `MID` | [MIDI playback](midi.md) | 1 |
| `MIX` | [Mixer](mixer.md) | 1 (groups: 2) |
| `DEV` | [Devices](devices.md) | 1 (racks: 2) |
| `EXP` | [Export](export.md) | 1 |
| `ENG` | [Engine](engine.md) | 1 |
| `PRJ` | [Projects and files](project.md) | 1 (on disk, DAWproject: 2) |
| `AUT` | [Automation](automation.md) | 3 |
| `REC` | [Recording](recording.md) | 5 |
| `KEY` | [Shortcuts](shortcuts.md) | each phase |
| `PRF` | [Performance targets](performance.md) | each phase |

Later phases add their chapters here before they start: editing (3), warping (4), recording (5). There is no session view: the DAW is an arrangement only (decided 2026-11-04).

## Fixtures

Tests use sets made for them or generated: sines, clicks at known frames, noise bursts, and a load set of long stereo stems generated on demand (`apps/daw/scripts/fixtures.ts`), never committed. No file from the reference DAW's installation, its packs or its user library enters the repository.
