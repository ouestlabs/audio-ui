"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";
import {
  silentSource,
  useAudioSession,
} from "@/registry-audio/bases/base/hooks/use-audio-session";
import {
  DEMO_SOURCES,
  type DemoSource,
  type DemoSourceName,
} from "@/registry-audio/bases/base/lib/demo-sound";

const NONE = { chosen: null, fallback: null };

/** A kick is a key for a gate or a ducker, not a sound to listen to a device through. */
const OFFERED = (Object.keys(DEMO_SOURCES) as DemoSourceName[]).filter(
  (name) => !(DEMO_SOURCES[name] as DemoSource).isKey
);

const ITEMS = OFFERED.map((name) => ({
  label: DEMO_SOURCES[name].title,
  value: name,
}));

/**
 * Picks the sound a preview's device plays, from its bar. It shows only for a
 * device that has said which sound it plays by default (`useDemoSource`), and
 * what is chosen goes to that device through the session, so it restarts on
 * the new sound while it plays.
 */
export function SourceSelect() {
  const source = useAudioSession()?.source ?? silentSource;
  const { chosen, fallback } = useSyncExternalStore(
    source.subscribe,
    source.get,
    () => NONE
  );
  const choose = useCallback(
    (next: unknown) => {
      if (typeof next === "string") {
        source.set({ chosen: next });
      }
    },
    [source]
  );
  if (fallback === null) {
    return null;
  }
  return (
    <Select items={ITEMS} onValueChange={choose} value={chosen ?? fallback}>
      <SelectTrigger aria-label="Sound to play" className="h-8 w-24">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {ITEMS.map((item) => (
            <SelectItem
              key={item.value}
              title={DEMO_SOURCES[item.value].about}
              value={item.value}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
