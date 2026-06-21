"use client";

import { useState } from "react";
import { Fader } from "@/registry/default/ui/audio/elements/fader";
import { Knob } from "@/registry/default/ui/audio/elements/knob";
import { Transport } from "@/registry/default/ui/audio/elements/transport";
import { XYPad } from "@/registry/default/ui/audio/elements/xypad";
import {
  AudioPlayer,
  AudioPlayerControlBar,
  AudioPlayerControlGroup,
  AudioPlayerPlay,
  AudioPlayerSeekBar,
  AudioPlayerSkipBack,
  AudioPlayerSkipForward,
  AudioPlayerTimeDisplay,
  AudioPlayerVolume,
  AudioQueueRepeatMode,
  AudioQueueShuffle,
  AudioTrackList,
} from "@/registry/default/ui/audio/player";

export function BuilderPreview() {
  const [transport, setTransport] = useState(42);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6">
      {/* Player */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Player
        </p>
        <AudioPlayer variant="widget">
          <AudioTrackList />
          <AudioPlayerControlBar variant="stacked">
            <AudioPlayerControlGroup>
              <AudioPlayerTimeDisplay />
              <AudioPlayerSeekBar />
              <AudioPlayerTimeDisplay remaining />
            </AudioPlayerControlGroup>
            <AudioPlayerControlGroup>
              <AudioQueueRepeatMode />
              <AudioPlayerSkipBack />
              <AudioPlayerPlay />
              <AudioPlayerSkipForward />
              <AudioQueueShuffle />
              <AudioPlayerVolume />
            </AudioPlayerControlGroup>
          </AudioPlayerControlBar>
        </AudioPlayer>
      </div>

      {/* Elements row */}
      <div className="rounded-xl border bg-card p-4 shadow-sm">
        <p className="mb-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Elements
        </p>
        <div className="flex flex-wrap items-end gap-6">
          {/* Knobs */}
          <div className="flex flex-col items-center gap-2">
            <Knob defaultValue={65} max={100} min={0} step={1} />
            <span className="text-muted-foreground text-xs">Gain</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <Knob defaultValue={35} max={100} min={0} step={1} />
            <span className="text-muted-foreground text-xs">Pan</span>
          </div>

          {/* Fader */}
          <div className="flex flex-col items-center gap-2">
            <Fader defaultValue={70} max={100} min={0} step={1} />
            <span className="text-muted-foreground text-xs">Level</span>
          </div>

          {/* XYPad */}
          <div className="flex flex-col items-center gap-2">
            <XYPad
              className="aspect-square w-24"
              defaultValue={{ x: 40, y: 65 }}
              size="default"
            />
            <span className="text-muted-foreground text-xs">XY Pad</span>
          </div>

          {/* Transport */}
          <div className="flex flex-1 flex-col gap-2">
            <Transport
              aria-label="Playback position"
              bufferedValue={78}
              onSeek={setTransport}
              value={transport}
            />
            <span className="text-muted-foreground text-xs">Transport</span>
          </div>
        </div>
      </div>
    </div>
  );
}
