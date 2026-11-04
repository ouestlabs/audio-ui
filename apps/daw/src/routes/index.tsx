import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Daw, type DawProps } from "@/components/daw/daw";
import { padRecordings } from "@/lib/arrangement";
import { allTracks } from "@/lib/arrangement-state";
import {
  cachedRecording,
  canStream,
  pruneCache,
  streamRecording,
} from "@/lib/daw/cache";
import { recallFolder } from "@/lib/daw/folder";
import { newProject } from "@/lib/daw/project";
import { decodeRecording, type Recording } from "@/lib/daw/recordings";
import { loadProject, loadRecording, pruneRecordings } from "@/lib/daw/storage";
import { webAudio } from "@/lib/web-audio";

export const Route = createFileRoute("/")({
  component: Home,
});

/**
 * A saved recording: streamed from its cache when there is one, decoded from
 * its bytes otherwise (and cached, where it can stream). One a drum rack's pad
 * plays (`whole`) stays decoded: a pad plays it at once.
 */
async function openRecording(
  context: BaseAudioContext,
  id: string,
  name: string,
  whole: boolean
): Promise<Recording | null> {
  const streaming = canStream() && !whole;
  const cached = streaming
    ? await cachedRecording(id, name, context.sampleRate)
    : null;
  if (cached) {
    return cached;
  }
  const bytes = await loadRecording(id);
  const decoded = bytes ? await decodeRecording(context, bytes, name) : null;
  return decoded && streaming ? streamRecording(id, decoded) : decoded;
}

/** The project kept in the browser, its recordings opened one after the other, or a new one. */
async function openProject(): Promise<DawProps> {
  const saved = await loadProject();
  const context = webAudio.getContext();
  if (!(saved && context)) {
    return {
      folder: null,
      initial: newProject(),
      initialRecordings: new Map(),
    };
  }
  // Before anything streams, while no file is held open: what the project no longer has goes.
  const kept = new Set(saved.recordings.map((recording) => recording.id));
  await Promise.all([pruneRecordings(kept), pruneCache(kept)]);
  const pads = padRecordings(allTracks(saved.doc));
  const recordings = new Map<string, Recording>();
  await saved.recordings.reduce(async (done, { id, name }) => {
    await done;
    const recording = await openRecording(context, id, name, pads.has(id));
    if (recording) {
      recordings.set(id, recording);
    }
  }, Promise.resolve());
  return { folder: null, initial: saved.doc, initialRecordings: recordings };
}

function Home() {
  // A project opened from a folder takes the place of this one: a new workstation, from its own state.
  const [project, setProject] = useState<{
    opened: number;
    props: DawProps;
  } | null>(null);
  useEffect(() => {
    Promise.all([openProject(), recallFolder()]).then(([props, folder]) =>
      setProject({ opened: 0, props: { ...props, folder } })
    );
  }, []);
  const open = useCallback(
    (props: DawProps) =>
      setProject((current) => ({
        opened: (current?.opened ?? 0) + 1,
        props,
      })),
    []
  );
  if (!project) {
    return (
      <main className="flex h-svh items-center justify-center text-muted-foreground text-sm">
        Opening the project…
      </main>
    );
  }
  return <Daw {...project.props} key={project.opened} onOpen={open} />;
}
