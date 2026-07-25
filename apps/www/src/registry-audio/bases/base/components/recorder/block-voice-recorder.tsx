"use client";

import { useMemo } from "react";
import { IconPlaceholder } from "@/app/(create)/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import { ButtonGroup } from "@/registry/bases/base/ui/button-group";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/registry/bases/base/ui/empty";
import { Meter } from "@/registry-audio/bases/base/audio/elements/meter";
import { useAudioLevels } from "@/registry-audio/bases/base/hooks/use-audio-levels";
import { useMicRecorder } from "@/registry-audio/bases/base/hooks/use-mic-recorder";
import { formatRecordingTime } from "@/registry-audio/bases/base/lib/recording";

function MicIcon() {
  return (
    <IconPlaceholder
      hugeicons="Mic01Icon"
      lucide="Mic"
      phosphor="MicrophoneIcon"
      remixicon="RiMicLine"
      tabler="IconMicrophone"
    />
  );
}

function MicOffIcon() {
  return (
    <IconPlaceholder
      hugeicons="MicOff01Icon"
      lucide="MicOff"
      phosphor="MicrophoneSlashIcon"
      remixicon="RiMicOffLine"
      tabler="IconMicrophoneOff"
    />
  );
}

function StopIcon() {
  return (
    <IconPlaceholder
      hugeicons="StopIcon"
      lucide="Square"
      phosphor="StopIcon"
      remixicon="RiStopLine"
      tabler="IconPlayerStop"
    />
  );
}

function DiscardIcon() {
  return (
    <IconPlaceholder
      hugeicons="Delete02Icon"
      lucide="Trash2"
      phosphor="TrashIcon"
      remixicon="RiDeleteBinLine"
      tabler="IconTrash"
    />
  );
}

function statusLabel(isRecording: boolean, isPaused: boolean): string {
  if (!isRecording) {
    return "Ready to play";
  }
  return isPaused ? "Paused" : "Recording";
}

function StatusLine({
  durationMs,
  isPaused,
  isRecording,
}: {
  durationMs: number;
  isPaused: boolean;
  isRecording: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        {isRecording ? (
          <span
            aria-hidden="true"
            className={`size-2 rounded-full bg-destructive ${isPaused ? "" : "animate-pulse"}`}
          />
        ) : null}
        {statusLabel(isRecording, isPaused)}
      </span>
      <span className="tabular-nums">{formatRecordingTime(durationMs)}</span>
    </div>
  );
}

/** A voice recorder: capture from the microphone with a live input meter and elapsed time, then play back or download the take. The recorder owns permission, the MediaRecorder, and the blob's object URL — this block only presents them. */
export default function BlockVoiceRecorder() {
  const {
    analyser,
    clear,
    durationMs,
    error,
    isPaused,
    isRecording,
    pause,
    recording,
    resume,
    start,
    stop,
  } = useMicRecorder();

  // Memoized: a new array identity restarts level sampling every render.
  const analysers = useMemo(() => [analyser], [analyser]);
  const { levels, peaks } = useAudioLevels(analysers);

  const hasTake = Boolean(recording) && !isRecording;

  return (
    <div className="cn-audio-panel flex w-full min-w-0 flex-col gap-4 border bg-card p-4">
      {isRecording || recording ? (
        <div className="flex flex-col gap-3">
          <Meter
            aria-label="Microphone input level"
            peak={peaks}
            value={levels}
          />
          <StatusLine
            durationMs={durationMs}
            isPaused={isPaused}
            isRecording={isRecording}
          />
        </div>
      ) : (
        <Empty className="h-20 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MicIcon />
            </EmptyMedia>
            <EmptyTitle>{error ?? "Nothing recorded yet"}</EmptyTitle>
          </EmptyHeader>
        </Empty>
      )}

      {hasTake && recording ? (
        // Deliberately a plain element, not our own AudioPlayer: the player's
        // store and engine are module-level singletons, so mounting it here
        // would join — and fight over — whatever playback session the page
        // already has. Switch to AudioPlayer once it is instance-scoped.
        // biome-ignore lint/a11y/useMediaCaption: a just-captured microphone take has no caption track to offer
        <audio className="w-full" controls src={recording.url} />
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <ButtonGroup>
          <Button
            aria-label={isRecording ? "Stop recording" : "Start recording"}
            onClick={isRecording ? stop : start}
            size="icon"
            type="button"
            variant={isRecording ? "destructive" : "outline"}
          >
            {isRecording ? <StopIcon /> : <MicIcon />}
          </Button>
          {isRecording ? (
            <Button
              aria-label={isPaused ? "Resume recording" : "Pause recording"}
              onClick={isPaused ? resume : pause}
              size="icon"
              type="button"
              variant="outline"
            >
              {isPaused ? <MicIcon /> : <MicOffIcon />}
            </Button>
          ) : null}
          {hasTake ? (
            <Button
              aria-label="Discard recording"
              onClick={clear}
              size="icon"
              type="button"
              variant="outline"
            >
              <DiscardIcon />
            </Button>
          ) : null}
        </ButtonGroup>
        {hasTake && recording ? (
          <a
            className="text-muted-foreground text-xs underline underline-offset-4 hover:text-foreground"
            download="recording"
            href={recording.url}
          >
            Download
          </a>
        ) : null}
      </div>
    </div>
  );
}
