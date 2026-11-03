import type { Tempo } from "@audio-ui/core/time";
import { EnvelopeIcon } from "@audio-ui/icons/react";
import type { Source } from "@audio-ui/react";
import {
  ArrowCounterClockwiseIcon,
  DownloadSimpleIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useCallback } from "react";
import { Transport } from "@/components/audio-ui/transport";
import { AudioUiIcon } from "@/components/site/audio-ui-icon";
import { ModeSwitcher } from "@/components/site/mode-switcher";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** An icon button of the bar, as lab's has them: its name and its keys in the tooltip. */
function BarButton({
  children,
  disabled,
  label,
  onClick,
  pressed,
}: {
  children: ReactNode;
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
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export interface TopBarProps {
  /** Whether each lane shows its envelope (KEY-027). */
  automating: boolean;
  exporting: boolean;
  looping: boolean;
  onAutomatingChange: (automating: boolean) => void;
  onExport: () => void;
  onLoopingChange: (looping: boolean) => void;
  onPlayPause: () => void;
  /** Plays every envelope again: there only while a hand overrides one. */
  onReenableAutomation?: () => void;
  onStop: () => void;
  onTempoChange: (tempo: Tempo) => void;
  playing: boolean;
  position: Source<number>;
  tempo: Tempo;
}

/** The bar on top: the brand, as the lab has it, the transport, the automation, and the export. */
export function TopBar(props: TopBarProps) {
  const { automating, onAutomatingChange } = props;
  const toggleAutomation = useCallback(
    () => onAutomatingChange(!automating),
    [automating, onAutomatingChange]
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
        looping={props.looping}
        onLoopingChange={props.onLoopingChange}
        onPlayPause={props.onPlayPause}
        onStop={props.onStop}
        onTempoChange={props.onTempoChange}
        playing={props.playing}
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
        <BarButton
          label="Automation (A)"
          onClick={toggleAutomation}
          pressed={automating}
        >
          <EnvelopeIcon aria-hidden="true" />
        </BarButton>
        <BarButton
          disabled={props.exporting}
          label="Export WAV (Cmd Shift R)"
          onClick={props.onExport}
        >
          <DownloadSimpleIcon aria-hidden="true" />
        </BarButton>
        <ModeSwitcher />
      </div>
    </header>
  );
}
