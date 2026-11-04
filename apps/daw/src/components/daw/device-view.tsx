import { type ReactNode, useCallback, useMemo, useState } from "react";
import {
  DeviceChain,
  DeviceChainAdd,
  DeviceChainSlot,
  DeviceChainSlotControls,
} from "@/components/audio-ui/device-chain";
import { devicePanel } from "@/components/audio-ui/device-panels";
import { DrumRackPanel } from "@/components/audio-ui/drum-rack-panel";
import {
  type RackChainMix,
  RackPanel,
  type RackParameter,
} from "@/components/audio-ui/rack-panel";
import { Button } from "@/components/ui/button";
import type { useArrangement } from "@/hooks/use-arrangement";
import {
  DRUM_RACK_DEVICE,
  type DrumSound,
  RACK_DEVICE,
  type Rack,
  type RackMapping,
  rackDevices,
  type TrackDevice,
} from "@/lib/arrangement";
import { trackOf } from "@/lib/arrangement-state";
import { libraryDevice } from "@/lib/device-library";

type Arrangement = ReturnType<typeof useArrangement>;

/** Where a chain of devices sits: the track's own, or a chain of a rack on it. */
type ChainPlace = { chain: string; rack: string } | undefined;

/** What every slot of a chain needs: the commands of the track, and where the chain is. */
interface ChainProps {
  dispatch: Arrangement["dispatch"];
  onNoteOff: (pitch: number) => void;
  /** Plays a note of the track now, as a key does, until `onNoteOff`. */
  onNoteOn: (pitch: number, velocity: number) => void;
  /** Files dropped on the pad of `note` of the drum rack `rack`. */
  onPadFiles: (rack: string, note: number, files: File[]) => void;
  tempo: Arrangement["doc"]["tempo"];
  track: string;
}

/** One device on a chain, drawn by its own panel (DEV-008); a rack, by the rack's. */
function Slot({ device, ...chain }: ChainProps & { device: TrackDevice }) {
  const { dispatch, tempo, track } = chain;
  const face = devicePanel(device.device);
  const entry = libraryDevice(device.device);
  const change = useCallback(
    (state: TrackDevice["state"]) =>
      dispatch({ id: device.id, state, track, type: "set-device" }),
    [device.id, dispatch, track]
  );
  const toggle = useCallback(
    () => dispatch({ id: device.id, track, type: "toggle-device" }),
    [device.id, dispatch, track]
  );
  if (device.rack && device.device === DRUM_RACK_DEVICE) {
    return <DrumSlot device={device} {...chain} />;
  }
  if (device.rack) {
    return <RackSlot device={device} {...chain} />;
  }
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

/** A chain of devices, the track's or a rack's: devices dropped from the library go where they land, and move along it. */
function Chain({
  className,
  devices,
  end,
  place,
  ...chain
}: ChainProps & {
  className?: string;
  devices: readonly TrackDevice[];
  /** What closes the chain, after its last device. */
  end?: ReactNode;
  place: ChainPlace;
}) {
  const { dispatch, track } = chain;
  const order = useMemo(() => devices.map((device) => device.id), [devices]);
  const add = useCallback(
    (id: string, index?: number) => {
      const entry = libraryDevice(id);
      if (!entry || (place && entry.device.kind === "instrument")) {
        return;
      }
      dispatch({
        chain: place,
        device: id,
        index,
        instrument: entry.device.kind === "instrument",
        state: entry.device.defaults(),
        track,
        type: "add-device",
      });
    },
    [dispatch, place, track]
  );
  const move = useCallback(
    (id: string, index: number) =>
      dispatch({ chain: place, id, index, track, type: "move-device" }),
    [dispatch, place, track]
  );
  const remove = useCallback(
    (id: string) => dispatch({ id, track, type: "remove-device" }),
    [dispatch, track]
  );
  return (
    <DeviceChain
      className={className}
      flat
      onAdd={add}
      onMove={move}
      onRemove={remove}
      order={order}
    >
      {devices.map((device) => (
        <Slot device={device} key={device.id} {...chain} />
      ))}
      {end}
    </DeviceChain>
  );
}

/** What a rack's macros can turn: the parameters of every device inside it, by device. */
function parametersOf(devices: readonly TrackDevice[]): RackParameter[] {
  return devices.flatMap((device) => {
    const entry = device.rack ? undefined : libraryDevice(device.device);
    return entry
      ? entry.device.parameters.map((parameter) => ({
          device: device.id,
          deviceName: entry.device.name,
          label: parameter.label,
          parameter: parameter.id,
        }))
      : [];
  });
}

/** The commands of a rack on a track, by its id: its switch, macros, chains' mixes, and the end of a drag. */
function useRackCommands(
  dispatch: Arrangement["dispatch"],
  track: string,
  rackId: string
) {
  const settle = useCallback(
    () => dispatch({ type: "settle-clip-edit" }),
    [dispatch]
  );
  const toggle = useCallback(
    () => dispatch({ id: rackId, track, type: "toggle-device" }),
    [dispatch, rackId, track]
  );
  const turn = useCallback(
    (index: number, value: number) =>
      dispatch({ index, rack: rackId, track, type: "set-macro", value }),
    [dispatch, rackId, track]
  );
  const map = useCallback(
    (index: number, parameter: RackParameter) =>
      dispatch({
        index,
        mapping: {
          device: parameter.device,
          max: 1,
          min: 0,
          parameter: parameter.parameter,
        },
        rack: rackId,
        track,
        type: "map-macro",
      }),
    [dispatch, rackId, track]
  );
  const unmap = useCallback(
    (index: number, mapping: RackMapping) =>
      dispatch({
        device: mapping.device,
        index,
        parameter: mapping.parameter,
        rack: rackId,
        track,
        type: "unmap-macro",
      }),
    [dispatch, rackId, track]
  );
  const mix = useCallback(
    (id: string, patch: Partial<RackChainMix>) =>
      dispatch({
        chain: id,
        mix: patch,
        rack: rackId,
        track,
        type: "change-rack-chain",
      }),
    [dispatch, rackId, track]
  );
  const removeChain = useCallback(
    (id: string) =>
      dispatch({ chain: id, rack: rackId, track, type: "remove-rack-chain" }),
    [dispatch, rackId, track]
  );
  return { map, mix, removeChain, settle, toggle, turn, unmap };
}

/** A rack on a chain: its macros and chains, and the picked chain's devices (DEV-010, DEV-012). */
function RackSlot({ device, ...chain }: ChainProps & { device: TrackDevice }) {
  const { dispatch, track } = chain;
  const rack = device.rack ?? { chains: [], macros: [] };
  const rackId = device.id;
  const [picked, setPicked] = useState<string | null>(null);
  const selected =
    rack.chains.find((item) => item.id === picked) ?? rack.chains[0];
  const parameters = useMemo(() => parametersOf(rackDevices(rack)), [rack]);
  const { map, mix, removeChain, settle, toggle, turn, unmap } =
    useRackCommands(dispatch, track, rackId);
  const addChain = useCallback(
    () => dispatch({ rack: rackId, track, type: "add-rack-chain" }),
    [dispatch, rackId, track]
  );
  return (
    <DeviceChainSlot
      enabled={device.on !== false}
      onEnabledChange={toggle}
      title="Rack"
      value={device.id}
    >
      <RackPanel
        controls={<DeviceChainSlotControls />}
        enabled={device.on !== false}
        onAddChain={addChain}
        onChainMix={mix}
        onChainMixCommit={settle}
        onEnabledChange={toggle}
        onMacroChange={turn}
        onMacroCommit={settle}
        onMapMacro={map}
        onRemoveChain={removeChain}
        onSelectChain={setPicked}
        onUnmapMacro={unmap}
        parameters={parameters}
        rack={rack}
        selectedChain={selected?.id ?? null}
      >
        {selected ? (
          <Chain
            className="min-h-0"
            devices={selected.devices}
            end={
              selected.devices.length === 0 ? (
                <p className="self-center px-2 text-muted-foreground text-xs">
                  Drag a device from the library into {selected.name}.
                </p>
              ) : null
            }
            place={{ chain: selected.id, rack: rackId }}
            {...chain}
          />
        ) : null}
      </RackPanel>
    </DeviceChainSlot>
  );
}

/** The note of a drum rack's lowest pad, or C2 when it has none. */
const lowestPad = (rack: Rack) =>
  Math.min(
    ...rack.chains.flatMap((item) => (item.pad ? [item.pad.note] : [])),
    rack.chains.some((item) => item.pad) ? 127 : 36
  );

/** A drum rack, the track's instrument: its macros, its pads, and the picked pad's devices (DEV-013). */
function DrumSlot({ device, ...chain }: ChainProps & { device: TrackDevice }) {
  const { dispatch, onNoteOff, onNoteOn, onPadFiles, track } = chain;
  const rack = device.rack ?? { chains: [], macros: [] };
  const rackId = device.id;
  const [note, setNote] = useState(() => lowestPad(rack));
  const pad = rack.chains.find((item) => item.pad?.note === note);
  const parameters = useMemo(() => parametersOf(rackDevices(rack)), [rack]);
  const { map, mix, removeChain, settle, toggle, turn, unmap } =
    useRackCommands(dispatch, track, rackId);
  const setSound = useCallback(
    (at: number, sound: DrumSound, name: string) =>
      dispatch({ name, note: at, rack: rackId, sound, track, type: "set-pad" }),
    [dispatch, rackId, track]
  );
  const change = useCallback(
    (id: string, patch: { decay?: number; tune?: number }) =>
      dispatch({
        chain: id,
        rack: rackId,
        track,
        type: "change-pad",
        ...patch,
      }),
    [dispatch, rackId, track]
  );
  const drop = useCallback(
    (at: number, files: File[]) => onPadFiles(rackId, at, files),
    [onPadFiles, rackId]
  );
  return (
    <DeviceChainSlot
      enabled={device.on !== false}
      onEnabledChange={toggle}
      title="Drum rack"
      value={device.id}
    >
      <DrumRackPanel
        controls={<DeviceChainSlotControls />}
        enabled={device.on !== false}
        onChainMix={mix}
        onChainMixCommit={settle}
        onDropFiles={drop}
        onEnabledChange={toggle}
        onMacroChange={turn}
        onMacroCommit={settle}
        onMapMacro={map}
        onPadChange={change}
        onPadCommit={settle}
        onPadOff={onNoteOff}
        onPadOn={onNoteOn}
        onPadSound={setSound}
        onRemovePad={removeChain}
        onSelectNote={setNote}
        onUnmapMacro={unmap}
        parameters={parameters}
        rack={rack}
        selectedNote={note}
      >
        {pad ? (
          <Chain
            className="min-h-0"
            devices={pad.devices}
            end={
              pad.devices.length === 0 ? (
                <p className="self-center px-2 text-muted-foreground text-xs">
                  Drag a device from the library onto {pad.name}.
                </p>
              ) : null
            }
            place={{ chain: pad.id, rack: rackId }}
            {...chain}
          />
        ) : null}
      </DrumRackPanel>
    </DeviceChainSlot>
  );
}

/**
 * The devices of the selected track in a row, in the order the sound goes
 * through them: a device dragged from the library goes where it is dropped
 * on the chain (DEV-003), and the end of the chain opens the library or adds
 * a rack. Every change is a command of the arrangement, so it is one step of
 * undo and the engine follows it.
 */
export function DeviceView({
  arrangement,
  onNoteOff,
  onNoteOn,
  onOpenLibrary,
  onPadFiles,
  track,
}: {
  arrangement: Arrangement;
  /** Lets go of a note `onNoteOn` started on a track. */
  onNoteOff: (track: string, pitch: number) => void;
  /** Plays a note of a track now, through its instrument and chain, as a key does. */
  onNoteOn: (track: string, pitch: number, velocity: number) => void;
  /** Opens the library on the left, ready to search. */
  onOpenLibrary: () => void;
  /** Files dropped on a pad of a drum rack on a track: a recording for it to play. */
  onPadFiles: (
    track: string,
    rack: string,
    note: number,
    files: File[]
  ) => void;
  track: string | null;
}) {
  const { dispatch, doc } = arrangement;
  const current = track ? trackOf(doc, track) : undefined;
  const id = current?.id ?? "";
  const addRack = useCallback(
    () =>
      current &&
      dispatch({
        device: RACK_DEVICE,
        state: {},
        track: current.id,
        type: "add-device",
      }),
    [current, dispatch]
  );
  // A drum rack is an instrument: it goes first, in place of the one there was.
  const addDrumRack = useCallback(
    () =>
      current &&
      dispatch({
        device: DRUM_RACK_DEVICE,
        instrument: true,
        state: {},
        track: current.id,
        type: "add-device",
      }),
    [current, dispatch]
  );
  const noteOn = useCallback(
    (pitch: number, velocity: number) => onNoteOn(id, pitch, velocity),
    [id, onNoteOn]
  );
  const noteOff = useCallback(
    (pitch: number) => onNoteOff(id, pitch),
    [id, onNoteOff]
  );
  const padFiles = useCallback(
    (rack: string, note: number, files: File[]) =>
      onPadFiles(id, rack, note, files),
    [id, onPadFiles]
  );

  if (!current) {
    return (
      <p className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Select a track to see its devices.
      </p>
    );
  }
  return (
    <div className="flex h-full min-h-0">
      <Chain
        className="no-scrollbar scroll-fade-x min-h-0 min-w-0 flex-1 overflow-x-auto"
        devices={current.devices ?? []}
        dispatch={dispatch}
        end={
          <div className="flex shrink-0 flex-col gap-2 p-2">
            <DeviceChainAdd onClick={onOpenLibrary} />
            <Button onClick={addRack} size="sm" variant="outline">
              Add a rack
            </Button>
            {current.kind === "midi" ? (
              <Button onClick={addDrumRack} size="sm" variant="outline">
                Add a drum rack
              </Button>
            ) : null}
          </div>
        }
        onNoteOff={noteOff}
        onNoteOn={noteOn}
        onPadFiles={padFiles}
        place={undefined}
        tempo={doc.tempo}
        track={current.id}
      />
    </div>
  );
}
