import { useEffect, useState } from "react";
import { MixerView } from "@/registry-audio/bases/base/audio/elements/mixer-view";
import { useArrangement } from "@/registry-audio/bases/base/hooks/use-arrangement";
import { useArrangementEngine } from "@/registry-audio/bases/base/hooks/use-arrangement-engine";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
import { useTrackAutomation } from "@/registry-audio/bases/base/hooks/use-track-automation";
import {
  type Arranged,
  type ArrangementTrack,
  UNITY_MIX,
} from "@/registry-audio/bases/base/lib/arrangement";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";
import {
  DEMO_TEMPO,
  type DemoSourceName,
  renderDemoSource,
} from "@/registry-audio/bases/base/lib/demo-sound";
import { libraryDevice } from "@/registry-audio/bases/base/lib/device-library";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** The tracks, each playing one of the demo's sounds round and round, at a level that leaves the main track under 0 dB. */
const SOUNDS: {
  gain: number;
  id: string;
  name: string;
  pan: number;
  send: number;
  source: DemoSourceName;
}[] = [
  { gain: 0.4, id: "kick", name: "Kick", pan: 0, send: 0, source: "kick" },
  {
    gain: 0.4,
    id: "groove",
    name: "Groove",
    pan: -0.25,
    send: 0.35,
    source: "groove",
  },
  {
    gain: 0.25,
    id: "drone",
    name: "Drone",
    pan: 0.3,
    send: 0.5,
    source: "chord",
  },
];

const REVERB = "return-1";

const reverb = libraryDevice("audioui.reverb");

const TRACKS: ArrangementTrack[] = SOUNDS.map(
  ({ gain, id, name, pan, send }, index) => ({
    color: index,
    id,
    mix: { ...UNITY_MIX, color: index, gain, pan },
    name,
    // A share of the groove and of the drone goes to the reverb.
    sends: send > 0 ? { [REVERB]: send } : undefined,
  })
);

const RETURNS: ArrangementTrack[] = [
  {
    color: 0,
    devices: reverb
      ? [
          {
            device: "audioui.reverb",
            id: "reverb",
            state: reverb.device.defaults(),
          },
        ]
      : [],
    id: REVERB,
    name: "A Reverb",
  },
];

/** The metronome stays off: the loops are the only thing that plays. */
const NO_METRONOME = { on: false, rhythm: "auto" } as const;

/** The clip of a track: its sound, round and round for the whole length. */
function loopClip(
  id: string,
  name: string,
  own: number,
  length: number
): Arranged {
  return {
    id: `clip-${id}`,
    loop: [0, own],
    name,
    recording: id,
    sourceLength: own,
    track: id,
    value: { fadeIn: 0, fadeOut: 0, length, offset: 0, start: 0 },
  };
}

/**
 * A mixing console over an arrangement: a channel for each track with its
 * pan, its sends, its fader, its meter and its peak, Solo and Mute, then a
 * return track, and the main track, which stays in sight at the right while
 * the channels scroll. Play the loops: every meter reads the real signal of
 * its channel. It is the same view a workstation shows under its tracks.
 */
export default function BlockMixer() {
  const arrangement = useArrangement({
    duration: 1,
    initialReturns: RETURNS,
    initialTracks: TRACKS,
    tempo: DEMO_TEMPO,
  });
  const { dispatch, doc } = arrangement;
  const automation = useTrackAutomation({ dispatch, tracks: doc.tracks });
  const { playing } = usePlaySwitch();
  const [selected, setSelected] = useState<string | null>(null);

  // The sounds, as the tracks' recordings, and a clip on each that loops it.
  const [sources, setSources] = useState<ReadonlyMap<string, RecordingSource>>(
    () => new Map()
  );
  useEffect(() => {
    const context = webAudio.getContext();
    if (!context) {
      return;
    }
    let cancelled = false;
    Promise.all(
      SOUNDS.map(({ source }) => renderDemoSource(source, context.sampleRate))
    ).then((buffers) => {
      if (cancelled) {
        return;
      }
      const length = Math.max(...buffers.map((buffer) => buffer.duration));
      setSources(
        new Map(
          SOUNDS.map(({ id }, index) => {
            const buffer = buffers[index];
            return [
              id,
              {
                channels: Array.from(
                  { length: buffer?.numberOfChannels ?? 0 },
                  (_, channel) =>
                    buffer?.getChannelData(channel) ?? new Float32Array()
                ),
                sampleRate: buffer?.sampleRate ?? context.sampleRate,
              },
            ];
          })
        )
      );
      dispatch({
        commands: [
          { duration: length, type: "set-duration" },
          { loop: { on: true, range: [0, length] }, type: "set-loop" },
          ...SOUNDS.flatMap(({ id, name }, index) => [
            { id: `clip-${id}`, type: "remove-clip" } as const,
            {
              clip: loopClip(
                id,
                name,
                buffers[index]?.duration ?? length,
                length
              ),
              type: "add-clip",
            } as const,
          ]),
        ],
        type: "batch",
      });
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  const engine = useArrangementEngine({
    doc,
    metronome: NO_METRONOME,
    overridden: automation.overridden,
    recordings: sources,
  });
  const { engine: running, play, stop } = engine;
  const ready = running !== null && sources.size > 0;
  // The play switch of the preview's bar plays the loops, from their start.
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

  return (
    <div className="cn-audio-panel h-96 w-full min-w-0 overflow-hidden border bg-card">
      <MixerView
        arrangement={arrangement}
        engine={engine}
        onMix={automation.changeMix}
        onSelectTrack={setSelected}
        overridden={automation.overridden}
        selectedTrack={selected}
      />
    </div>
  );
}
