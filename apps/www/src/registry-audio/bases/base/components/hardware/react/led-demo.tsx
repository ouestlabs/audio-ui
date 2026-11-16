import { useCallback, useState } from "react";
import { Button } from "@/registry/bases/base/ui/button";
import { Led } from "@/registry-audio/bases/base/audio/elements/led";

export default function LedDemo() {
  const [recording, setRecording] = useState(true);
  const [muted, setMuted] = useState(false);
  const toggleRecording = useCallback(() => setRecording((on) => !on), []);
  const toggleMuted = useCallback(() => setMuted((on) => !on), []);
  return (
    <div className="flex items-center gap-6">
      <Button
        aria-pressed={recording}
        onClick={toggleRecording}
        size="sm"
        variant="outline"
      >
        <Led blink label="Recording" on={recording} tone="destructive" />
        Rec
      </Button>
      <Button
        aria-pressed={muted}
        onClick={toggleMuted}
        size="sm"
        variant="outline"
      >
        <Led label="Mute" on={muted} />
        Mute
      </Button>
      <div className="flex items-center gap-2">
        <Led label="Off" on={false} size="sm" />
        <Led label="On" on size="default" />
        <Led label="Large" on size="lg" />
      </div>
    </div>
  );
}
