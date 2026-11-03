"use client";

import {
  type ComponentProps,
  createContext,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
  use,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Toggle } from "@/components/ui/toggle";
import { XIcon, CaretLeftIcon } from "@phosphor-icons/react";

/** The type a dragged device carries, with its id as the data: what a library sets and the chain takes. */
export const DEVICE_DRAG_TYPE = "application/x-audio-ui-device";

/** Where a press starts a drag of the whole device: its title bar, outside the controls in it. */
const HEADER = '[data-slot="device-header"], [data-slot="device-chain-strip"]';
const CONTROL =
  'a, button, input, select, textarea, [role="slider"], [role="switch"]';

interface DeviceChainContextValue {
  /** The slot being dragged, if one is. */
  dragging: string | null;
  /** The gap a dragged device would land in: before the slot at this index, or the end of the chain. */
  dropIndex: number | null;
  move: ((id: string, index: number, title: string) => void) | null;
  order: readonly string[];
  remove: ((id: string, title: string) => void) | null;
  startDrag: (event: PointerEvent<HTMLElement>, id: string) => void;
}

const DeviceChainContext = createContext<DeviceChainContextValue | null>(null);

function useDeviceChain() {
  const context = use(DeviceChainContext);
  if (!context) {
    throw new Error("DeviceChain parts must be used within <DeviceChain>.");
  }
  return context;
}

interface SlotContextValue {
  folded: boolean;
  index: number;
  title: string;
  toggleFold: () => void;
  value: string;
}

const SlotContext = createContext<SlotContextValue | null>(null);

function useSlot() {
  const context = use(SlotContext);
  if (!context) {
    throw new Error(
      "DeviceChainSlotControls must be used within <DeviceChainSlot>."
    );
  }
  return context;
}

/** How far to scroll so a pointer held near the start or end edge of a view keeps it going; 0 away from the edges. */
function edgeScrollStep(x: number, left: number, right: number): number {
  if (x < left + 48) {
    return -Math.min(24, Math.ceil((left + 48 - x) / 3));
  }
  if (x > right - 48) {
    return Math.min(24, Math.ceil((x - right + 48) / 3));
  }
  return 0;
}

/** The middle of each slot across the view, in the order they are drawn. */
function slotMiddles(root: HTMLElement): number[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('[data-slot="device-chain-slot"]')
  ).map((slot) => {
    const box = slot.getBoundingClientRect();
    return (box.left + box.right) / 2;
  });
}

/** The gap a pointer at `x` points at: before the first slot whose middle is past it, or the end. */
function gapAt(middles: number[], x: number): number {
  const index = middles.findIndex((middle) => x < middle);
  return index === -1 ? middles.length : index;
}

function takesDevice(event: DragEvent<HTMLElement>) {
  return Array.from(event.dataTransfer.types).includes(DEVICE_DRAG_TYPE);
}

function gripOf(root: HTMLElement | null, id: string | undefined) {
  if (!(root && id)) {
    return null;
  }
  return root.querySelector<HTMLElement>(
    `[data-device-grip="${CSS.escape(id)}"]`
  );
}

interface DeviceChainProps extends ComponentProps<"div"> {
  /** A device was dropped on the chain from a library: its id, and the index it goes in. Leave it out and nothing can be dropped. */
  onAdd?: (device: string, index: number) => void;
  /** A slot was moved to `index`, counted once it has left its place. Leave it out and the slots stay where they are. */
  onMove?: (id: string, index: number) => void;
  /** A slot was removed. Leave it out and no slot can be. */
  onRemove?: (id: string) => void;
  /** The ids of the slots, in the order the sound goes through them. */
  order: readonly string[];
}

/**
 * The devices of a track in a row, in the order the sound goes through them.
 * Controlled: it holds the ids of its slots, and a move, a removal or a device
 * dropped on it goes out through a callback for the host to apply. It makes no
 * sound and knows no engine. Each slot is a `DeviceChainSlot` with the
 * device's panel in it, and `DeviceChainAdd` ends the row.
 */
function DeviceChain({
  children,
  className,
  onAdd,
  onMove,
  onRemove,
  order,
  ...props
}: DeviceChainProps) {
  const root = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const live = useRef({ onAdd, onMove, onRemove, order });
  live.current = { onAdd, onMove, onRemove, order };

  const move = useCallback((id: string, index: number, title: string) => {
    const { onMove: apply, order: ids } = live.current;
    const from = ids.indexOf(id);
    if (
      !apply ||
      from === -1 ||
      index === from ||
      index < 0 ||
      index >= ids.length
    ) {
      return;
    }
    apply(id, index);
    setMessage(`${title} moved to ${index + 1} of ${ids.length}.`);
    // The slot is drawn again in its new place: its grip keeps the focus the key was pressed on.
    requestAnimationFrame(() => gripOf(root.current, id)?.focus());
  }, []);

  const remove = useCallback((id: string, title: string) => {
    const { onRemove: apply, order: ids } = live.current;
    if (!apply) {
      return;
    }
    const index = ids.indexOf(id);
    const neighbor = ids[index + 1] ?? ids[index - 1];
    apply(id);
    setMessage(`${title} removed.`);
    // The focus goes to the slot that takes its place, or to the end of the chain.
    requestAnimationFrame(() =>
      (
        gripOf(root.current, neighbor) ??
        root.current?.querySelector<HTMLElement>(
          '[data-slot="device-chain-add"]'
        )
      )?.focus()
    );
  }, []);

  const startDrag = useCallback(
    (event: PointerEvent<HTMLElement>, id: string) => {
      const view = root.current;
      const slot = event.currentTarget.closest<HTMLElement>(
        '[data-slot="device-chain-slot"]'
      );
      const from = live.current.order.indexOf(id);
      if (
        event.button !== 0 ||
        !(view && slot && live.current.onMove) ||
        from === -1
      ) {
        return;
      }
      event.preventDefault();
      const middles = slotMiddles(view);
      const startX = event.clientX;
      const startScroll = view.scrollLeft;
      let lastX = startX;
      let gap = from;
      let frame = 0;

      // Once a frame while the slot is dragged, whether or not the pointer moved: near an edge of the row, it
      // scrolls; the slot follows the pointer, and the slots are where they were at the press, moved by the scroll.
      const tick = () => {
        const box = view.getBoundingClientRect();
        view.scrollLeft += edgeScrollStep(lastX, box.left, box.right);
        const shift = view.scrollLeft - startScroll;
        slot.style.transform = `translateX(${lastX - startX + shift}px)`;
        const next = gapAt(
          middles.map((middle) => middle - shift),
          lastX
        );
        if (next !== gap) {
          gap = next;
          // Its own place and the one after it leave the chain as it is: no line.
          setDropIndex(next === from || next === from + 1 ? null : next);
        }
        frame = requestAnimationFrame(tick);
      };
      const follow = (moveEvent: globalThis.PointerEvent) => {
        lastX = moveEvent.clientX;
      };
      const finish = (commit: boolean) => {
        window.removeEventListener("pointermove", follow);
        window.removeEventListener("pointerup", release);
        window.removeEventListener("pointercancel", cancel);
        cancelAnimationFrame(frame);
        slot.style.transform = "";
        // The gap the slot lands in; one less once the slot has left a place before it.
        const landed = gap > from ? gap - 1 : gap;
        if (commit && landed !== from) {
          live.current.onMove?.(id, landed);
        }
        setDragging(null);
        setDropIndex(null);
      };
      const release = () => finish(true);
      const cancel = () => finish(false);

      setDragging(id);
      window.addEventListener("pointermove", follow);
      window.addEventListener("pointerup", release);
      window.addEventListener("pointercancel", cancel);
      frame = requestAnimationFrame(tick);
    },
    []
  );

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!(live.current.onAdd && takesDevice(event))) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setDropIndex(gapAt(slotMiddles(event.currentTarget), event.clientX));
  }, []);

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setDropIndex(null);
    }
  }, []);

  const handleDrop = useCallback((event: DragEvent<HTMLDivElement>) => {
    const add = live.current.onAdd;
    if (!(add && takesDevice(event))) {
      return;
    }
    event.preventDefault();
    setDropIndex(null);
    const device = event.dataTransfer.getData(DEVICE_DRAG_TYPE);
    if (device) {
      add(device, gapAt(slotMiddles(event.currentTarget), event.clientX));
    }
  }, []);

  const context = useMemo<DeviceChainContextValue>(
    () => ({
      dragging,
      dropIndex,
      move: onMove ? move : null,
      order,
      remove: onRemove ? remove : null,
      startDrag,
    }),
    [dragging, dropIndex, move, onMove, onRemove, order, remove, startDrag]
  );

  return (
    <DeviceChainContext value={context}>
      <div
        className={cn(
          "flex min-h-0 min-w-0 items-stretch gap-2 overflow-x-auto overscroll-x-contain p-2",
          className
        )}
        data-slot="device-chain"
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        ref={root}
        role="group"
        {...props}
      >
        {children}
        <span aria-live="polite" className="sr-only">
          {message}
        </span>
      </div>
    </DeviceChainContext>
  );
}

/** The grip of a slot: drag it to move the device, press Left or Right to move it a place, Delete to remove it. */
function SlotGrip() {
  const { dragging, move, remove, startDrag } = useDeviceChain();
  const { index, title, value } = useSlot();
  const handleKey = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>) => {
      const step = { ArrowLeft: -1, ArrowRight: 1 }[event.key];
      if (step) {
        event.preventDefault();
        move?.(value, index + step, title);
      } else if (
        (event.key === "Delete" || event.key === "Backspace") &&
        remove
      ) {
        event.preventDefault();
        remove(value, title);
      }
    },
    [index, move, remove, title, value]
  );
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => startDrag(event, value),
    [startDrag, value]
  );
  if (!move) {
    return null;
  }
  return (
    <button
      aria-keyshortcuts={
        remove ? "ArrowLeft ArrowRight Delete" : "ArrowLeft ArrowRight"
      }
      aria-label={`Move ${title}`}
      className={cn(
        "flex size-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
        dragging === value && "cursor-grabbing bg-muted text-foreground"
      )}
      data-device-grip={value}
      onKeyDown={handleKey}
      onPointerDown={handlePointerDown}
      type="button"
    >
      <svg
        aria-hidden="true"
        className="size-3.5"
        fill="currentColor"
        focusable="false"
        viewBox="0 0 16 16"
      >
        <circle cx="5.5" cy="3.5" r="1.25" />
        <circle cx="10.5" cy="3.5" r="1.25" />
        <circle cx="5.5" cy="8" r="1.25" />
        <circle cx="10.5" cy="8" r="1.25" />
        <circle cx="5.5" cy="12.5" r="1.25" />
        <circle cx="10.5" cy="12.5" r="1.25" />
      </svg>
    </button>
  );
}

function SlotRemove() {
  const { remove } = useDeviceChain();
  const { title, value } = useSlot();
  const removeIt = useCallback(
    () => remove?.(value, title),
    [remove, title, value]
  );
  if (!remove) {
    return null;
  }
  return (
    <Button
      aria-label={`Remove ${title}`}
      className="text-muted-foreground hover:text-destructive"
      onClick={removeIt}
      size="icon-xs"
      variant="ghost"
    >
      <XIcon aria-hidden="true" />
    </Button>
  );
}

function SlotFold() {
  const { folded, title, toggleFold } = useSlot();
  return (
    <Button
      aria-expanded={!folded}
      aria-label={`${folded ? "Unfold" : "Fold"} ${title}`}
      data-slot="device-chain-slot-fold"
      onClick={toggleFold}
      size="icon-xs"
      variant="ghost"
    >
      <CaretLeftIcon aria-hidden="true" className={cn("transition-transform", folded && "rotate-180")} />
    </Button>
  );
}

/**
 * The slot's grip, a button that removes the device and one that folds it,
 * for the end of the device's own header: the `children` of a panel go there.
 */
function DeviceChainSlotControls({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center", className)}
      data-slot="device-chain-slot-controls"
      {...props}
    >
      <SlotGrip />
      <SlotRemove />
      <SlotFold />
    </div>
  );
}

/** The commands of a slot on a right-click, beside the keys that do them on its grip. */
function SlotMenu() {
  const { move, order, remove } = useDeviceChain();
  const { index, title, value } = useSlot();
  const moveBack = useCallback(
    () => move?.(value, index - 1, title),
    [index, move, title, value]
  );
  const moveOn = useCallback(
    () => move?.(value, index + 1, title),
    [index, move, title, value]
  );
  const removeIt = useCallback(
    () => remove?.(value, title),
    [remove, title, value]
  );
  return (
    <ContextMenuContent className="w-auto min-w-40">
      {move ? (
        <>
          <ContextMenuItem disabled={index <= 0} onClick={moveBack}>
            Move left
            <ContextMenuShortcut>←</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem
            disabled={index === order.length - 1}
            onClick={moveOn}
          >
            Move right
            <ContextMenuShortcut>→</ContextMenuShortcut>
          </ContextMenuItem>
        </>
      ) : null}
      {move && remove ? <ContextMenuSeparator /> : null}
      {remove ? (
        <ContextMenuItem onClick={removeIt} variant="destructive">
          Remove
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      ) : null}
    </ContextMenuContent>
  );
}

interface DeviceChainSlotProps extends Omit<ComponentProps<"div">, "title"> {
  /** Whether the device is on, for the square of the folded strip. Leave it out for a device that cannot be switched off. */
  enabled?: boolean;
  /** The square of the folded strip was pressed. */
  onEnabledChange?: (enabled: boolean) => void;
  /** The device's name, down the folded strip and in what the controls are called. */
  title: string;
  /** The slot's id, as it is in the chain's `order`. */
  value: string;
}

/**
 * One device of the chain, drawn by its own panel: put `DeviceChainSlotControls`
 * at the end of the panel's header. Drag the device by its header or by the
 * grip, or press Left or Right on the grip; Delete removes it, and a
 * right-click gives the same commands. Folded, the slot is a narrow strip with
 * the device's name down it, its on and off square, and the same controls.
 */
function DeviceChainSlot({
  children,
  className,
  enabled,
  onEnabledChange,
  title,
  value,
  ...props
}: DeviceChainSlotProps) {
  const { dragging, dropIndex, move, order, remove, startDrag } =
    useDeviceChain();
  const [folded, setFolded] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const index = order.indexOf(value);

  const toggleFold = useCallback(() => {
    setFolded((current) => !current);
    // The button that was pressed is gone with the face it was on: the focus goes to the one that takes its place.
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>('[data-slot="device-chain-slot-fold"]')
        ?.focus()
    );
  }, []);
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const target = event.target as Element;
      if (target.closest(HEADER) && !target.closest(CONTROL)) {
        startDrag(event, value);
      }
    },
    [startDrag, value]
  );
  const slot = useMemo<SlotContextValue>(
    () => ({ folded, index, title, toggleFold, value }),
    [folded, index, title, toggleFold, value]
  );

  const content = folded ? (
    <div
      className="rounded-xl [--device-radius:calc(var(--radius)+4px)] flex h-full w-8 flex-col items-center gap-1 border bg-card p-1 [&_button]:rounded-[max(0px,calc(var(--device-radius,0.5rem)-0.375rem))]"
      data-slot="device-chain-strip"
    >
      <SlotGrip />
      {enabled === undefined ? null : (
        <span className="flex size-6 shrink-0 items-center justify-center">
          <Toggle
            aria-label={`${title} on`}
            className="size-4 min-h-0 min-w-0 rounded-[max(0px,calc(var(--device-radius,0.5rem)-0.5625rem))] p-0 aria-pressed:border-primary aria-pressed:bg-primary"
            onPressedChange={onEnabledChange}
            pressed={enabled}
            size="sm"
            variant="outline"
          />
        </span>
      )}
      <SlotFold />
      <span
        className="min-h-0 flex-1 rotate-180 truncate py-1 font-medium text-xs [writing-mode:vertical-rl]"
        title={title}
      >
        {title}
      </span>
      <SlotRemove />
    </div>
  ) : (
    children
  );

  const rootProps = {
    "aria-label": title,
    className: cn(
      "relative flex shrink-0 flex-col",
      // The line a dragged device would land on, in the middle of the gap before this slot.
      "before:absolute before:inset-y-0 before:inset-s-[-5px] before:hidden before:w-0.5 before:rounded-full before:bg-primary data-drop:before:block",
      "data-dragging:z-10 data-dragging:shadow-lg",
      className
    ),
    "data-dragging": dragging === value ? "" : undefined,
    "data-drop": dropIndex === index ? "" : undefined,
    "data-folded": folded ? "" : undefined,
    "data-slot": "device-chain-slot",
    onPointerDown: move ? handlePointerDown : undefined,
    ref: root,
    role: "group",
    ...props,
  };

  return (
    <SlotContext value={slot}>
      {move || remove ? (
        <ContextMenu>
          <ContextMenuTrigger render={<div {...rootProps} />}>
            {content}
          </ContextMenuTrigger>
          <SlotMenu />
        </ContextMenu>
      ) : (
        <div {...rootProps}>{content}</div>
      )}
    </SlotContext>
  );
}

/**
 * The end of the chain: where a device dragged from a library is dropped, and
 * a button that opens the library, such as `DeviceBrowser`, through `onClick`.
 * Its children replace the words.
 */
function DeviceChainAdd({
  children,
  className,
  ...props
}: ComponentProps<"button">) {
  const { dropIndex, order } = useDeviceChain();
  return (
    <button
      className={cn(
        "rounded-xl [--device-radius:calc(var(--radius)+4px)] flex w-36 shrink-0 flex-col items-center justify-center gap-1 border border-dashed px-3 text-center text-muted-foreground text-xs transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-over:border-primary data-over:bg-primary/10",
        className
      )}
      data-over={dropIndex === order.length ? "" : undefined}
      data-slot="device-chain-add"
      type="button"
      {...props}
    >
      {children ?? (
        <>
          <span className="font-medium">Add a device</span>
          <span>Drop one here, or open the library</span>
        </>
      )}
    </button>
  );
}

export {
  DeviceChain,
  DeviceChainAdd,
  DeviceChainSlot,
  DeviceChainSlotControls,
};