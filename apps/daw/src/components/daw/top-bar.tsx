import type {
  MetronomeRhythm,
  SignatureChange,
  Tempo,
} from "@audio-ui/engine/time";
import { EnvelopeIcon } from "@audio-ui/icons/react";
import type { Source } from "@audio-ui/react";
import {
  ArrowArcLeftIcon,
  ArrowArcRightIcon,
  ArrowCounterClockwiseIcon,
  CaretDownIcon,
  DotsThreeIcon,
  MagnifyingGlassMinusIcon,
  MagnifyingGlassPlusIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ComponentProps, type ReactNode, useCallback } from "react";
import { ParameterField } from "@/components/audio-ui/parameter-field";
import { Transport } from "@/components/audio-ui/transport";
import { AudioUiIcon } from "@/components/site/audio-ui-icon";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ShortcutCommand } from "@/lib/daw/shortcuts";
import { CommandKeys } from "./shortcut-list";

/** The zoom presets, as shares of the fitted view: Fit shows everything. */
const ZOOM_PRESETS = [1, 2, 4, 8];
/** The zoom's steps are loupes, not a minus and a plus. */
const ZOOM_STEPPERS = {
  decrement: "Zoom out",
  icons: {
    decrement: <MagnifyingGlassMinusIcon aria-hidden="true" />,
    increment: <MagnifyingGlassPlusIcon aria-hidden="true" />,
  },
  increment: "Zoom in",
};
/** How the zoom reads: as a share of the fitted view. */
const PERCENT: Intl.NumberFormatOptions = {
  maximumFractionDigits: 0,
  style: "percent",
};

const noop = () => undefined;

/** An icon button of the bar, as lab's has them: its name and its keys in the tooltip. */
function BarButton({
  children,
  command,
  disabled,
  label,
  onClick,
  pressed,
}: {
  children: ReactNode;
  /** The command its keys run, shown with its name. */
  command?: ShortcutCommand;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  pressed?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            aria-pressed={pressed}
            className="text-muted-foreground aria-pressed:text-foreground"
            disabled={disabled}
            onClick={onClick}
            size="icon"
            variant="outline"
          >
            {children}
          </Button>
        }
      />
      <TooltipContent side="bottom">
        {label}
        {command ? (
          <>
            {" "}
            <CommandKeys command={command} />
          </>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

export interface TopBarProps
  extends Pick<
    ComponentProps<typeof Transport>,
    | "countIn"
    | "onCountInChange"
    | "onPunchChange"
    | "onRecordChange"
    | "punch"
    | "recording"
    | "recordSettings"
  > {
  /** Whether each lane shows its envelope (KEY-027). */
  automating: boolean;
  canRedo: boolean;
  canUndo: boolean;
  exporting: boolean;
  looping: boolean;
  metronome: boolean;
  onAutomatingChange: (automating: boolean) => void;
  /** Opens the export dialog (EXP-003). */
  onExport: () => void;
  /** Sends the project to other DAWs as a .dawproject file. */
  onExportDawproject: () => void;
  /** Opens a .dawproject file of another DAW in place of the project. */
  onImportDawproject: () => void;
  /** Imports MIDI files or MusicXML scores, a MIDI track for each of their parts. */
  onImportScore: () => void;
  onLoopingChange: (looping: boolean) => void;
  onMetronomeChange: (metronome: boolean) => void;
  /** Starts a new project, in place of this one. */
  onNew: () => void;
  /** Opens a project folder, where the browser can: with it, the menu has Open, Save and Save As. */
  onOpen?: () => void;
  onPlayPause: () => void;
  onRedo?: () => void;
  /** Plays every envelope again: there only while a hand overrides one. */
  onReenableAutomation?: () => void;
  onRhythmChange: (rhythm: MetronomeRhythm) => void;
  onSave?: () => void;
  onSaveAs?: () => void;
  /** Opens the workstation's settings. */
  onSettings: () => void;
  /** Opens the settings on their Shortcuts section, the one list of the keys. */
  onShortcuts: () => void;
  onStop: () => void;
  onTempoChange: (tempo: Tempo) => void;
  onUndo?: () => void;
  onZoomRatioChange: (ratio: number) => void;
  playing: boolean;
  position: Source<number>;
  rhythm: MetronomeRhythm;
  /** The time-signature changes: the position reads its bars through them. */
  signatures: readonly SignatureChange[];
  tempo: Tempo;
  /** The largest share of the fitted view the zoom reaches. */
  zoomMaxRatio: number;
  /** The zoom as a share of the fitted view: 1 shows everything. */
  zoomRatio: number;
}

/** The bar on top: the brand, as the lab has it, the transport, the automation, and the export. */
export function TopBar(props: TopBarProps) {
  const { automating, onAutomatingChange } = props;
  const toggleAutomation = useCallback(
    () => onAutomatingChange(!automating),
    [automating, onAutomatingChange]
  );
  const { onZoomRatioChange, zoomRatio } = props;
  const pickZoom = useCallback(
    (value: unknown) => onZoomRatioChange(Number(value)),
    [onZoomRatioChange]
  );
  const preset = ZOOM_PRESETS.find(
    (ratio) => Math.abs(ratio - zoomRatio) < 0.01
  );
  // The presets, Fit to 800 %: beside the zoom field, or in the menu on a window too narrow to show it.
  const presets = (
    <DropdownMenuRadioGroup
      onValueChange={pickZoom}
      value={preset === undefined ? "" : String(preset)}
    >
      {ZOOM_PRESETS.map((ratio) => (
        <DropdownMenuRadioItem
          disabled={ratio > props.zoomMaxRatio}
          key={ratio}
          value={String(ratio)}
        >
          {ratio === 1 ? "Fit" : `Zoom ${ratio * 100} %`}
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b px-3">
      <Button
        className="w-fit shrink-0 pl-2"
        nativeButton={false}
        render={
          <Link
            aria-label="audio/ui daw, home"
            className="flex items-center"
            to="/"
          >
            <span aria-hidden className="flex select-none items-center gap-1">
              <AudioUiIcon className="pointer-events-none size-5 text-foreground" />
              <span className="mt-[-2.3px] font-medium font-serif text-xl leading-snug">
                audio/ui
              </span>
              <span className="ml-1 rounded-md border px-1.5 py-0.5 text-muted-foreground text-xs">
                daw
              </span>
            </span>
          </Link>
        }
        variant="ghost"
      />
      <Separator orientation="vertical" />
      <Transport
        className="min-w-0 flex-1"
        countIn={props.countIn}
        looping={props.looping}
        metronome={props.metronome}
        onCountInChange={props.onCountInChange}
        onLoopingChange={props.onLoopingChange}
        onMetronomeChange={props.onMetronomeChange}
        onPlayPause={props.onPlayPause}
        onPunchChange={props.onPunchChange}
        onRecordChange={props.onRecordChange}
        onRhythmChange={props.onRhythmChange}
        onStop={props.onStop}
        onTempoChange={props.onTempoChange}
        playing={props.playing}
        punch={props.punch}
        recording={props.recording}
        recordSettings={props.recordSettings}
        rhythm={props.rhythm}
        signatures={props.signatures}
        source={props.position}
        tempo={props.tempo}
      />
      <div className="flex shrink-0 items-center gap-2">
        {props.onReenableAutomation ? (
          <BarButton
            label="Re-enable automation"
            onClick={props.onReenableAutomation}
          >
            <ArrowCounterClockwiseIcon
              aria-hidden="true"
              className="text-primary"
            />
          </BarButton>
        ) : null}
        <ButtonGroup>
          <BarButton
            command="undo"
            disabled={!props.canUndo}
            label="Undo"
            onClick={props.onUndo ?? noop}
          >
            <ArrowArcLeftIcon aria-hidden="true" />
          </BarButton>
          <BarButton
            command="redo"
            disabled={!props.canRedo}
            label="Redo"
            onClick={props.onRedo ?? noop}
          >
            <ArrowArcRightIcon aria-hidden="true" />
          </BarButton>
        </ButtonGroup>
        <div className="hidden items-center gap-1 xl:flex">
          <ParameterField
            className="w-44"
            format={PERCENT}
            hideLabel
            label="Zoom"
            largeStep={1}
            max={props.zoomMaxRatio}
            min={1}
            onValueChange={onZoomRatioChange}
            step={0.25}
            steppers={ZOOM_STEPPERS}
            unit="Zoom"
            value={zoomRatio}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  aria-label="Zoom presets"
                  className="text-muted-foreground"
                  size="icon"
                  variant="outline"
                />
              }
            >
              <CaretDownIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-auto min-w-36">
              {presets}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <BarButton
          command="automation"
          label="Automation"
          onClick={toggleAutomation}
          pressed={automating}
        >
          <EnvelopeIcon aria-hidden="true" />
        </BarButton>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label="More controls"
                className="text-muted-foreground"
                size="icon"
                variant="outline"
              />
            }
          >
            <DotsThreeIcon aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto min-w-48">
            <DropdownMenuItem onClick={props.onNew}>
              New project
            </DropdownMenuItem>
            {props.onOpen ? (
              <>
                <DropdownMenuItem onClick={props.onOpen}>
                  Open project…
                  <DropdownMenuShortcut>
                    <CommandKeys command="open" />
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={props.onSave}>
                  Save
                  <DropdownMenuShortcut>
                    <CommandKeys command="save" />
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={props.onSaveAs}>
                  Save as…
                  <DropdownMenuShortcut>
                    <CommandKeys command="save-as" />
                  </DropdownMenuShortcut>
                </DropdownMenuItem>
              </>
            ) : null}
            <DropdownMenuItem onClick={props.onImportDawproject}>
              Import DAWproject…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onImportScore}>
              Import MIDI or MusicXML…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onExportDawproject}>
              Export DAWproject…
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={props.exporting}
              onClick={props.onExport}
            >
              Export…
              <DropdownMenuShortcut>
                <CommandKeys command="export" />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            {/* The zoom's presets, only while the zoom field is hidden: on a wider window they are beside it. */}
            <DropdownMenuSeparator className="xl:hidden" />
            <div className="contents xl:hidden">{presets}</div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={props.onSettings}>
              Settings…
              <DropdownMenuShortcut>
                <CommandKeys command="settings" />
              </DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={props.onShortcuts}>
              Keyboard shortcuts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
