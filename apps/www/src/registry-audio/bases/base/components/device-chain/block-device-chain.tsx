"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { DeviceView } from "@/registry-audio/bases/base/audio/elements/device-view";
import { useArrangement } from "@/registry-audio/bases/base/hooks/use-arrangement";
import { useArrangementEngine } from "@/registry-audio/bases/base/hooks/use-arrangement-engine";
import { useDemoSource } from "@/registry-audio/bases/base/hooks/use-demo-source";
import { usePlaySwitch } from "@/registry-audio/bases/base/hooks/use-play-switch";
import type { Arranged } from "@/registry-audio/bases/base/lib/arrangement";
import { renderArrangement } from "@/registry-audio/bases/base/lib/arrangement-engine";
import type { RecordingSource } from "@/registry-audio/bases/base/lib/clip-player";
import {
  DEMO_TEMPO,
  demoTempo,
  renderDemoSource,
} from "@/registry-audio/bases/base/lib/demo-sound";
import { libraryDevice } from "@/registry-audio/bases/base/lib/device-library";
import { downloadWavFile } from "@/registry-audio/bases/base/lib/wav-file";
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

/** How many times the loop plays into an exported file. */
const BOUNCE_LOOPS = 2;
/** How long the file runs on after the loop, for echoes and the tail of a reverb to die away. */
const BOUNCE_TAIL_SECONDS = 3;

/** A file name with the time in it, so a second export does not take the first one's place. */
function exportName(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  const day = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `device-chain-${day}-${time}.wav`;
}

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
 * own panel over the real engine. Export WAV renders it through the same
 * engine into a file, faster than real time. It is the same view a
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

  // The loop through the chain as a file: how far the render has got, and what to announce of it.
  const [progress, setProgress] = useState<number | null>(null);
  const [announced, setAnnounced] = useState("");
  const exportWav = useCallback(() => {
    const filename = exportName(new Date());
    const [clip] = doc.clips;
    if (!clip) {
      return;
    }
    // The loop plays twice, then the file runs on for the tails: the clip lasts as long as the two plays, with no loop of the arrangement.
    const playedFor = clip.value.length * BOUNCE_LOOPS;
    const exported = {
      ...doc,
      clips: [{ ...clip, value: { ...clip.value, length: playedFor } }],
      duration: playedFor + BOUNCE_TAIL_SECONDS,
      loop: { ...doc.loop, on: false },
    };
    setProgress(0);
    setAnnounced("Exporting the loop through the chain.");
    renderArrangement(exported, sources, {
      onProgress: setProgress,
      to: playedFor + BOUNCE_TAIL_SECONDS,
    })
      .then((rendered) => {
        if (!rendered) {
          throw new Error("no render");
        }
        downloadWavFile(rendered, { filename });
        setAnnounced(`Exported as ${filename}.`);
      })
      .catch(() => setAnnounced("The export did not work."))
      .finally(() => setProgress(null));
  }, [doc, sources]);

  const devices = useMemo(
    () => doc.tracks.find((track) => track.id === TRACK)?.devices ?? [],
    [doc.tracks]
  );

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
      <div className="flex items-center gap-2 border-t px-2 py-1.5 text-muted-foreground text-xs">
        <span className="min-w-0 flex-1 truncate">
          {`The loop through ${devices.length} ${devices.length === 1 ? "device" : "devices"}`}
        </span>
        <span aria-live="polite" className="sr-only">
          {announced}
        </span>
        <Button
          className="tabular-nums"
          disabled={progress !== null || !ready}
          onClick={exportWav}
          size="sm"
          variant="outline"
        >
          <IconPlaceholder
            aria-hidden="true"
            hugeicons="Download01Icon"
            lucide="DownloadIcon"
            phosphor="DownloadSimpleIcon"
            remixicon="RiDownloadLine"
            tabler="IconDownload"
          />
          {progress === null
            ? "Export WAV"
            : `Exporting ${Math.round(progress * 100)}%`}
        </Button>
      </div>
    </div>
  );
}
