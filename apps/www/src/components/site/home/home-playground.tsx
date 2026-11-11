"use client";

import {
  type AudioPeaks,
  computePeaks,
  normalizePeaks,
} from "@audio-ui/engine/analysis";
import { decodeAudioChannels } from "@audio-ui/engine/files";
import { createSource } from "@audio-ui/react";
import { Link } from "@tanstack/react-router";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import { Waveform } from "@/registry-audio/bases/base/audio/elements/waveform";
import {
  type CompressorState,
  compressorDevice,
} from "@/registry-audio/bases/base/devices/compressor/device";
import {
  type CompressorEngine,
  createCompressorEngine,
} from "@/registry-audio/bases/base/devices/compressor/engine";
import { CompressorPanel } from "@/registry-audio/bases/base/devices/compressor/panel";
import {
  type EqualizerState,
  equalizerDevice,
} from "@/registry-audio/bases/base/devices/equalizer/device";
import {
  createEqualizerEngine,
  type EqualizerEngine,
} from "@/registry-audio/bases/base/devices/equalizer/engine";
import { EqualizerPanel } from "@/registry-audio/bases/base/devices/equalizer/panel";
import { useAudioLevels } from "@/registry-audio/bases/base/hooks/use-audio-levels";
import { useMasterBus } from "@/registry-audio/bases/base/hooks/use-master-bus";
import { useSpectrum } from "@/registry-audio/bases/base/hooks/use-spectrum";
import { renderDemoSource } from "@/registry-audio/bases/base/lib/demo-sound";
import { webAudio } from "@/registry-audio/bases/base/lib/web-audio";

const MASTER_VOLUME = 0.7;
const PEAK_COUNT = 480;
const FFT_SIZE = 4096;
const NO_ANALYSERS: readonly AnalyserNode[] = [];
const EMPTY_PEAKS: AudioPeaks = {
  max: new Float32Array(),
  min: new Float32Array(),
};

/** A sound the playground plays: its buffer, its name, and its peaks for the waveform. */
interface Sound {
  buffer: AudioBuffer;
  name: string;
  peaks: AudioPeaks;
}

/** The engines of the chain, made on the first play: the equalizer, then the compressor, then the page's output. */
interface Chain {
  analyser: AnalyserNode;
  compressor: CompressorEngine;
  equalizer: EqualizerEngine;
}

const channelsOf = (buffer: AudioBuffer) =>
  Array.from({ length: buffer.numberOfChannels }, (_, channel) =>
    buffer.getChannelData(channel)
  );

const soundOf = (buffer: AudioBuffer, name: string): Sound => ({
  buffer,
  name,
  peaks: normalizePeaks(computePeaks(channelsOf(buffer), PEAK_COUNT)),
});

const formatTime = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

/** A part of the playground with its registry name under it, a link to its page: what it is made of. */
function Part({
  children,
  className,
  name,
  page,
}: {
  children: ReactNode;
  className?: string;
  name: string;
  page: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      {children}
      <Link
        className="self-start font-site-mono text-[11px] text-site-muted-foreground transition-colors hover:text-foreground"
        params={{ _splat: page }}
        to="/docs/$"
      >
        @audio-ui/{name}
      </Link>
    </div>
  );
}

/**
 * A working playground made of the registry, under the home's title: a
 * sound (a demo loop, or a file of yours) through an equalizer and a
 * compressor, with its waveform to seek in, the spectrum behind the
 * equalizer's curve and a meter of what comes out. Each part is named after
 * its registry item, and all of it follows the customizer's style and theme.
 */
export function HomePlayground() {
  const master = useMasterBus(MASTER_VOLUME);
  const [equalizer, setEqualizer] = useState<EqualizerState>(() =>
    equalizerDevice.defaults()
  );
  const [compressor, setCompressor] = useState<CompressorState>(() =>
    compressorDevice.defaults()
  );
  const [sound, setSound] = useState<Sound | null>(null);
  const [playing, setPlaying] = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [position] = useState(() => createSource(0));
  const chain = useRef<Chain | null>(null);
  const voice = useRef<{
    source: AudioBufferSourceNode;
    started: number;
    offset: number;
  } | null>(null);
  const offset = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);

  // The demo loop, rendered once the page's context is there.
  useEffect(() => {
    const ctx = master?.context;
    if (!ctx || sound) {
      return;
    }
    let live = true;
    renderDemoSource("groove", ctx.sampleRate).then((buffer) => {
      if (live) {
        setSound(soundOf(buffer, "groove"));
      }
    });
    return () => {
      live = false;
    };
  }, [master, sound]);

  // The engines follow the panels, whoever turned them.
  useEffect(() => {
    chain.current?.equalizer.update(equalizer);
  }, [equalizer]);
  useEffect(() => {
    chain.current?.compressor.update(compressor);
  }, [compressor]);

  const stopVoice = useCallback(() => {
    const ctx = master?.context;
    const { current } = voice;
    if (!(ctx && current && sound)) {
      return;
    }
    offset.current =
      (current.offset + ctx.currentTime - current.started) %
      sound.buffer.duration;
    current.source.stop();
    current.source.disconnect();
    voice.current = null;
  }, [master, sound]);

  const startVoice = useCallback(() => {
    const ctx = webAudio.resume();
    if (!(ctx && master && sound)) {
      return;
    }
    if (!chain.current) {
      const eq = createEqualizerEngine(ctx, equalizer);
      const comp = createCompressorEngine(ctx, compressor);
      const tap = ctx.createAnalyser();
      tap.fftSize = FFT_SIZE;
      eq.output.connect(comp.input);
      comp.output.connect(master);
      comp.output.connect(tap);
      chain.current = { analyser: tap, compressor: comp, equalizer: eq };
      setAnalyser(tap);
    }
    const source = ctx.createBufferSource();
    source.buffer = sound.buffer;
    source.loop = true;
    source.connect(chain.current.equalizer.input);
    const at = offset.current % sound.buffer.duration;
    source.start(ctx.currentTime, at);
    voice.current = { offset: at, source, started: ctx.currentTime };
  }, [compressor, equalizer, master, sound]);

  const toggle = useCallback(() => {
    if (playing) {
      stopVoice();
      setPlaying(false);
    } else {
      startVoice();
      setPlaying(true);
    }
  }, [playing, startVoice, stopVoice]);

  const seek = useCallback(
    (value: number) => {
      offset.current = value;
      position.set(value);
      if (voice.current) {
        stopVoice();
        offset.current = value;
        startVoice();
      }
    },
    [position, startVoice, stopVoice]
  );

  // The playhead, read from the audio clock while it plays.
  useEffect(() => {
    const ctx = master?.context;
    if (!(playing && ctx && sound)) {
      return;
    }
    let frame = 0;
    const tick = () => {
      const { current } = voice;
      if (current) {
        position.set(
          (current.offset + ctx.currentTime - current.started) %
            sound.buffer.duration
        );
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [master, playing, position, sound]);

  // Everything goes when the page does.
  useEffect(
    () => () => {
      voice.current?.source.stop();
      chain.current?.equalizer.dispose();
      chain.current?.compressor.dispose();
      chain.current?.analyser.disconnect();
    },
    []
  );

  const load = useCallback(
    async (file: File) => {
      const ctx = master?.context;
      if (!ctx) {
        return;
      }
      const channels = await decodeAudioChannels(ctx, await file.arrayBuffer());
      const [first] = channels;
      if (!first) {
        return;
      }
      const buffer = ctx.createBuffer(
        channels.length,
        first.length,
        ctx.sampleRate
      );
      for (const [index, data] of channels.entries()) {
        buffer.getChannelData(index).set(data);
      }
      const wasPlaying = Boolean(voice.current);
      if (wasPlaying) {
        stopVoice();
      }
      offset.current = 0;
      position.set(0);
      setSound(soundOf(buffer, file.name));
      setPlaying(false);
    },
    [master, position, stopVoice]
  );

  const pick = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        load(file);
      }
      event.target.value = "";
    },
    [load]
  );
  // A sound file dropped anywhere on the playground opens in it.
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = frame.current;
    if (!element) {
      return;
    }
    const allow = (event: DragEvent) => event.preventDefault();
    const take = (event: DragEvent) => {
      event.preventDefault();
      const [file] = event.dataTransfer?.files ?? [];
      if (file?.type.startsWith("audio/")) {
        load(file);
      }
    };
    element.addEventListener("dragover", allow);
    element.addEventListener("drop", take);
    return () => {
      element.removeEventListener("dragover", allow);
      element.removeEventListener("drop", take);
    };
  }, [load]);
  const open = useCallback(() => fileInput.current?.click(), []);

  const levels = useAudioLevels(analyser ? [analyser] : NO_ANALYSERS);
  const spectrum = useSpectrum(analyser);
  const duration = sound?.buffer.duration ?? 1;

  return (
    <section
      aria-labelledby="home-playground"
      className="@container px-4 pb-10 sm:px-6"
    >
      <h2 className="sr-only" id="home-playground">
        Playground
      </h2>
      <div
        className="flex flex-col gap-5 rounded-xl border bg-card p-4 text-card-foreground"
        ref={frame}
      >
        <div className="flex items-center gap-3">
          <PlayToggle
            label="Play the playground"
            onToggle={toggle}
            playing={playing}
          />
          <span className="min-w-0 truncate font-site-mono text-sm">
            {sound?.name ?? "Loading…"}
          </span>
          <span className="font-site-mono text-site-muted-foreground text-xs tabular-nums">
            {formatTime(duration)}
          </span>
          <input
            accept="audio/*"
            className="sr-only"
            onChange={pick}
            ref={fileInput}
            tabIndex={-1}
            type="file"
          />
          <Button
            className="ml-auto"
            onClick={open}
            size="sm"
            variant="outline"
          >
            Open a sound
          </Button>
        </div>
        {/* The sound and what comes out of the chain, side by side, as a track and its meter. */}
        <div className="flex items-start gap-4">
          <Part
            className="flex-1"
            name="waveform"
            page="components/base/waveform"
          >
            <Waveform
              aria-label="Playground position"
              className="h-20"
              disabled={!sound}
              duration={duration}
              getAriaValueText={formatTime}
              loading={!sound}
              onValueChange={seek}
              source={position}
              values={sound?.peaks ?? EMPTY_PEAKS}
              variant="playhead"
            />
          </Part>
          <Part
            className="items-center"
            name="meter"
            page="components/base/meter"
          >
            <div className="h-20">
              <Meter
                aria-label="Playground output"
                // Under the same variant as the size's own, so it fills the waveform's height.
                className="data-[orientation=vertical]:h-full"
                orientation="vertical"
                size="sm"
                source={levels}
              />
            </div>
          </Part>
        </div>
        {/* The devices keep their width: on a narrow screen their row scrolls, as a rack does, rather than crushing them. */}
        <div className="-mx-4 overflow-x-auto px-4">
          <div className="grid min-w-[24rem] gap-5 @[50rem]:grid-cols-2">
            <Part name="equalizer" page="components/base/equalizer">
              <EqualizerPanel
                onValueChange={setEqualizer}
                spectrum={spectrum}
                value={equalizer}
              />
            </Part>
            <Part name="compressor" page="components/base/compressor">
              <CompressorPanel
                onValueChange={setCompressor}
                value={compressor}
              />
            </Part>
          </div>
        </div>
      </div>
    </section>
  );
}
