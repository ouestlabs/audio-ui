"use client";

import { createSource } from "@audio-ui/react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { Toggle } from "@/registry/bases/base/ui/toggle";
import { Scrubber } from "@/registry-audio/bases/base/audio/elements/scrubber";
import {
  Timeline,
  TimelineLane,
  TimelineMark,
  TimelineNavigator,
  TimelineRuler,
  TimelineViewport,
} from "@/registry-audio/bases/base/audio/elements/timeline";
import {
  Waveform,
  WaveformHover,
  WaveformMarker,
  WaveformRegion,
  WaveformRegionHandle,
} from "@/registry-audio/bases/base/audio/elements/waveform";
import {
  type AudioPeaks,
  computePeaks,
  decodeAudioChannels,
  normalizePeaks,
} from "@/registry-audio/bases/base/lib/waveform-dsp";

// More slices than the waveform has bars at any width or zoom; it keeps each bar's lowest and highest.
const PEAK_COUNT = 4096;
const EMPTY_PEAKS: number[] = [];
/** How many times closer than the whole track the view can zoom. */
const MAX_ZOOM_FACTOR = 16;
const ZOOM_STEP = 1.5;
/** How far in from the view's edge the playhead may go before the view turns the page, as a share of the view. */
const PAGE_MARGIN = 0.1;
/** The ruler's label spacings, in seconds: the first one that leaves room for the labels. */
const LABEL_STEPS = [1, 2, 5, 10, 15, 30, 60];
const MIN_LABEL_GAP_PX = 56;
const SAMPLE_SECONDS = 24;
const SAMPLE_RATE = 22_050;
const SAMPLE_NAME = "Sample loop";
/** A pentatonic phrase, in Hz, one note per half second. */
const SAMPLE_NOTES = [220, 261.6, 293.7, 329.6, 392, 329.6, 293.7, 261.6];
const MAX_MARKERS = 12;

/** A short synthesized phrase as a WAV file, so the player has something to show before a file is picked. */
function makeSampleWav(): Blob {
  const samples = SAMPLE_SECONDS * SAMPLE_RATE;
  const bytes = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(bytes);
  const writeText = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeText(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeText(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index += 1) {
    const time = index / SAMPLE_RATE;
    const step = Math.floor(time * 2);
    const note = SAMPLE_NOTES[step % SAMPLE_NOTES.length] ?? 220;
    const sinceNote = time * 2 - step;
    // A swell over each four bars, so the shape has sections to loop and mark.
    const section = 0.35 + 0.65 * Math.abs(Math.sin(time / 4));
    const level = section * Math.exp(-sinceNote * 3) * 0.8;
    const sample = Math.sin(2 * Math.PI * note * time) * level;
    view.setInt16(44 + index * 2, Math.round(sample * 30_000), true);
  }
  return new Blob([bytes], { type: "audio/wav" });
}

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

const formatTime = (seconds: number) => {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
};

/**
 * A player that shows what a seekable waveform does: a press or a drag seeks,
 * hovering names the time under the pointer, Shift + drag selects the loop, a
 * loop region has handles to drag and plays on repeat, markers sit on the timeline, and zooming shows a stretch
 * of the audio while the view follows the playhead. It starts on a synthesized
 * phrase and takes any audio file you pick; its shape is decoded once with
 * `decodeAudioChannels`, `computePeaks` and `normalizePeaks`.
 */
export default function BlockWaveformPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const loopRef = useRef({
    on: true,
    region: [0, 0] as readonly [number, number],
  });
  const [position] = useState(() => createSource(0));
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState(SAMPLE_NAME);
  const [peaks, setPeaks] = useState<AudioPeaks | null>(null);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [decoding, setDecoding] = useState(false);
  const [loopOn, setLoopOn] = useState(true);
  const [loop, setLoop] = useState<readonly [number, number]>([0, 0]);
  const [markers, setMarkers] = useState<number[]>([]);
  // Pixels per second; null while the whole track fits the width it is given.
  const [zoomPx, setZoomPx] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  const fitPx = width > 0 && duration > 0 ? width / duration : 0;
  const zoom = Math.max(zoomPx ?? fitPx, fitPx);
  const zoomed = fitPx > 0 && zoom > fitPx * 1.001;
  const zoomRef = useRef({ px: 0, zoomed: false });
  zoomRef.current = { px: zoom, zoomed };

  loopRef.current = { on: loopOn, region: loop };

  const load = useCallback(
    async (blob: Blob, name: string) => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      setPlaying(false);
      position.set(0);
      setDuration(0);
      setPeaks(null);
      setMarkers([]);
      setZoomPx(null);
      setFileName(name);
      setAudioUrl(url);

      // Decoding a long file takes a moment: the waveform sweeps meanwhile.
      setDecoding(true);
      const context = new AudioContext();
      try {
        const channels = await decodeAudioChannels(
          context,
          await blob.arrayBuffer()
        );
        setPeaks(normalizePeaks(computePeaks(channels, PEAK_COUNT)));
      } finally {
        await context.close();
        setDecoding(false);
      }
    },
    [position]
  );

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(entry?.contentRect.width ?? 0);
    });
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  // Starts on the synthesized phrase.
  useEffect(() => {
    load(makeSampleWav(), SAMPLE_NAME);
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, [load]);

  const handleFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (file) {
        load(file, file.name);
      }
    },
    [load]
  );

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: audioUrl gates when audioRef.current first exists
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    const controller = new AbortController();
    const { signal } = controller;
    const handleDurationChange = () => {
      if (!Number.isFinite(audio.duration)) {
        return;
      }
      setDuration(audio.duration);
      setLoop([audio.duration * 0.25, audio.duration * 0.55]);
    };
    const handleEnded = () => setPlaying(false);
    audio.addEventListener("loadedmetadata", handleDurationChange, { signal });
    audio.addEventListener("ended", handleEnded, { signal });
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      handleDurationChange();
    }
    return () => controller.abort();
  }, [audioUrl]);

  // While it plays: follow the clock every frame, loop inside the region, and turn the page when the playhead leaves a zoomed view.
  useEffect(() => {
    const audio = audioRef.current;
    if (!(playing && audio)) {
      return;
    }
    let frame = 0;
    const tick = () => {
      const { on, region } = loopRef.current;
      if (on && region[1] > region[0] && audio.currentTime >= region[1]) {
        audio.currentTime = region[0];
      }
      position.set(audio.currentTime);
      const { px, zoomed: isZoomed } = zoomRef.current;
      if (isZoomed) {
        followPlayhead(viewportRef.current, audio.currentTime * px);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, position]);

  const handlePlayingChange = useCallback((play: boolean) => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (play) {
      audio.play();
    } else {
      audio.pause();
    }
    setPlaying(play);
  }, []);

  const handleSeek = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = seconds;
      }
      position.set(seconds);
    },
    [position]
  );

  const addMarker = useCallback(() => {
    const time = position.getSnapshot();
    setMarkers((current) =>
      current.length >= MAX_MARKERS || current.includes(time)
        ? current
        : [...current, time].sort((a, b) => a - b)
    );
  }, [position]);

  const zoomIn = useCallback(
    () => setZoomPx(Math.min(fitPx * MAX_ZOOM_FACTOR, zoom * ZOOM_STEP)),
    [fitPx, zoom]
  );
  const zoomOut = useCallback(
    () => setZoomPx(Math.max(fitPx, zoom / ZOOM_STEP)),
    [fitPx, zoom]
  );
  const handleZoomChange = useCallback((next: number) => setZoomPx(next), []);

  const labelStep =
    LABEL_STEPS.find((step) => step * zoom >= MIN_LABEL_GAP_PX) ??
    LABEL_STEPS.at(-1) ??
    1;
  const labels = Array.from(
    { length: duration > 0 ? Math.floor(duration / labelStep) + 1 : 0 },
    (_, index) => index * labelStep
  );

  const ready = peaks !== null && duration > 0;

  return (
    <div className="cn-audio-panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4">
      <input
        accept="audio/*"
        className="sr-only"
        onChange={handleFileChange}
        ref={fileInputRef}
        type="file"
      />
      {audioUrl ? (
        <audio ref={audioRef} src={audioUrl}>
          <track kind="metadata" />
        </audio>
      ) : null}
      <div ref={frameRef}>
        <Timeline
          disabled={!ready}
          duration={duration || 1}
          maxZoom={Math.max(fitPx * MAX_ZOOM_FACTOR, 1)}
          minZoom={fitPx || 0}
          onPositionChange={handleSeek}
          onZoomChange={handleZoomChange}
          source={position}
          zoom={fitPx > 0 ? zoom : undefined}
        >
          <TimelineViewport
            className="overflow-y-hidden rounded-lg border"
            ref={viewportRef}
            scrollbar="hidden"
          >
            <TimelineRuler aria-label="Position" getAriaValueText={formatTime}>
              {labels.map((seconds) => (
                <TimelineMark key={seconds} value={seconds}>
                  {formatTime(seconds)}
                </TimelineMark>
              ))}
            </TimelineRuler>
            <TimelineLane className="h-20">
              <Waveform
                aria-label="Track position"
                // The viewport is the frame: the waveform fills the lane without a box of its own.
                className="h-20 rounded-none border-0 bg-transparent"
                disabled={!ready}
                duration={duration || 1}
                getAriaValueText={formatTime}
                loading={decoding || !ready}
                onSelectionChange={setLoop}
                onValueChange={handleSeek}
                source={position}
                values={peaks ?? EMPTY_PEAKS}
                variant="playhead"
              >
                {ready ? (
                  <WaveformRegion onValueChange={setLoop} value={loop}>
                    <WaveformRegionHandle
                      aria-label="Loop start"
                      edge="start"
                      getAriaValueText={formatTime}
                    />
                    <WaveformRegionHandle
                      aria-label="Loop end"
                      edge="end"
                      getAriaValueText={formatTime}
                    />
                  </WaveformRegion>
                ) : null}
                {markers.map((time, index) => (
                  <WaveformMarker key={time} value={time}>
                    {index + 1}
                  </WaveformMarker>
                ))}
                <WaveformHover format={formatTime} />
              </Waveform>
            </TimelineLane>
          </TimelineViewport>
          <TimelineNavigator className="mt-2" getAriaValueText={formatTime} />
        </Timeline>
      </div>
      {ready ? (
        <Scrubber
          duration={duration}
          onPlayingChange={handlePlayingChange}
          onSeek={handleSeek}
          playing={playing}
          source={position}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs">
        <Toggle
          aria-label="Loop the region"
          onPressedChange={setLoopOn}
          pressed={loopOn}
          size="sm"
          variant="outline"
        >
          <IconPlaceholder
            hugeicons="RepeatIcon"
            lucide="RepeatIcon"
            phosphor="RepeatIcon"
            remixicon="RiRepeatLine"
            tabler="IconRepeat"
          />
          Loop
        </Toggle>
        <Button
          disabled={!ready || markers.length >= MAX_MARKERS}
          onClick={addMarker}
          size="sm"
          type="button"
          variant="outline"
        >
          Add marker
        </Button>
        <div className="flex items-center gap-1">
          <Button
            aria-label="Zoom out"
            disabled={!(ready && zoomed)}
            onClick={zoomOut}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <IconPlaceholder
              hugeicons="ZoomOutAreaIcon"
              lucide="ZoomOutIcon"
              phosphor="MagnifyingGlassMinusIcon"
              remixicon="RiZoomOutLine"
              tabler="IconZoomOut"
            />
          </Button>
          <span className="min-w-8 text-center tabular-nums">
            {fitPx > 0 ? (zoom / fitPx).toFixed(zoomed ? 1 : 0) : 1}×
          </span>
          <Button
            aria-label="Zoom in"
            disabled={!ready || zoom >= fitPx * MAX_ZOOM_FACTOR * 0.999}
            onClick={zoomIn}
            size="icon-sm"
            type="button"
            variant="outline"
          >
            <IconPlaceholder
              hugeicons="ZoomInAreaIcon"
              lucide="ZoomInIcon"
              phosphor="MagnifyingGlassPlusIcon"
              remixicon="RiZoomInLine"
              tabler="IconZoomIn"
            />
          </Button>
        </div>
        <Button
          aria-label="Choose an audio file"
          className="ml-auto"
          onClick={handleUploadClick}
          size="icon-sm"
          type="button"
          variant="outline"
        >
          <IconPlaceholder
            hugeicons="Upload01Icon"
            lucide="UploadIcon"
            phosphor="UploadIcon"
            remixicon="RiUploadLine"
            tabler="IconUpload"
          />
        </Button>
        <span className="max-w-32 truncate">{fileName}</span>
      </div>
    </div>
  );
}
