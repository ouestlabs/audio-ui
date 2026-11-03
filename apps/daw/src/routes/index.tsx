import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Daw, type DawProps } from "@/components/daw/daw";
import { newProject } from "@/lib/daw/project";
import { decodeRecording, type Recording } from "@/lib/daw/recordings";
import { loadProject, loadRecording } from "@/lib/daw/storage";
import { webAudio } from "@/lib/web-audio";

export const Route = createFileRoute("/")({
  component: Home,
});

/** The project kept in the browser, its recordings decoded again, or a new one. */
async function openProject(): Promise<DawProps> {
  const saved = await loadProject();
  const context = webAudio.getContext();
  if (!(saved && context)) {
    return { initial: newProject(), initialRecordings: new Map() };
  }
  const decoded = await Promise.all(
    saved.recordings.map(async ({ id, name }) => {
      const bytes = await loadRecording(id);
      const recording = bytes
        ? await decodeRecording(context, bytes, name)
        : null;
      return [id, recording] as const;
    })
  );
  const recordings = new Map<string, Recording>();
  for (const [id, recording] of decoded) {
    if (recording) {
      recordings.set(id, recording);
    }
  }
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
