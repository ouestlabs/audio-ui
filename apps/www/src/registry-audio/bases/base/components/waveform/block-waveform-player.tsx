"use client";

import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { ButtonGroup } from "@/registry/bases/base/ui/button-group";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/bases/base/ui/empty";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/registry/bases/base/ui/tabs";
import { Waveform } from "@/registry-audio/bases/base/audio/elements/waveform";
import {
  decodeAudioSamples,
  downsampleWaveform,
  normalizeWaveform,
} from "@/registry-audio/bases/base/lib/waveform-dsp";

// More peaks than the waveform has bars at any width; it keeps the loudest per bar.
const PEAK_COUNT = 1024;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return "0:00";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function toIsoDuration(seconds: number): string {
  if (!Number.isFinite(seconds)) {
    return "PT0S";
  }
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remainingSeconds = whole % 60;
  return `PT${minutes}M${remainingSeconds}S`;
}

/** A seekable waveform player driven entirely by a user-supplied file — nothing is preloaded. Picking a file decodes its real PCM samples via `decodeAudioSamples`/`downsampleWaveform`/`normalizeWaveform` once, shared across two tabbed presentations of the same data: a plain recolored bar chart, and an `AudioScrubber`-style read with a `Playhead` line and `Thumb` handle. The primitive only owns the seek value, not the audio itself. */
export default function BlockWaveformPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [values, setValues] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(
    () => () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    },
    []
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) {
        return;
      }

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;

      setIsPlaying(false);
      setProgress(0);
      setDuration(0);
      setValues([]);
      setFileName(file.name);
      setAudioUrl(url);

      const context = new AudioContext();
      const buffer = await file.arrayBuffer();
      const samples = await decodeAudioSamples(context, buffer);
      await context.close();

      const downsampled = downsampleWaveform(samples, PEAK_COUNT);
      setValues(normalizeWaveform(downsampled));
    },
    []
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

    const handleTimeUpdate = () => {
      setProgress(audio.duration ? audio.currentTime / audio.duration : 0);
    };
    const handleDurationChange = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);

    audio.addEventListener("timeupdate", handleTimeUpdate, { signal });
    audio.addEventListener("loadedmetadata", handleDurationChange, {
      signal,
    });
    audio.addEventListener("durationchange", handleDurationChange, {
      signal,
    });
    audio.addEventListener("ended", handleEnded, { signal });
    if (audio.readyState >= HTMLMediaElement.HAVE_METADATA) {
      handleDurationChange();
      handleTimeUpdate();
    }
    return () => controller.abort();
  }, [audioUrl]);

  const handlePlayToggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const handleSeek = useCallback((value: number) => {
    setProgress(value);
    const audio = audioRef.current;
    if (audio && Number.isFinite(audio.duration)) {
      audio.currentTime = value * audio.duration;
    }
  }, []);

  const hasAudio = values.length > 0;

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
      {hasAudio ? (
        <Tabs className="gap-4" defaultValue="default">
          <TabsList>
            <TabsTrigger value="default">Default</TabsTrigger>
            <TabsTrigger value="playhead">Playhead</TabsTrigger>
          </TabsList>
          <TabsContent value="default">
            <Waveform
              aria-label="Track progress"
              onValueChange={handleSeek}
              onValueCommitted={handleSeek}
              value={progress}
              values={values}
            />
          </TabsContent>
          <TabsContent value="playhead">
            <Waveform
              aria-label="Track progress"
              onValueChange={handleSeek}
              onValueCommitted={handleSeek}
              value={progress}
              values={values}
              variant="playhead"
            />
          </TabsContent>
        </Tabs>
      ) : (
        <Empty className="h-20 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <IconPlaceholder
                hugeicons="MusicNote01Icon"
                lucide="Music"
                phosphor="MusicNotesIcon"
                remixicon="RiMusicLine"
                tabler="IconMusic"
              />
            </EmptyMedia>
            <EmptyTitle>No audio loaded</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}
      <div className="flex items-center justify-between gap-4">
        <ButtonGroup>
          <Button
            aria-label={isPlaying ? "Pause" : "Play"}
            disabled={!hasAudio}
            onClick={handlePlayToggle}
            size="icon"
            type="button"
            variant="outline"
          >
            <IconPlaceholder
              hugeicons={isPlaying ? "PauseIcon" : "PlayIcon"}
              lucide={isPlaying ? "PauseIcon" : "PlayIcon"}
              phosphor={isPlaying ? "PauseIcon" : "PlayIcon"}
              remixicon={isPlaying ? "RiPauseLine" : "RiPlayLine"}
              tabler={isPlaying ? "IconPlayerPause" : "IconPlayerPlay"}
            />
          </Button>
          <Button
            aria-label={hasAudio ? "Change file" : "Upload audio"}
            onClick={handleUploadClick}
            size="icon"
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
        </ButtonGroup>
        {hasAudio ? (
          <div className="flex min-w-0 items-center gap-2 text-muted-foreground text-xs">
            <span className="min-w-8 flex-1 truncate">{fileName}</span>
            <span className="shrink-0 whitespace-nowrap tabular-nums">
              <time dateTime={toIsoDuration(progress * duration)}>
                {formatTime(progress * duration)}
              </time>{" "}
              /{" "}
              <time dateTime={toIsoDuration(duration)}>
                {formatTime(duration)}
              </time>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
