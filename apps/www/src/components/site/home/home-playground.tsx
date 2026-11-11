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
import {
  type ClipSamples,
  ClipWaveform,
} from "@/registry-audio/bases/base/audio/elements/clip-waveform";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { PlayToggle } from "@/registry-audio/bases/base/audio/elements/play-toggle";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelinePlayhead,
  TimelineRuler,
  TimelineViewport,
} from "@/registry-audio/bases/base/audio/elements/timeline";
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
/** Enough peaks for a pixel each, zoomed in as far as it goes. */
const PEAK_COUNT = 8192;
/** How far in the view zooms: to the samples themselves, this many px apart, as the clip editor goes. */
const FRAME_PX = 40;
/** The widest a lane can be laid out, in px. */
const MOST_LANE_PX = 16_000_000;
const ZOOM_STEP = 1.5;
/** How far in from the view's edge the playhead may go before the view turns the page, as a share of the view. */
const PAGE_MARGIN = 0.1;
const LABEL_STEPS = [
  0.0001, 0.000_25, 0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25,
  0.5, 1, 2, 5, 10, 15, 30, 60,
];
const MIN_LABEL_GAP_PX = 56;
const FFT_SIZE = 4096;
const NO_ANALYSERS: readonly AnalyserNode[] = [];

/** A sound the playground plays: its buffer, its name, and its peaks for the waveform. */
interface Sound {
  buffer: AudioBuffer;
  name: string;
  peaks: AudioPeaks;
  /** Its samples, mixed to one channel, for a zoom closer than the peaks have detail for. */
  samples: ClipSamples;
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

/** The channels mixed to one, as the waveform draws the sound. */
function mixOf(channels: readonly Float32Array[]) {
  const [first] = channels;
  const mix = new Float32Array(first?.length ?? 0);
  for (const channel of channels) {
    for (let index = 0; index < mix.length; index += 1) {
      mix[index] = (mix[index] ?? 0) + (channel[index] ?? 0) / channels.length;
    }
  }
  return mix;
}

function soundOf(buffer: AudioBuffer, name: string): Sound {
  const channels = channelsOf(buffer);
  const mix = mixOf(channels);
  return {
    buffer,
    name,
    peaks: normalizePeaks(computePeaks(channels, PEAK_COUNT)),
    samples: { frames: mix.length, read: (from, to) => mix.subarray(from, to) },
  };
}

/** The seconds the ruler labels: the smallest step that keeps labels apart at this zoom, in pixels per second. */
function rulerLabels(
  duration: number,
  zoom: number,
  [from, to]: readonly [number, number]
) {
  const step =
    LABEL_STEPS.find((candidate) => candidate * zoom >= MIN_LABEL_GAP_PX) ??
    LABEL_STEPS.at(-1) ??
    1;
  // Only those around what shows: zoomed to the samples, the whole sound would be tens of thousands.
  const first = Math.max(0, Math.floor(from / step) - 1);
  const last = Math.min(Math.floor(duration / step), Math.ceil(to / step) + 1);
  const decimals = Math.max(0, Math.ceil(-Math.log10(step)));
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => {
    const at = Number(((first + index) * step).toFixed(6));
    return { at, text: formatMark(at, decimals) };
  });
}

/** A ruler mark: whole seconds as m:ss, finer ones with as many decimals as the step has. */
const formatMark = (seconds: number, decimals: number) =>
  decimals === 0
    ? formatTime(seconds)
    : `${Math.floor(seconds / 60)}:${(seconds % 60).toFixed(decimals).padStart(3 + decimals, "0")}`;

/** Scrolls a zoomed view to the page that holds `x`, once the playhead nears or passes its edge. */
function followPlayhead(viewport: HTMLElement | null, x: number) {
  if (!viewport) {
    return;
  }
  const margin = viewport.clientWidth * PAGE_MARGIN;
  const { clientWidth, scrollLeft } = viewport;
  if (x < scrollLeft || x > scrollLeft + clientWidth - margin) {
    viewport.scrollLeft = Math.max(0, x - margin);
  }
}

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
  // Pixels per second; null while the whole sound fits the width it is given.
  const [zoomPx, setZoomPx] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const lane = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const soundDuration = sound?.buffer.duration ?? 0;
  const fitPx = width > 0 && soundDuration > 0 ? width / soundDuration : 0;
  // As far in as the samples go, a few px apart, as wide as a lane can be laid out.
  const maxZoom = Math.max(
    fitPx,
    sound && soundDuration > 0
      ? Math.min(sound.samples.frames * FRAME_PX, MOST_LANE_PX) / soundDuration
      : 0
  );
  const zoom = Math.max(zoomPx ?? fitPx, fitPx);
  const zoomed = fitPx > 0 && zoom > fitPx * 1.001;
  const view = useRef<{ px: number; zoomed: boolean }>({
    px: 0,
    zoomed: false,
  });
  view.current = { px: zoom, zoomed };

  // The width the whole sound fits, measured on the next frame, outside the layout pass that resized it.
  useEffect(() => {
    const element = lane.current;
    if (!element) {
      return;
    }
    let measure = 0;
    const observer = new ResizeObserver(([entry]) => {
      cancelAnimationFrame(measure);
      measure = requestAnimationFrame(() =>
        setWidth(entry?.contentRect.width ?? 0)
      );
    });
    observer.observe(element);
    return () => {
      cancelAnimationFrame(measure);
      observer.disconnect();
    };
  }, []);

  // The stretch that shows, in seconds, for the ruler to mark only that.
  const [shown, setShown] = useState<readonly [number, number]>([0, 0]);
  useEffect(() => {
    const element = viewport.current;
    if (!(element && zoom > 0)) {
      return;
    }
    let pending = 0;
    const measure = () => {
      pending = 0;
      setShown([
        element.scrollLeft / zoom,
        (element.scrollLeft + element.clientWidth) / zoom,
      ]);
    };
    const onScroll = () => {
      pending ||= requestAnimationFrame(measure);
    };
    measure();
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(pending);
      element.removeEventListener("scroll", onScroll);
    };
  }, [zoom]);

  const zoomIn = useCallback(
    () => setZoomPx(Math.min(maxZoom, zoom * ZOOM_STEP)),
    [maxZoom, zoom]
  );
  const zoomOut = useCallback(
    () => setZoomPx(Math.max(fitPx, zoom / ZOOM_STEP)),
    [fitPx, zoom]
  );
  const changeZoom = useCallback((next: number) => setZoomPx(next), []);

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
        const at =
          (current.offset + ctx.currentTime - current.started) %
          sound.buffer.duration;
        position.set(at);
        // Zoomed in, the view turns the page as the playhead leaves it.
        if (view.current.zoomed) {
          followPlayhead(viewport.current, at * view.current.px);
        }
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
      setZoomPx(null);
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
          <div className="ml-auto flex items-center gap-1">
            <Button
              aria-label="Zoom out"
              disabled={!zoomed}
              onClick={zoomOut}
              size="icon-sm"
              variant="ghost"
            >
              −
            </Button>
            <Button
              aria-label="Zoom in"
              disabled={!sound || zoom >= maxZoom}
              onClick={zoomIn}
              size="icon-sm"
              variant="ghost"
            >
              +
            </Button>
            <Button onClick={open} size="sm" variant="outline">
              Open a sound
            </Button>
          </div>
        </div>
        {/* The sound and what comes out of the chain, side by side, as a track and its meter. */}
        <div className="flex items-start gap-4">
          <Part
            className="flex-1"
            name="waveform"
            page="components/base/waveform"
          >
            {/* Zoomed with Cmd or Ctrl + wheel, or the buttons above; the ruler seeks, the navigator moves the view. */}
            <div ref={lane}>
              <Timeline
                disabled={!sound}
                duration={soundDuration || 1}
                maxZoom={Math.max(maxZoom, 1)}
                minZoom={fitPx || 0}
                onPositionChange={seek}
                onZoomChange={changeZoom}
                source={position}
                zoom={fitPx > 0 ? zoom : undefined}
              >
                <TimelineViewport
                  className="overflow-y-hidden rounded-lg border"
                  ref={viewport}
                  scrollbar="hidden"
                >
                  <TimelineRuler
                    aria-label="Playground time"
                    getAriaValueText={formatTime}
                  >
                    {rulerLabels(soundDuration, zoom, shown).map((mark) => (
                      <TimelineMark key={mark.at} value={mark.at}>
                        {mark.text}
                      </TimelineMark>
                    ))}
                  </TimelineRuler>
                  {/* A press seeks; the clip editor's waveform draws the peaks, then the samples, then a line through them with a dot each. */}
                  <TimelineLane className="h-28" seekable>
                    <div
                      className="absolute inset-y-0 left-0"
                      style={{
                        width: `calc(var(--timeline-unit) * ${soundDuration || 1})`,
                      }}
                    >
                      {sound ? (
                        <ClipWaveform
                          aria-label={`${sound.name}, waveform`}
                          className="inset-y-0 h-full text-foreground"
                          clip={{
                            sourceLength: soundDuration,
                            value: { length: soundDuration, offset: 0 },
                          }}
                          peaks={sound.peaks}
                          role="img"
                          samples={sound.samples}
                        />
                      ) : null}
                    </div>
                    <TimelinePlayhead />
                  </TimelineLane>
                </TimelineViewport>
                <TimelineNavigator
                  className="mt-2"
                  getAriaValueText={formatTime}
                />
              </Timeline>
            </div>
          </Part>
          <Part
            className="items-center"
            name="meter"
            page="components/base/meter"
          >
            <div className="h-36">
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
