import { useCallback, useMemo, useRef, useState } from "react";
import { DeviceBrowser } from "@/components/audio-ui/device-browser";
import {
  DeviceChain,
  DeviceChainAdd,
  DeviceChainSlot,
  DeviceChainSlotControls,
} from "@/components/audio-ui/device-chain";
import { devicePanel } from "@/components/audio-ui/device-panels";
import type { useArrangement } from "@/hooks/use-arrangement";
import type { TrackDevice } from "@/lib/arrangement";
import { trackOf } from "@/lib/arrangement-state";
import { DEVICE_SHELVES, libraryDevice } from "@/lib/device-library";

type Arrangement = ReturnType<typeof useArrangement>;

/** One device on the chain, drawn by its own panel (DEV-008). */
function Slot({
  device,
  onChange,
  onToggle,
  tempo,
}: {
  device: TrackDevice;
  onChange: (id: string, state: TrackDevice["state"]) => void;
  onToggle: (id: string) => void;
  tempo: Arrangement["doc"]["tempo"];
}) {
  const face = devicePanel(device.device);
  const entry = libraryDevice(device.device);
  const change = useCallback(
    (state: TrackDevice["state"]) => onChange(device.id, state),
    [device.id, onChange]
  );
  const toggle = useCallback(() => onToggle(device.id), [device.id, onToggle]);
  if (!(face && entry)) {
    return null;
  }
  return (
    <DeviceChainSlot
      className={face.width}
      enabled={device.on !== false}
      onEnabledChange={toggle}
      title={entry.device.name}
      value={device.id}
    >
      <face.Panel onValueChange={change} tempo={tempo} value={device.state}>
        <DeviceChainSlotControls />
      </face.Panel>
    </DeviceChainSlot>
  );
}

/**
 * The devices of the selected track in a row, in the order the sound goes
 * through them, with the library beside them: a device double-clicked or
 * dragged from it goes on the chain (DEV-003). Every change is a command of
 * the arrangement, so it is one step of undo and the engine follows it.
 */
export function DeviceView({
  arrangement,
  track,
}: {
  arrangement: Arrangement;
  track: string | null;
}) {
  const { dispatch, doc } = arrangement;
  const current = track ? trackOf(doc, track) : undefined;
  const devices = current?.devices ?? [];
  const order = useMemo(() => devices.map((device) => device.id), [devices]);
  const [libraryOpen, setLibraryOpen] = useState(true);
  const search = useRef<HTMLInputElement>(null);
  const shelves = useMemo(
    () =>
      DEVICE_SHELVES.map((shelf) => ({
        items: shelf.devices.map((entry) => entry.device),
        label: shelf.label,
      })),
    []
  );

  const add = useCallback(
    (id: string, index?: number) => {
      const entry = libraryDevice(id);
      if (!(entry && current)) {
        return;
      }
      dispatch({
        device: id,
        index,
        instrument: entry.device.kind === "instrument",
        state: entry.device.defaults(),
        track: current.id,
        type: "add-device",
      });
    },
    [current, dispatch]
  );
  const move = useCallback(
    (id: string, index: number) =>
      current &&
      dispatch({ id, index, track: current.id, type: "move-device" }),
    [current, dispatch]
  );
  const remove = useCallback(
    (id: string) =>
      current && dispatch({ id, track: current.id, type: "remove-device" }),
    [current, dispatch]
  );
  const change = useCallback(
    (id: string, state: TrackDevice["state"]) =>
      current && dispatch({ id, state, track: current.id, type: "set-device" }),
    [current, dispatch]
  );
  const toggle = useCallback(
    (id: string) =>
      current && dispatch({ id, track: current.id, type: "toggle-device" }),
    [current, dispatch]
  );
  const openLibrary = useCallback(() => {
    setLibraryOpen(true);
    requestAnimationFrame(() => search.current?.focus());
  }, []);

  if (!current) {
    return (
      <p className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select a track to see its devices.
      </p>
    );
  }
  return (
    <div className="flex h-full min-h-0 gap-2 p-2">
      <DeviceBrowser
        className="w-56 shrink-0"
        onOpenChange={setLibraryOpen}
        onPick={add}
        open={libraryOpen}
        searchRef={search}
        shelves={shelves}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="px-1 text-muted-foreground text-xs">
          {current.name}
        </span>
        <DeviceChain
          className="min-h-0 flex-1 overflow-x-auto"
          onAdd={add}
          onMove={move}
          onRemove={remove}
          order={order}
        >
          {devices.map((device) => (
            <Slot
              device={device}
              key={device.id}
              onChange={change}
              onToggle={toggle}
              tempo={doc.tempo}
            />
          ))}
          <DeviceChainAdd onClick={openLibrary} />
        </DeviceChain>
      </div>
    </div>
  );
}
