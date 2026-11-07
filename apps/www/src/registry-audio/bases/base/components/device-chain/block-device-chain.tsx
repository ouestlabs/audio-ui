"use client";

import { useCallback, useEffect, useState } from "react";
import { DeviceView } from "@/registry-audio/bases/base/audio/elements/device-view";
import { useArrangement } from "@/registry-audio/bases/base/hooks/use-arrangement";
import { useArrangementEngine } from "@/registry-audio/bases/base/hooks/use-arrangement-engine";
import { useDemoSource } from "@/registry-audio/bases/base/hooks/use-demo-source";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
import type { Arranged } from "@/registry-audio/bases/base/lib/arrangement";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";
import {
  DEMO_TEMPO,
  demoTempo,
  renderDemoSource,
} from "@/registry-audio/bases/base/lib/demo-sound";
import { libraryDevice } from "@/registry-audio/bases/base/lib/device-library";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const TRACK = "track-1";
const SOUND = "sound";

const START = [
  "audioui.equalizer",
  "audioui.compressor",
  "audioui.delay",
].flatMap((device, index) => {
  const entry = libraryDevice(device);
  return entry
    ? [{ device, id: `start-${index}`, state: entry.device.defaults() }]
    : [];
});

const TRACKS = [{ color: 0, devices: START, id: TRACK, name: "Loop" }];

/** The metronome stays off: the loop is the only thing that plays. */
const NO_METRONOME = { on: false, rhythm: "auto" } as const;

/** Nothing moved by hand: no envelope is drawn, so none is overridden. */
const NOT_MOVED = {};

/** The clip that plays the demo's loop, over `length` seconds, round and round. */
function loopClip(length: number): Arranged {
  return {
    id: "loop",
    loop: [0, length],
    name: "Loop",
    recording: SOUND,
    sourceLength: length,
    track: TRACK,
    value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start: 0 },
  };
}

/**
 * A track's devices in a row. Drag a device by its header to move it, or press
 * Left or Right on its grip; fold it, switch it off or remove it, and add a
 * rack. The library is a piece of its own, the device browser. Play
 * the loop: it goes through the devices in the order they are drawn, each its
 * own panel over the real engine. It is the same view a
 * workstation shows under its tracks, over an arrangement of one track.
 */
export default function BlockDeviceChain() {
  const arrangement = useArrangement({
    duration: 1,
    initialTracks: TRACKS,
    tempo: DEMO_TEMPO,
  });
  const { dispatch, doc } = arrangement;
  const name = useDemoSource("groove");
  const { playing } = usePlaySwitch();

  // The demo's sound as the track's recording, and a clip that loops it.
  const [sources, setSources] = useState<ReadonlyMap<string, RecordingSource>>(
    () => new Map()
  );
  useEffect(() => {
    const context = webAudio.getContext();
    if (!context) {
      return;
    }
    let cancelled = false;
    renderDemoSource(name, context.sampleRate).then((buffer) => {
      if (cancelled) {
        return;
      }
      setSources(
        new Map([
          [
            SOUND,
            {
              channels: Array.from(
                { length: buffer.numberOfChannels },
                (_, i) => buffer.getChannelData(i)
              ),
              sampleRate: buffer.sampleRate,
            },
          ],
        ])
      );
      dispatch({
        commands: [
          { id: "loop", type: "remove-clip" },
          { clip: loopClip(buffer.duration), type: "add-clip" },
          { duration: buffer.duration, type: "set-duration" },
          {
            loop: { on: true, range: [0, buffer.duration] },
            type: "set-loop",
          },
          { tempo: demoTempo(name), type: "set-tempo" },
        ],
        type: "batch",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, name]);

  const engine = useArrangementEngine({
    doc,
    metronome: NO_METRONOME,
    overridden: NOT_MOVED,
    recordings: sources,
  });
  const { engine: running, play, stop } = engine;
  const ready = running !== null && sources.size > 0;
  // The play switch of the preview's bar plays the loop, from its start.
  useEffect(() => {
    if (!ready) {
      return;
    }
    if (playing) {
      play(0);
    } else {
      stop();
    }
  }, [play, playing, ready, stop]);

  const noteOn = useCallback(() => undefined, []);
  const hold = useCallback(() => undefined, []);
  const moved = useCallback(() => undefined, []);

  return (
    <div className="cn-audio-panel w-full min-w-0 overflow-hidden border bg-card">
      <div className="h-96 bg-muted/30">
        <DeviceView
          arrangement={arrangement}
          onDeviceMoved={moved}
          onHoldNote={hold}
          onNoteOff={hold}
          onNoteOn={noteOn}
          onPadFiles={hold}
          overridden={NOT_MOVED}
          position={engine.position}
          track={TRACK}
        />
      </div>
    </div>
  );
}
