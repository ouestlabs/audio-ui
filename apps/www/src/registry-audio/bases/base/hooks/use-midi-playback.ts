"use client";

import { noteToFrequency } from "@audio-ui/core/pitch";
import type { Source } from "@audio-ui/react";
import { useCallback, useEffect, useRef } from "react";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useSynthVoices } from "@/registry-audio/bases/base/hooks/use-synth-voices";
import {
  type Arranged,
  type ArrangementTrack,
  playedNotes,
} from "@/registry-audio/bases/base/lib/arrangement";
import {
  type EnvelopePoint,
  SUSTAIN_SPLIT_X,
  scheduleEnvelopeRamp,
  sliceEnvelope,
} from "@/registry-audio/bases/base/lib/envelope-ramp";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

/** A stretch of the arrangement, in its time: `[start, end]`. */
type Span = readonly [number, number];

/** How a note of a MIDI clip sounds: a short attack, a held body and a release. */
const NOTE_ENVELOPE: EnvelopePoint[] = [
  { x: 0, y: 0.05 },
  { x: 0.1, y: 1 },
  { x: 0.3, y: 0.7 },
  { x: 0.75, y: 0.6 },
  { x: 1, y: 0.05 },
];
/** How far ahead of the playhead notes are scheduled on the audio clock, in seconds. */
const SCHEDULE_AHEAD = 0.12;
/** How long a note takes to reach its held level, and to fade once it ends, in seconds. */
const NOTE_ATTACK = 0.4;
const NOTE_RELEASE = 0.3;
/** How loud a note plays at full velocity. */
const NOTE_PEAK = 0.25;

/** A note on its way to a track's channel: what cuts it short when the playhead jumps. */
interface Tone {
  gain: GainNode;
  oscillator: OscillatorNode;
}

/** Plays `pitch` into `destination` from `at` for `length` seconds of the audio clock. */
function scheduleTone(
  destination: AudioNode,
  pitch: number,
  velocity: number,
  at: number,
  length: number
): Tone {
  const { context } = destination;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(noteToFrequency(pitch), at);
  gain.gain.value = 0;
  oscillator.connect(gain).connect(destination);
  const peak = NOTE_PEAK * velocity;
  const attack = sliceEnvelope(NOTE_ENVELOPE, 0, SUSTAIN_SPLIT_X);
  scheduleEnvelopeRamp(gain.gain, attack, at, NOTE_ATTACK, peak, 0);
  scheduleEnvelopeRamp(
    gain.gain,
    sliceEnvelope(NOTE_ENVELOPE, SUSTAIN_SPLIT_X, 1),
    at + length,
    NOTE_RELEASE,
    peak,
    (attack.at(-1)?.y ?? 0) * peak
  );
  oscillator.start(at);
  oscillator.stop(at + length + NOTE_RELEASE);
  oscillator.addEventListener(
    "ended",
    () => {
      oscillator.disconnect();
      gain.disconnect();
    },
    { once: true }
  );
  return { gain, oscillator };
}

/**
 * Schedules on the audio clock the notes of the heard MIDI clips that start
 * from `from` to `until` in the arrangement, `offset` being the audio clock's
 * time minus the arrangement's: deactivated notes stay silent, each note's
 * chance is rolled and its velocity strays by up to its deviation.
 */
function scheduleNotes({
  audible,
  clips,
  from,
  now,
  offset,
  play,
  until,
}: {
  audible: (trackId: string) => boolean;
  clips: readonly Arranged[];
  from: number;
  now: number;
  offset: number;
  play: (
    trackId: string,
    pitch: number,
    velocity: number,
    at: number,
    length: number
  ) => void;
  until: number;
}) {
  for (const clip of clips) {
    if (!clip.notes || clip.disabled || !audible(clip.track)) {
      continue;
    }
    for (const note of playedNotes(clip)) {
      if (
        note.start < from ||
        note.start >= until ||
        note.muted ||
        Math.random() >= (note.chance ?? 1)
      ) {
        continue;
      }
      const velocity = Math.min(
        1,
        Math.max(
          0,
          (note.velocity ?? 1) + Math.random() * (note.deviation ?? 0)
        )
      );
      play(
        clip.track,
        note.pitch,
        velocity,
        offset + Math.max(now, note.start),
        note.length
      );
    }
  }
}

/** A track's own gain and pan, between its notes and the master. */
interface Channel {
  gain: GainNode;
  pan: StereoPannerNode;
}

/** A track's gain and pan at a time of the arrangement: its mix, or its automation there. */
export type LevelsAt = (
  trackId: string,
  time: number
) => { gain: number; pan: number };

/**
 * Sets each channel to its track's gain and pan at `time` of the arrangement,
 * at `at` on the audio clock: gliding there from what was set before, or, on
 * a jump of the playhead, at once.
 */
function setChannels(
  channels: ReadonlyMap<string, Channel>,
  levelsAt: LevelsAt,
  time: number,
  at: number,
  glide: boolean
) {
  for (const [trackId, channel] of channels) {
    const { gain, pan } = levelsAt(trackId, time);
    const params = [
      [channel.gain.gain, gain],
      [channel.pan.pan, pan],
    ] as const;
    for (const [param, value] of params) {
      if (glide) {
        param.linearRampToValueAtTime(value, at);
      } else {
        param.cancelScheduledValues(at);
        param.setValueAtTime(value, at);
      }
    }
  }
}

/** Fades out at once the notes scheduled ahead, which belong to where the playhead was. */
function cutTones(tones: Set<Tone>, now: number) {
  for (const { gain, oscillator } of tones) {
    gain.gain.cancelScheduledValues(now);
    gain.gain.setTargetAtTime(0, now, 0.01);
    oscillator.stop(now + 0.05);
  }
  tones.clear();
}

/**
 * Plays the MIDI clips while the arrangement plays, each MIDI track through
 * a channel of its own: each frame, it schedules on the audio clock the notes
 * the playhead is about to reach, on the tracks that are heard, skipping
 * deactivated notes, rolling each note's chance and straying its velocity by
 * its deviation, and glides each channel to its track's gain and pan there,
 * from the mix or the automation. A jump of the playhead (a seek, the loop
 * coming round) starts again from it. The piano roll's previews play through
 * a synth of their own, straight to the master.
 */
export function useMidiPlayback({
  audible,
  clips,
  clock,
  levelsAt,
  loop,
  looping,
  playing,
  tracks,
}: {
  audible: (trackId: string) => boolean;
  clips: readonly Arranged[];
  clock: Source<number>;
  levelsAt: LevelsAt;
  loop: Span;
  looping: boolean;
  playing: boolean;
  tracks: readonly ArrangementTrack[];
}) {
  const masterGain = useMasterBus(0.5);
  const voices = useSynthVoices({
    destination: masterGain,
    oscillatorType: "triangle",
  });
  const live = useRef({ audible, clips, levelsAt, loop, looping, tracks });
  live.current = { audible, clips, levelsAt, loop, looping, tracks };

  useEffect(() => {
    const context = webAudio.getContext();
    if (!(playing && context && masterGain)) {
      return;
    }
    if (context.state === "suspended") {
      context.resume();
    }
    const channels = new Map<string, Channel>();
    const tones = new Set<Tone>();
    // A channel for each MIDI track, new ones set at once to where they stand.
    const openChannels = (time: number) => {
      const fresh = new Map<string, Channel>();
      for (const track of live.current.tracks) {
        if (track.kind === "midi" && !channels.has(track.id)) {
          const channel = {
            gain: context.createGain(),
            pan: context.createStereoPanner(),
          };
          channel.gain.connect(channel.pan).connect(masterGain);
          channels.set(track.id, channel);
          fresh.set(track.id, channel);
        }
      }
      setChannels(
        fresh,
        live.current.levelsAt,
        time,
        context.currentTime,
        false
      );
    };
    const play = (
      trackId: string,
      pitch: number,
      velocity: number,
      at: number,
      length: number
    ) => {
      const channel = channels.get(trackId);
      if (channel) {
        const tone = scheduleTone(channel.gain, pitch, velocity, at, length);
        tones.add(tone);
        tone.oscillator.addEventListener("ended", () => tones.delete(tone), {
          once: true,
        });
      }
    };
    let scheduled = clock.getSnapshot();
    openChannels(scheduled);
    let frame = 0;
    const tick = () => {
      const now = clock.getSnapshot();
      const { loop: span, looping: loops } = live.current;
      openChannels(now);
      if (now < scheduled - SCHEDULE_AHEAD || now > scheduled + 1) {
        // The playhead jumped: what was scheduled ahead belongs to where it was.
        cutTones(tones, context.currentTime);
        scheduled =
          loops && now >= span[0] && now < span[0] + SCHEDULE_AHEAD
            ? span[0]
            : now;
        setChannels(
          channels,
          live.current.levelsAt,
          scheduled,
          context.currentTime,
          false
        );
      }
      // Never past the loop's end: the playhead comes round before it.
      const until =
        loops && now < span[1]
          ? Math.min(now + SCHEDULE_AHEAD, span[1])
          : now + SCHEDULE_AHEAD;
      if (until > scheduled) {
        const offset = context.currentTime - now;
        setChannels(
          channels,
          live.current.levelsAt,
          until,
          offset + until,
          true
        );
        scheduleNotes({
          ...live.current,
          from: scheduled,
          now,
          offset,
          play,
          until,
        });
        scheduled = until;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      cutTones(tones, context.currentTime);
      // Once the notes have faded.
      setTimeout(() => {
        for (const channel of channels.values()) {
          channel.pan.disconnect();
        }
      }, 100);
    };
  }, [clock, masterGain, playing]);

  const { releaseNote, triggerNote } = voices;
  /** Sounds a note a MIDI clip's editor auditions, straight to the master: a key pressed, a note drawn. */
  const onNoteOn = useCallback(
    (pitch: number, details: { velocity: number }) =>
      triggerNote(pitch, NOTE_ENVELOPE, details.velocity),
    [triggerNote]
  );
  const onNoteOff = useCallback(
    (pitch: number) => releaseNote(pitch, NOTE_ENVELOPE),
    [releaseNote]
  );
  return { onNoteOff, onNoteOn };
}
