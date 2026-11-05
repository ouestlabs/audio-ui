import { ClipIcon, FadersIcon, KnobIcon } from "@audio-ui/icons/react";
import { CaretDownIcon, CaretRightIcon } from "@phosphor-icons/react";
import { type ReactNode, useCallback } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

/** What the panel under the arrangement shows: the selected clip, the selected track's devices, or the mixer. */
export type PanelView = "clip" | "devices" | "mixer";

/** The panel's views, as tabs: they go in the bar, or in the clip view's own strip when it shows a clip. */
export function PanelTabs({
  clipAvailable,
  onPress,
}: {
  clipAvailable: boolean;
  /** A press on a tab, even the one already shown, which a change of tab does not report: the folded panel opens on it. */
  onPress?: () => void;
}) {
  return (
    <TabsList className="relative z-10 shrink-0" onClick={onPress}>
      <TabsTrigger disabled={!clipAvailable} value="clip">
        <ClipIcon aria-hidden="true" weight="fill" />
        Clip
      </TabsTrigger>
      <TabsTrigger value="devices">
        <KnobIcon aria-hidden="true" weight="fill" />
        Devices
      </TabsTrigger>
      <TabsTrigger value="mixer">
        <FadersIcon aria-hidden="true" weight="fill" />
        Mixer
      </TabsTrigger>
    </TabsList>
  );
}

/**
 * The one bar of the panel under the arrangement, laid out as a clip view's
 * strip: the caret that folds the panel, what it shows, and its tabs. Open, a
 * press anywhere on the bar outside its tabs folds it; folded, the panel is
 * this bar alone, and the whole bar opens it, as the library's strip does on
 * the left; its tabs open it on their view.
 */
export function PanelBar({
  clipAvailable,
  folded,
  onFoldedChange,
  title,
}: {
  clipAvailable: boolean;
  folded: boolean;
  onFoldedChange: (folded: boolean) => void;
  /** What the view shows: the track whose devices these are, the clip folded away. */
  title?: ReactNode;
}) {
  const open = useCallback(() => onFoldedChange(false), [onFoldedChange]);
  const fold = useCallback(() => onFoldedChange(true), [onFoldedChange]);
  return (
    <div
      className="relative flex min-h-10 shrink-0 items-center gap-2 p-1 ps-2 text-xs data-open:border-b"
      data-folded={folded ? "" : undefined}
      data-open={folded ? undefined : ""}
      data-slot="panel-bar"
    >
      {folded ? (
        <>
          <button
            aria-expanded={false}
            aria-label="Open the panel"
            className="absolute inset-0 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            onClick={open}
            type="button"
          />
          <CaretRightIcon
            aria-hidden="true"
            className="pointer-events-none relative size-3 text-muted-foreground"
            weight="fill"
          />
        </>
      ) : (
        <button
          aria-expanded
          aria-label="Fold the panel"
          className="flex size-5 after:absolute after:inset-0 hover:after:bg-muted/40 shrink-0 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={fold}
          type="button"
        >
          <CaretDownIcon aria-hidden="true" className="size-3" weight="fill" />
        </button>
      )}
      <span className="pointer-events-none relative min-w-0 flex-1 truncate font-medium">
        {title}
      </span>
      <PanelTabs
        clipAvailable={clipAvailable}
        onPress={folded ? open : undefined}
      />
    </div>
  );
}
