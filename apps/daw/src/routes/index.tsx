import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Daw, type DawProps } from "@/components/daw/daw";
import { cachedRecording, canStream, streamRecording } from "@/lib/daw/cache";
import { newProject } from "@/lib/daw/project";
import { decodeRecording, type Recording } from "@/lib/daw/recordings";
import { loadProject, loadRecording } from "@/lib/daw/storage";
import { webAudio } from "@/lib/web-audio";

export const Route = createFileRoute("/")({
  component: Home,
});

/** A saved recording: streamed from its cache when there is one, decoded from its bytes otherwise (and cached, where it can stream). */
async function openRecording(
  context: BaseAudioContext,
  id: string,
  name: string
): Promise<Recording | null> {
  const streaming = canStream();
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
    return { initial: newProject(), initialRecordings: new Map() };
  }
  const recordings = new Map<string, Recording>();
  await saved.recordings.reduce(async (done, { id, name }) => {
    await done;
    const recording = await openRecording(context, id, name);
    if (recording) {
      recordings.set(id, recording);
    }
  }, Promise.resolve());
  return { initial: saved.doc, initialRecordings: recordings };
}

function Home() {
  const [project, setProject] = useState<DawProps | null>(null);
  useEffect(() => {
    openProject().then(setProject);
  }, []);
  if (!project) {
    return (
      <main className="flex h-svh items-center justify-center text-muted-foreground text-sm">
        Opening the project…
      </main>
    );
  }
  return <Daw {...project} />;
}
