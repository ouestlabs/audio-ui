"use client";

import { createSource } from "@audio-ui/react";
import type { ChangeEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
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
import { Scrubber } from "@/registry-audio/bases/base/audio/elements/scrubber";
import { Waveform } from "@/registry-audio/bases/base/audio/elements/waveform";
import {
  type AudioPeaks,
  computePeaks,
  decodeAudioChannels,
  normalizePeaks,
} from "@/registry-audio/bases/base/lib/waveform-dsp";

// More slices than the waveform has bars at any width; it keeps each bar's lowest and highest.
const PEAK_COUNT = 2048;
const EMPTY_PEAKS: number[] = [];

/** A seekable waveform player driven entirely by a user-supplied file — nothing is preloaded. Picking a file decodes its real PCM samples via `decodeAudioChannels`/`computePeaks`/`normalizePeaks` once, keeping each slice's lowest and highest sample,, shared across two tabbed presentations of the same data: a plain recolored bar chart, and an `AudioScrubber`-style read with a `Playhead` line and `Thumb` handle. The primitive only owns the seek value, not the audio itself. */
export default function BlockWaveformPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [peaks, setPeaks] = useState<AudioPeaks | null>(null);
  const [duration, setDuration] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [position] = useState(() => createSource(0));

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
      position.set(0);
      setDuration(0);
      setPeaks(null);
      setFileName(file.name);
      setAudioUrl(url);

      // Decoding a long file takes a moment: the waveform sweeps meanwhile.
      setIsDecoding(true);
      const context = new AudioContext();
      try {
        const buffer = await file.arrayBuffer();
        const channels = await decodeAudioChannels(context, buffer);
        setPeaks(normalizePeaks(computePeaks(channels, PEAK_COUNT)));
      } finally {
        await context.close();
        setIsDecoding(false);
      }
    },
    [position]
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
      position.set(audio.currentTime);
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
  }, [audioUrl, position]);

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
    setIsPlaying(play);
  }, []);

  const handleSeekSeconds = useCallback(
    (seconds: number) => {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = seconds;
      }
      position.set(seconds);
      setProgress(duration ? seconds / duration : 0);
    },
    [duration, position]
  );

  const handleSeek = useCallback(
    (value: number) => {
      setProgress(value);
      position.set(value * duration);
      const audio = audioRef.current;
      if (audio && Number.isFinite(audio.duration)) {
        audio.currentTime = value * audio.duration;
      }
    },
    [duration, position]
  );

  const hasAudio = peaks !== null;

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
      {hasAudio || isDecoding ? (
        <Tabs className="gap-4" defaultValue="default">
          <TabsList>
            <TabsTrigger value="default">Default</TabsTrigger>
            <TabsTrigger value="playhead">Playhead</TabsTrigger>
          </TabsList>
          <TabsContent value="default">
            <Waveform
              aria-label="Track progress"
              loading={isDecoding}
              onValueChange={handleSeek}
              onValueCommitted={handleSeek}
              value={progress}
              values={peaks ?? EMPTY_PEAKS}
            />
          </TabsContent>
          <TabsContent value="playhead">
            <Waveform
              aria-label="Track progress"
              loading={isDecoding}
              onValueChange={handleSeek}
              onValueCommitted={handleSeek}
              value={progress}
              values={peaks ?? EMPTY_PEAKS}
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
      {hasAudio && duration > 0 ? (
        <Scrubber
          duration={duration}
          onPlayingChange={handlePlayingChange}
          onSeek={handleSeekSeconds}
          playing={isPlaying}
          source={position}
        />
      ) : null}
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        <Button
          aria-label={hasAudio ? "Change file" : "Upload audio"}
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
        <span className="min-w-0 flex-1 truncate">
          {hasAudio ? fileName : "Choose an audio file"}
        </span>
      </div>
    </div>
  );
}
