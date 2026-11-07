"use client";

import {
  type ComponentProps,
  createContext,
  type DragEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type RefObject,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
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
import { startSortableDrag } from "@/lib/sortable-drag";
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
  flat: boolean;
  move: ((id: string, index: number, title: string) => void) | null;
  order: readonly string[];
  remove: ((id: string, title: string) => void) | null;
  /** The chain that scrolls: the outermost, around any chain inside a rack. */
  scroller: RefObject<HTMLDivElement | null>;
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

const CHAIN = '[data-slot="device-chain"]';
/** How far the label of a dragged device starts up and left of the pointer, in px: small enough to stay out of what it is over. */
const LABEL_LEAD = 14;

/** A chain's own slots, in the order they are drawn: a rack's chain inside a slot has slots of its own. */
function slotsOf(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>('[data-slot="device-chain-slot"]')
  ).filter((slot) => slot.closest(CHAIN) === root);
}

/** The middle of each slot across the view, in the order they are drawn. */
function slotMiddles(root: HTMLElement): number[] {
  return slotsOf(root).map((slot) => {
    const box = slot.getBoundingClientRect();
    return (box.left + box.right) / 2;
  });
}

/**
 * The chain a device under `element` goes to: the one it is in, and anywhere
 * on a slot that holds a chain of its own, such as a rack's title bar or its
 * list of chains, that one: over a rack is into the rack.
 */
function chainUnder(element: Element | null) {
  const over = element?.closest(CHAIN) ?? null;
  const inside = element
    ?.closest('[data-slot="device-chain-slot"]')
    ?.querySelector(CHAIN);
  return inside && over?.contains(inside) ? inside : over;
}

/** Whatever the chains around `element` mark goes: the innermost has the drop. */
function clearAround(element: Element) {
  for (
    let around = element.parentElement?.closest(CHAIN);
    around;
    around = around.parentElement?.closest(CHAIN)
  ) {
    chainTargets.get(around)?.mark(null);
  }
}

/** What a chain tells a drag from another chain beside or inside it. */
interface ChainTarget {
  accepts: (id: string) => boolean;
  add: (device: string, index: number) => void;
  adds: () => boolean;
  gapAt: (x: number) => number;
  mark: (index: number | null) => void;
  receive: (id: string, index: number) => void;
  scroller: HTMLElement | null;
}

const chainTargets = new WeakMap<Element, ChainTarget>();

/** The chain under the pointer that a device of `view` can go to, if it is another. */
function targetAt(
  x: number,
  y: number,
  view: HTMLElement,
  id: string,
  scroller: HTMLElement
) {
  const over = chainUnder(document.elementFromPoint(x, y));
  const target = over && over !== view ? chainTargets.get(over) : undefined;
  return target?.scroller === scroller && target.accepts(id) ? target : null;
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
  /** Whether a device of another chain can come here, by its slot's id. @default every one */
  canReceive?: (id: string) => boolean;
  /** Lays the devices flat on the surface around them, a hairline between each and the next, instead of as cards: as a workstation's device view docks them. Each fills the chain's height; one taller than the chain keeps its own, and the chain scrolls to it. */
  flat?: boolean;
  /** A device was dropped on the chain from a library: its id, and the index it goes in. Leave it out and nothing can be dropped. */
  onAdd?: (device: string, index: number) => void;
  /** A slot was moved to `index`, counted once it has left its place. Leave it out and the slots stay where they are. */
  onMove?: (id: string, index: number) => void;
  /** A device was dragged here from another chain around or inside this one, such as a rack's: its slot's id, and the index it goes in. Leave it out and none can come. */
  onReceive?: (id: string, index: number) => void;
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
 * device's panel in it, and `DeviceChainAdd` ends the row. A chain inside a
 * slot, as a rack holds, has no scroll of its own: the rack is as wide as its
 * devices, and the outermost chain scrolls them all.
 */
function DeviceChain({
  canReceive,
  children,
  className,
  flat = false,
  onAdd,
  onMove,
  onReceive,
  onRemove,
  order,
  ...props
}: DeviceChainProps) {
  const root = useRef<HTMLDivElement>(null);
  const around = use(DeviceChainContext);
  const scroller = around?.scroller ?? root;
  const [dragging, setDragging] = useState<string | null>(null);
  const [lifted, setLifted] = useState<{
    left: number;
    title: string;
    top: number;
  } | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const live = useRef({
    canReceive,
    onAdd,
    onMove,
    onReceive,
    onRemove,
    order,
  });
  live.current = { canReceive, onAdd, onMove, onReceive, onRemove, order };

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
      const scrolling = scroller.current;
      const slot = event.currentTarget.closest<HTMLElement>(
        '[data-slot="device-chain-slot"]'
      );
      const from = live.current.order.indexOf(id);
      if (
        event.button !== 0 ||
        !(view && scrolling && slot && live.current.onMove) ||
        from === -1
      ) {
        return;
      }
      event.preventDefault();
      const { clientX: pressX, clientY: pressY } = event;
      let target: ChainTarget | null = null;
      let targetGap = 0;
      startSortableDrag({
        axis: "x",
        // Over another chain, the gap there takes the device, and the row here closes up behind it.
        elsewhere: (x, y) => {
          const next = targetAt(x, y, view, id, scrolling);
          if (target !== next) {
            target?.mark(null);
          }
          target = next;
          if (next) {
            targetGap = next.gapAt(x);
            next.mark(targetGap);
          }
          return next !== null;
        },
        from,
        free: true,
        ghost: () => ghostRef.current,
        items: slotsOf(view),
        // In the frame the copy goes, the new order is there: one without either would jump.
        onEnd: (landed, released) =>
          flushSync(() => {
            setLifted(null);
            setDragging(null);
            target?.mark(null);
            if (released && target) {
              target.receive(id, targetGap);
            } else if (landed !== null) {
              live.current.onMove?.(id, landed);
            }
          }),
        onLift: () => {
          setLifted({
            left: pressX - LABEL_LEAD,
            title: slot.getAttribute("aria-label") ?? "",
            top: pressY - LABEL_LEAD,
          });
          setDragging(id);
        },
        scroller: scrolling,
        x: event.clientX,
        y: event.clientY,
      });
    },
    [scroller]
  );

  // Another chain's drag finds this one through its element.
  useEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    chainTargets.set(element, {
      accepts: (id) =>
        live.current.onReceive !== undefined &&
        (live.current.canReceive?.(id) ?? true),
      add: (device, index) => live.current.onAdd?.(device, index),
      adds: () => live.current.onAdd !== undefined,
      gapAt: (x) => gapAt(slotMiddles(element), x),
      mark: setDropIndex,
      receive: (id, index) => live.current.onReceive?.(id, index),
      scroller: scroller.current,
    });
    return () => {
      chainTargets.delete(element);
    };
  }, [scroller]);

  // Over a rack but outside its chain, the rack's chain has the drop: the chain it is marked on, for as long as it lasts.
  const lent = useRef<ChainTarget | null>(null);
  const lendTo = useCallback((next: ChainTarget | null) => {
    if (lent.current !== next) {
      lent.current?.mark(null);
    }
    lent.current = next;
  }, []);
  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!(live.current.onAdd && takesDevice(event))) {
        return;
      }
      // The innermost chain takes it: one inside a slot has the drop, not the chain around it.
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "copy";
      const own = event.currentTarget;
      clearAround(own);
      const under = chainUnder(event.target as Element);
      const inner = under && under !== own ? chainTargets.get(under) : null;
      if (inner?.adds()) {
        setDropIndex(null);
        lendTo(inner);
        inner.mark(inner.gapAt(event.clientX));
        return;
      }
      lendTo(null);
      setDropIndex(gapAt(slotMiddles(own), event.clientX));
    },
    [lendTo]
  );

  const handleDragLeave = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
        lendTo(null);
        setDropIndex(null);
      }
    },
    [lendTo]
  );

  const handleDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      const add = live.current.onAdd;
      if (!(add && takesDevice(event))) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      setDropIndex(null);
      const inner = lent.current;
      lendTo(null);
      const device = event.dataTransfer.getData(DEVICE_DRAG_TYPE);
      if (device && inner) {
        inner.add(device, inner.gapAt(event.clientX));
      } else if (device) {
        add(device, gapAt(slotMiddles(event.currentTarget), event.clientX));
      }
    },
    [lendTo]
  );

  const context = useMemo<DeviceChainContextValue>(
    () => ({
      dragging,
      dropIndex,
      flat,
      move: onMove ? move : null,
      order,
      remove: onRemove ? remove : null,
      scroller,
      startDrag,
    }),
    [
      dragging,
      dropIndex,
      flat,
      move,
      onMove,
      onRemove,
      order,
      remove,
      scroller,
      startDrag,
    ]
  );

  return (
    <DeviceChainContext value={context}>
      <div
        className={cn(
          "flex min-h-0 min-w-0 items-stretch",
          !around && "overflow-x-auto overscroll-x-contain",
          flat ? "gap-0" : "gap-2 p-2",
          // What a device let go now goes into.
          "data-over:bg-primary/10 data-over:shadow-[inset_0_0_0_2px_var(--primary)]",
          className
        )}
        data-flat={flat ? "" : undefined}
        data-over={dropIndex === null ? undefined : ""}
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
      {lifted
        ? createPortal(
            <div
              aria-hidden="true"
              className="rounded-xl [--device-radius:calc(var(--radius)+4px)] pointer-events-none fixed z-50 flex h-7 max-w-48 items-center border bg-card px-2.5 font-medium text-xs shadow-lg"
              data-slot="device-chain-ghost"
              ref={ghostRef}
              style={{ left: lifted.left, top: lifted.top }}
            >
              <span className="truncate">{lifted.title}</span>
            </div>,
            document.body
          )
        : null}
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
  const arrow = (
    <CaretLeftIcon aria-hidden="true" className={cn("transition-transform", folded && "size-3.5 rotate-180")} />
  );
  // Folded, the whole strip is what is pressed: this only says so, and is how the keyboard unfolds it.
  if (folded) {
    return (
      <button
        aria-expanded={false}
        aria-label={`Unfold ${title}`}
        className="flex size-6 shrink-0 cursor-pointer items-center justify-center text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-slot="device-chain-slot-fold"
        onClick={toggleFold}
        type="button"
      >
        {arrow}
      </button>
    );
  }
  return (
    <Button
      aria-expanded
      aria-label={`Fold ${title}`}
      data-slot="device-chain-slot-fold"
      onClick={toggleFold}
      size="icon-xs"
      variant="ghost"
    >
      {arrow}
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
  /** Whether the device is folded to its strip when it first shows. Use `folded` to control it. @default false */
  defaultFolded?: boolean;
  /** Whether the device is on, for the square of the folded strip. Leave it out for a device that cannot be switched off. */
  enabled?: boolean;
  /** Whether the device is folded to its strip, controlled: to keep it past a reload, say. */
  folded?: boolean;
  /** The square of the folded strip was pressed. */
  onEnabledChange?: (enabled: boolean) => void;
  /** The device was folded or unfolded. */
  onFoldedChange?: (folded: boolean) => void;
  /** The device's name, down the folded strip and in what the controls are called. */
  title: string;
  /** The slot's id, as it is in the chain's `order`. */
  value: string;
}

/**
 * One device of the chain, drawn by its own panel: put `DeviceChainSlotControls`
 * at the end of the panel's header. Drag the device by its header or by the
 * grip: a label follows the pointer, and the device shows dimmed where it would
 * land, the others aside; or press Left or Right on the grip; Delete removes it, and a
 * right-click gives the same commands. Folded, the slot is a narrow strip with
 * its on and off square at the top, the device's name down it, and the same
 * controls at the bottom; a click anywhere else on the strip unfolds it. Open, a click on its title bar, outside its buttons, folds it; a drag of the title bar moves it.
 */
function DeviceChainSlot({
  children,
  className,
  defaultFolded = false,
  enabled,
  folded: foldedProp,
  onEnabledChange,
  onFoldedChange,
  title,
  value,
  ...props
}: DeviceChainSlotProps) {
  const { dragging, dropIndex, flat, move, order, remove, startDrag } =
    useDeviceChain();
  const [ownFolded, setOwnFolded] = useState(defaultFolded);
  const folded = foldedProp ?? ownFolded;
  const root = useRef<HTMLDivElement>(null);
  // Whether the pointer went anywhere since it was pressed: a drag, or a press that came back to where it began, is not a click.
  const travelled = useRef<boolean>(false);
  const index = order.indexOf(value);

  const toggleFold = useCallback(() => {
    setOwnFolded(!folded);
    onFoldedChange?.(!folded);
    // The button that was pressed is gone with the face it was on: the focus goes to the one that takes its place.
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>('[data-slot="device-chain-slot-fold"]')
        ?.focus()
    );
  }, [folded, onFoldedChange]);
  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const { clientX, clientY } = event;
      travelled.current = false;
      const watch = (pointer: globalThis.PointerEvent) => {
        if (
          Math.hypot(pointer.clientX - clientX, pointer.clientY - clientY) > 3
        ) {
          travelled.current = true;
        }
      };
      window.addEventListener("pointermove", watch, { capture: true });
      window.addEventListener(
        "pointerup",
        () => window.removeEventListener("pointermove", watch, true),
        { capture: true, once: true }
      );
      const target = event.target as Element;
      if (target.closest(HEADER) && !target.closest(CONTROL)) {
        // A device inside a rack moves along its own chain, not the rack along the track's.
        event.stopPropagation();
        startDrag(event, value);
      }
    },
    [startDrag, value]
  );
  // A click folds or unfolds, outside the buttons and not at the end of a drag: folded, anywhere on the strip; open, on the title bar of this device, not on that of one inside it.
  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      const target = event.target as Element;
      if (travelled.current || target.closest(CONTROL)) {
        return;
      }
      const onOwnHeader =
        target.closest('[data-slot="device-header"]') !== null &&
        target.closest('[data-slot="device-chain-slot"]') === root.current;
      if (folded || onOwnHeader) {
        toggleFold();
      }
    },
    [folded, toggleFold]
  );
  const slot = useMemo<SlotContextValue>(
    () => ({ folded, index, title, toggleFold, value }),
    [folded, index, title, toggleFold, value]
  );

  const content = folded ? (
    <div
      className="rounded-xl [--device-radius:calc(var(--radius)+4px)] flex h-full w-8 cursor-pointer flex-col items-center gap-1 border bg-card p-1 [&_button:not([aria-pressed])]:rounded-[max(0px,calc(var(--device-radius,0.5rem)-0.375rem))]"
      data-frame=""
      data-slot="device-chain-strip"
    >
      {/* The on square is where the title bar has it, and as it has it: folding doesn't move it. */}
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
      <span
        className="min-h-0 flex-1 rotate-180 truncate py-1 font-medium text-xs [writing-mode:vertical-rl]"
        title={title}
      >
        {title}
      </span>
      <SlotGrip />
      <SlotRemove />
      <SlotFold />
    </div>
  ) : (
    children
  );

  const rootProps = {
    "aria-label": title,
    className: cn(
      "relative flex shrink-0 flex-col",
      // The line a device would land on, in the middle of the gap before this slot; or after the last, for the end of the chain.
      "before:absolute before:inset-y-0 before:z-10 before:hidden before:w-1 before:rounded-full before:bg-primary data-drop:before:block",
      "after:absolute after:inset-y-0 after:z-10 after:hidden after:w-1 after:rounded-full after:bg-primary data-drop-end:after:block",
      // Flat, the device's card gives way to the surface, and a hairline ends it, however deep its frame sits (a panel
      // may wrap it, a rack holds more). It fills the chain's height, and a device taller than the chain keeps its height:
      // the chain scrolls to it.
      flat
        ? "border-e before:inset-s-[-2px] after:inset-e-[-2px] *:h-auto *:min-h-full **:data-frame:rounded-none **:data-frame:border-0 **:data-frame:bg-transparent **:data-[slot=rack-chain]:rounded-none"
        : "before:inset-s-[-6px] after:inset-e-[-6px]",
      className,
      // Folded, it is as wide as its strip, whatever width the host gives the panel.
      folded && "w-auto"
    ),
    "data-dragging": dragging === value ? "" : undefined,
    "data-drop": dropIndex === index ? "" : undefined,
    "data-drop-end":
      dropIndex === order.length && index === order.length - 1 ? "" : undefined,
    "data-folded": folded ? "" : undefined,
    "data-slot": "device-chain-slot",
    onClick: handleClick,
    onPointerDown: handlePointerDown,
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