---
name: web-audio
description: "Load this before writing any code that makes or measures sound in a web page: Web Audio API, AudioContext, GainNode, BiquadFilterNode, oscillators, AnalyserNode, MIDI or microphone input. It fixes clicks, crackle and zipper noise when a knob or fader moves a parameter (use ramps, never param.value from a drag), dB to gain, headroom and clipping, look-ahead scheduling on the audio clock when a sequencer or metronome drifts (not setInterval), suspended AudioContext until a click, node cleanup on unmount, and live level meters, spectrum analyzers, waveform playheads and pitch tuners that must not re-render React every frame. Use it whenever audio code is being written or debugged, even if the user does not name audio/ui."
license: MIT
metadata:
  author: audio/ui
  version: "1.2.0"
---

# Web Audio with audio/ui

Sound and live data for audio/ui controls. Getting sound out takes an AudioContext that is allowed to start, parameters that move without clicks, and a clock that does not drift. Showing sound takes sources that update outside React: a meter that re-renders the page 60 times a second is the most common way an audio interface becomes slow.

## When to Apply

- Starting sound from a button: creating, resuming and cleaning up an `AudioContext`
- Connecting a knob or fader to a `GainNode`, filter or oscillator parameter
- Scheduling notes from a step sequencer, a piano roll or a transport clock
- Showing live level, spectrum, waveform or playhead position
- Reading the microphone, a MIDI keyboard or the pitch of a sound
- Fixing clicks, zipper noise, distortion, timing drift or a page that re-renders every frame

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
| --- | --- | --- | --- |
| 1 | Web Audio | CRITICAL | `audio-` |
| 2 | Live Data | CRITICAL | `live-` |

## Quick Reference

### 1. Web Audio (CRITICAL)

- `audio-resume-in-gesture` - Create the AudioContext lazily on the client, resume it in the click that starts sound
- `audio-ramp-parameters` - `setTargetAtTime`, never `param.value =` from a drag
- `audio-schedule-on-audio-clock` - Start notes at an AudioContext time from a look-ahead clock, never from timers
- `audio-play-note-state` - Skip muted notes, roll each note's chance, stray its velocity by its deviation
- `audio-db-to-gain` - dB on the control, `10 ** (db / 20)` on the GainNode
- `audio-headroom` - Size voices, resonance and master volume so the loudest case stays under full scale
- `audio-cleanup` - Stop and disconnect nodes, cancel frames on unmount

### 2. Live Data (CRITICAL)

- `live-source-not-state` - Meters, traces, waveforms and playheads take a `source` (`createSource`), never per-frame state
- `live-meter-levels` - `use-audio-levels` for RMS in dB from time-domain samples, with peak hold
- `live-mic-input` - Raw microphone signal up-mixed to stereo, analysers never connected to the speakers
- `live-midi-input` - `use-midi-input` for the page's one MIDI input, connected from a click
- `live-pitch-detection` - A YIN period search (`use-pitch`) for a tuner, never the loudest FFT bin
- `live-playhead-source` - Playback position through a source updated every frame
- `live-decode-once` - Decode and reduce waveform peaks once per file
- `live-leaf-subscription` - Subscribe to a source only in the leaf that prints it
- `live-spectrum-hook` - `use-spectrum` for a log-axis spectrum on a Plot

## Workflow

1. **Create the context lazily on the client and resume it in the click** that starts sound (`audio-resume-in-gesture`). Nothing makes sound before that gesture.
2. **Move parameters with ramps.** A drag fires dozens of changes a second; `param.value =` from one is audible (`audio-ramp-parameters`).
3. **Keep the display off React state.** Put the signal in a source and read it in the leaf that prints it (`live-source-not-state`, `live-leaf-subscription`).
4. **Schedule on the audio clock**, never from `setTimeout` or `setInterval` (`audio-schedule-on-audio-clock`).
5. **Verify.** Drag every control fast and listen for clicks, background the tab during playback, and check in the profiler that nothing re-renders per frame. A headless browser has no microphone: feed an `OscillatorNode` through the same analyser to test an input path.

Components, install names and the controls themselves: the `audio-ui` skill. Picking the look: the `design` skill.

## How to Use

Read the rule files for the explanation and the incorrect and correct code:

```
rules/audio-ramp-parameters.md
rules/live-source-not-state.md
```

- Full docs: https://www.audio-ui.dev/llms.txt

## Full Compiled Document

Every rule of this skill expanded in one file: [AGENTS.md](./AGENTS.md)
