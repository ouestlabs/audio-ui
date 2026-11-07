"use client";

import type { ParameterValue } from "@audio-ui/core/device";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { Button } from "@/registry/bases/base/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/registry/bases/base/ui/dropdown-menu";
import { devicePanel } from "@/registry-audio/bases/base/audio/device-panels";
import {
  DeviceChain,
  DeviceChainSlot,
  DeviceChainSlotControls,
} from "@/registry-audio/bases/base/audio/elements/device-chain";
import { DrumRackPanel } from "@/registry-audio/bases/base/audio/panels/drum-rack-panel";
import {
  type RackChainMix,
  RackPanel,
  type RackParameter,
} from "@/registry-audio/bases/base/audio/panels/rack-panel";
import type { useArrangement } from "@/registry-audio/bases/base/hooks/use-arrangement";
import {
  type AutomationFollowing,
  useAutomatedDevice,
  useAutomatedRack,
} from "@/registry-audio/bases/base/hooks/use-track-automation";
import {
  type ArrangementTrack,
  type AutomatedParameter,
  type ChainZone,
  DRUM_RACK_DEVICE,
  type DrumSound,
  INSTRUMENT_RACK_DEVICE,
  RACK_DEVICE,
  type Rack,
  type RackMapping,
  rackDevices,
  type TrackDevice,
} from "@/registry-audio/bases/base/lib/arrangement";
import { trackOf } from "@/registry-audio/bases/base/lib/arrangement-state";
import { libraryDevice } from "@/registry-audio/bases/base/lib/device-library";

type Arrangement = ReturnType<typeof useArrangement>;

/** What a device view remembers per device or rack, by its id: whether a slot is folded, the chain or pad picked, what a rack shows. */
export interface DeviceViewEntries {
  deviceFolded: boolean;
  drumNote: number;
  rackChain: string;
  rackMacros: boolean;
  rackZones: boolean;
}

/** `useState` for one of those entries, by the id of the device it is for. Give one that keeps them, such as in storage, so they come back; without one they last as long as the view. */
export type DeviceViewMemory = <Entry extends keyof DeviceViewEntries>(
  entry: Entry,
  id: string,
  fallback: DeviceViewEntries[Entry]
) => readonly [
  DeviceViewEntries[Entry],
  (value: DeviceViewEntries[Entry]) => void,
];

/** The memory a view has by default: `useState`, so an entry lasts as long as the view. */
function useLocalEntry<Entry extends keyof DeviceViewEntries>(
  _entry: Entry,
  _id: string,
  fallback: DeviceViewEntries[Entry]
) {
  return useState(fallback);
}

/** Where a chain of devices sits: the track's own, or a chain of a rack on it, which takes an instrument at its head in an instrument rack. */
type ChainPlace =
  | { chain: string; instruments?: boolean; rack: string }
  | undefined;

/** What every slot of a chain needs: the commands of the track, and where the chain is. */
interface ChainProps {
  /** The notes held now, such as on a MIDI keyboard: an instrument's keys or pads light them up. */
  activeNotes?: readonly number[];
  dispatch: Arrangement["dispatch"];
  /** What the controls follow their envelopes by (AUT-006). */
  following: AutomationFollowing;
  /** A note held by an instrument's panel, such as its pad, by its note parameters; `null` lets it go. */
  onHoldNote: (note: Readonly<Record<string, number>> | null) => void;
  /** Parameters of a device moved by hand, by their ids: those automated stop following their envelopes (AUT-003). */
  onMoved: (device: string, parameters: readonly string[]) => void;
  onNoteOff: (pitch: number) => void;
  /** Plays a note of the track now, as a key does, until `onNoteOff`. */
  onNoteOn: (pitch: number, velocity: number) => void;
  /** Files dropped on the pad of `note` of the drum rack `rack`. */
  onPadFiles: (rack: string, note: number, files: File[]) => void;
  /** The track the chain is on, with its envelopes. */
  owner: ArrangementTrack;
  tempo: Arrangement["doc"]["tempo"];
  track: string;
  /** Where the view keeps what it remembers per device. */
  useEntry: DeviceViewMemory;
}

/** Whether a slot is folded, kept with the view by the device's id. */
interface SlotFold {
  folded: boolean;
  onFoldedChange: (folded: boolean) => void;
}

/** One device on a chain, drawn by its own panel (DEV-008); a rack, by the rack's. */
function Slot({ device, ...chain }: ChainProps & { device: TrackDevice }) {
  const { dispatch, tempo, track } = chain;
  const face = devicePanel(device.device);
  const entry = libraryDevice(device.device);
  const { following, onMoved, owner } = chain;
  // Its panel shows what plays: the parameters with an envelope where it stands.
  const shown = useAutomatedDevice(
    owner,
    device,
    entry?.device.denormalize as
      | ((id: string, position: number) => ParameterValue)
      | undefined,
    following
  );
  // Only what the hand moved is kept: the others stay as set, not where their envelopes stood.
  const change = useCallback(
    (state: TrackDevice["state"]) => {
      const moved = Object.keys(state).filter((id) => state[id] !== shown[id]);
      onMoved(device.id, moved);
      dispatch({
        id: device.id,
        state: {
          ...device.state,
          ...Object.fromEntries(moved.map((id) => [id, state[id] as never])),
        },
        track,
        type: "set-device",
      });
    },
    [device.id, device.state, dispatch, onMoved, shown, track]
  );
  const toggle = useCallback(
    () => dispatch({ id: device.id, track, type: "toggle-device" }),
    [device.id, dispatch, track]
  );
  const { activeNotes, onHoldNote } = chain;
  const release = useCallback(() => onHoldNote(null), [onHoldNote]);
  const [folded, setFolded] = chain.useEntry("deviceFolded", device.id, false);
  const fold = { folded, onFoldedChange: setFolded };
  if (device.rack && device.device === DRUM_RACK_DEVICE) {
    return <DrumSlot device={device} fold={fold} {...chain} />;
  }
  if (device.rack) {
    return <RackSlot device={device} fold={fold} {...chain} />;
  }
  if (!(face && entry)) {
    return null;
  }
  return (
    <DeviceChainSlot
      className={face.width}
      enabled={device.on !== false}
      folded={folded}
      onEnabledChange={toggle}
      onFoldedChange={setFolded}
      title={entry.device.name}
      value={device.id}
    >
      <face.Panel
        activeNotes={activeNotes}
        onNoteOff={release}
        onNoteOn={onHoldNote}
        onValueChange={change}
        tempo={tempo}
        value={shown}
      >
        <DeviceChainSlotControls />
      </face.Panel>
    </DeviceChainSlot>
  );
}

/** Whether the device `id` on the track, wherever it is, is an instrument. */
function instrumentHeld(owner: ArrangementTrack, id: string) {
  const devices = owner.devices ?? [];
  return [
    ...devices,
    ...devices.flatMap((item) => (item.rack ? rackDevices(item.rack) : [])),
  ].some((item) => item.id === id && item.instrument === true);
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
  const along = useMemo(
    () => (place ? { chain: place.chain, rack: place.rack } : undefined),
    [place]
  );
  const add = useCallback(
    (id: string, index?: number) => {
      const entry = libraryDevice(id);
      if (
        !entry ||
        (place && !place.instruments && entry.device.kind === "instrument")
      ) {
        return;
      }
      dispatch({
        chain: along,
        device: id,
        index,
        instrument: entry.device.kind === "instrument",
        state: entry.device.defaults(),
        track,
        type: "add-device",
      });
    },
    [along, dispatch, place, track]
  );
  const move = useCallback(
    (id: string, index: number) =>
      dispatch({ chain: along, id, index, track, type: "move-device" }),
    [along, dispatch, track]
  );
  const remove = useCallback(
    (id: string) => dispatch({ id, track, type: "remove-device" }),
    [dispatch, track]
  );
  // A device of the track, from another of its chains. An effect rack takes no instrument; the state refuses the rest.
  const receive = useCallback(
    (id: string, index: number) =>
      dispatch({ chain: along, id, index, track, type: "carry-device" }),
    [along, dispatch, track]
  );
  const { owner } = chain;
  const noInstruments = place !== undefined && !place.instruments;
  const canReceive = useCallback(
    (id: string) => !(noInstruments && instrumentHeld(owner, id)),
    [noInstruments, owner]
  );
  return (
    <DeviceChain
      canReceive={canReceive}
      className={className}
      flat
      onAdd={add}
      onMove={move}
      onReceive={receive}
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
  rackId: string,
  onMoved: ChainProps["onMoved"]
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
    (index: number, value: number) => {
      onMoved(rackId, [`macro-${index + 1}`]);
      dispatch({ index, rack: rackId, track, type: "set-macro", value });
    },
    [dispatch, onMoved, rackId, track]
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
function RackSlot({
  device,
  fold,
  ...chain
}: ChainProps & { device: TrackDevice; fold: SlotFold }) {
  const { dispatch, track } = chain;
  const rack = device.rack ?? { chains: [], macros: [] };
  const rackId = device.id;
  // An instrument rack's chains each start with an instrument (DEV-014).
  const layered = device.device === INSTRUMENT_RACK_DEVICE;
  const [picked, setPicked] = chain.useEntry("rackChain", rackId, "");
  const [macrosShown, setMacrosShown] = chain.useEntry(
    "rackMacros",
    rackId,
    false
  );
  const [zonesShown, setZonesShown] = chain.useEntry(
    "rackZones",
    rackId,
    false
  );
  const selected =
    rack.chains.find((item) => item.id === picked) ?? rack.chains[0];
  const place = useMemo(
    () =>
      selected
        ? { chain: selected.id, instruments: layered, rack: rackId }
        : undefined,
    [layered, rackId, selected]
  );
  const parameters = useMemo(() => parametersOf(rackDevices(rack)), [rack]);
  const shownRack = useAutomatedRack(
    chain.owner,
    device,
    rack,
    chain.following
  );
  const { map, mix, removeChain, settle, toggle, turn, unmap } =
    useRackCommands(dispatch, track, rackId, chain.onMoved);
  const addChain = useCallback(
    () => dispatch({ rack: rackId, track, type: "add-rack-chain" }),
    [dispatch, rackId, track]
  );
  // An instrument rack's chains each play a zone of keys and velocities (DEV-015).
  const zone = useCallback(
    (id: string, patch: Partial<ChainZone>) =>
      dispatch({
        chain: id,
        rack: rackId,
        track,
        type: "change-rack-chain",
        zone: patch,
      }),
    [dispatch, rackId, track]
  );
  return (
    <DeviceChainSlot
      enabled={device.on !== false}
      onEnabledChange={toggle}
      title={layered ? "Instrument rack" : "Rack"}
      value={device.id}
      {...fold}
    >
      <RackPanel
        controls={<DeviceChainSlotControls />}
        enabled={device.on !== false}
        macrosShown={macrosShown}
        onAddChain={addChain}
        onChainMix={mix}
        onChainMixCommit={settle}
        onEnabledChange={toggle}
        onMacroChange={turn}
        onMacroCommit={settle}
        onMacrosShownChange={setMacrosShown}
        onMapMacro={map}
        onRemoveChain={removeChain}
        onSelectChain={setPicked}
        onUnmapMacro={unmap}
        onZoneChange={layered ? zone : undefined}
        onZoneCommit={settle}
        onZonesShownChange={setZonesShown}
        parameters={parameters}
        rack={shownRack}
        selectedChain={selected?.id ?? null}
        title={layered ? "Instrument rack" : "Rack"}
        zonesShown={zonesShown}
      >
        {selected ? (
          <Chain
            className="min-h-0"
            devices={selected.devices}
            end={
              selected.devices.length === 0 ? (
                <p className="self-center px-2 text-muted-foreground text-xs">
                  {layered
                    ? `Drag an instrument, then effects, from the library into ${selected.name}.`
                    : `Drag a device from the library into ${selected.name}.`}
                </p>
              ) : null
            }
            place={place}
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
function DrumSlot({
  device,
  fold,
  ...chain
}: ChainProps & { device: TrackDevice; fold: SlotFold }) {
  const { dispatch, onNoteOff, onNoteOn, onPadFiles, track } = chain;
  const rack = device.rack ?? { chains: [], macros: [] };
  const rackId = device.id;
  const [note, setNote] = chain.useEntry("drumNote", rackId, lowestPad(rack));
  const [macrosShown, setMacrosShown] = chain.useEntry(
    "rackMacros",
    rackId,
    false
  );
  const pad = rack.chains.find((item) => item.pad?.note === note);
  const parameters = useMemo(() => parametersOf(rackDevices(rack)), [rack]);
  const shownRack = useAutomatedRack(
    chain.owner,
    device,
    rack,
    chain.following
  );
  const { map, mix, removeChain, settle, toggle, turn, unmap } =
    useRackCommands(dispatch, track, rackId, chain.onMoved);
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
      {...fold}
    >
      <DrumRackPanel
        controls={<DeviceChainSlotControls />}
        enabled={device.on !== false}
        macrosShown={macrosShown}
        onChainMix={mix}
        onChainMixCommit={settle}
        onDropFiles={drop}
        onEnabledChange={toggle}
        onMacroChange={turn}
        onMacroCommit={settle}
        onMacrosShownChange={setMacrosShown}
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
        rack={shownRack}
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
  activeNotes,
  arrangement,
  onNoteOff,
  onNoteOn,
  onDeviceMoved,
  onHoldNote,
  onOpenLibrary,
  onPadFiles,
  overridden,
  position,
  track,
  useEntry = useLocalEntry,
}: {
  /** The notes held now on the track, such as on a MIDI keyboard: its instrument's keys or pads light them up. */
  activeNotes?: readonly number[];
  arrangement: Arrangement;
  /** What was moved by hand, by track: it stays as set. */
  overridden: Readonly<Record<string, readonly AutomatedParameter[]>>;
  /** Where the arrangement plays, in seconds. */
  position: AutomationFollowing["position"];
  /** Lets go of a note `onNoteOn` started on a track. */
  onNoteOff: (track: string, pitch: number) => void;
  /** Plays a note of a track now, through its instrument and chain, as a key does. */
  onNoteOn: (track: string, pitch: number, velocity: number) => void;
  /** Holds a note of a track's instrument by its note parameters, as its pad plays it; `null` lets it go. */
  onHoldNote: (
    track: string,
    note: Readonly<Record<string, number>> | null
  ) => void;
  /** Opens the library, ready to search. Leave it out when there is none to open, and the view has no button for it. */
  onOpenLibrary?: () => void;
  /** Parameters of a track's device moved by hand, by their ids: those automated stop following their envelopes. */
  onDeviceMoved: (
    track: string,
    device: string,
    parameters: readonly string[]
  ) => void;
  /** Files dropped on a pad of a drum rack on a track: a recording for it to play. */
  onPadFiles: (
    track: string,
    rack: string,
    note: number,
    files: File[]
  ) => void;
  track: string | null;
  /** Where the view keeps what it remembers per device, such as a slot folded; each lasts as long as the view when none is given. */
  useEntry?: DeviceViewMemory;
}) {
  const { dispatch, doc } = arrangement;
  const current = track ? trackOf(doc, track) : undefined;
  const id = current?.id ?? "";
  const trackOverridden = overridden[id];
  const following = useMemo(
    () => ({
      duration: doc.duration,
      overridden: trackOverridden,
      position,
    }),
    [doc.duration, position, trackOverridden]
  );
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
  // A drum rack and an instrument rack are instruments: each goes first, in place of the one there was.
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
  const addInstrumentRack = useCallback(
    () =>
      current &&
      dispatch({
        device: INSTRUMENT_RACK_DEVICE,
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
  const holdNote = useCallback(
    (note: Readonly<Record<string, number>> | null) => onHoldNote(id, note),
    [id, onHoldNote]
  );
  const moved = useCallback(
    (device: string, parameters: readonly string[]) =>
      onDeviceMoved(id, device, parameters),
    [id, onDeviceMoved]
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
  const midi = current.kind === "midi";
  const devices = current.devices ?? [];
  // The racks a track can take: a MIDI track's instrument racks too.
  const rackMenu = (
    <DropdownMenuContent align="start" className="w-auto">
      <DropdownMenuItem onClick={addRack}>Effect rack</DropdownMenuItem>
      {midi ? (
        <>
          <DropdownMenuItem onClick={addInstrumentRack}>
            Instrument rack
          </DropdownMenuItem>
          <DropdownMenuItem onClick={addDrumRack}>Drum rack</DropdownMenuItem>
        </>
      ) : null}
    </DropdownMenuContent>
  );
  // An empty track's whole view takes a drop; once it has devices, a narrow strip stays at the view's right edge,
  // however few or many there are, its line drawn over the last device's when they meet.
  const end =
    devices.length === 0 ? (
      <div className="flex flex-1 flex-col items-center justify-center gap-1 p-6 text-center">
        <p className="text-muted-foreground text-sm">
          {midi
            ? "Drop an instrument or an effect here"
            : "Drop an effect here"}
        </p>
        <p className="flex items-center text-muted-foreground text-xs">
          {onOpenLibrary ? (
            <>
              <Button onClick={onOpenLibrary} size="sm" variant="link">
                Browse the library
              </Button>
              ·
            </>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="sm" variant="link" />}>
              Add a rack
              <IconPlaceholder
                aria-hidden="true"
                hugeicons="ArrowDown01Icon"
                lucide="ChevronDownIcon"
                phosphor="CaretDownIcon"
                remixicon="RiArrowDownSLine"
                tabler="IconChevronDown"
              />
            </DropdownMenuTrigger>
            {rackMenu}
          </DropdownMenu>
        </p>
      </div>
    ) : (
      <div className="sticky end-0 z-10 ms-auto flex w-10 shrink-0 flex-col items-center gap-1 bg-background py-2 shadow-[-1px_0_0_0_var(--border)]">
        {onOpenLibrary ? (
          <Button
            aria-label="Open the library"
            onClick={onOpenLibrary}
            size="icon-sm"
            title="Open the library"
            variant="ghost"
          >
            <IconPlaceholder
              aria-hidden="true"
              hugeicons="PlusSignIcon"
              lucide="PlusIcon"
              phosphor="PlusIcon"
              remixicon="RiAddLine"
              tabler="IconPlus"
            />
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="Add a rack"
                size="icon-sm"
                title="Add a rack"
                variant="ghost"
              />
            }
          >
            <IconPlaceholder
              aria-hidden="true"
              hugeicons="Layers01Icon"
              lucide="LayersIcon"
              phosphor="StackIcon"
              remixicon="RiStackLine"
              tabler="IconStack2"
            />
          </DropdownMenuTrigger>
          {rackMenu}
        </DropdownMenu>
      </div>
    );
  return (
    <div className="flex h-full min-h-0">
      <Chain
        activeNotes={activeNotes}
        className="no-scrollbar scroll-fade min-h-0 min-w-0 flex-1 scroll-pe-10 overflow-auto"
        devices={devices}
        dispatch={dispatch}
        end={end}
        following={following}
        onHoldNote={holdNote}
        onMoved={moved}
        onNoteOff={noteOff}
        onNoteOn={noteOn}
        onPadFiles={padFiles}
        owner={current}
        place={undefined}
        tempo={doc.tempo}
        track={current.id}
        useEntry={useEntry}
      />
    </div>
  );
}
