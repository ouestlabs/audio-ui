import {
  type Active,
  DndContext,
  type DragEndEvent,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  DragOverlay,
  type DragStartEvent,
  type DropAnimation,
  defaultDropAnimationSideEffects,
  KeyboardSensor,
  PointerSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/registry/default/lib/utils";
import { Button } from "@/registry/default/ui/button";

const DRAG_OPACITY = 0.4;

type SortableBaseItem = {
  id: UniqueIdentifier;
};

type SortableListProps<TItem extends SortableBaseItem> = {
  items: TItem[];
  onChange: (items: TItem[]) => void;
  renderItem: (
    item: TItem,
    index: number,
    isOverlay?: boolean
  ) => React.ReactNode;
  className?: string;
};

const SortableList = <TItem extends SortableBaseItem>({
  items,
  onChange,
  renderItem,
  className,
}: SortableListProps<TItem>) => {
  const [active, setActive] = React.useState<Active | null>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const [activeItem, activeIndex] = React.useMemo(() => {
    if (active === null) {
      return [null, null];
    }

    const index = items.findIndex(({ id }) => id === active.id);

    return [items[index], index];
  }, [active, items]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = ({ active: activeEvent }: DragStartEvent) => {
    setActive(activeEvent);
  };

  const handleDragEnd = ({ active: activeEvent, over }: DragEndEvent) => {
    if (over && activeEvent.id !== over.id) {
      const activeEventIndex = items.findIndex(
        ({ id }) => id === activeEvent.id
      );
      const overIndex = items.findIndex(({ id }) => id === over.id);

      onChange(arrayMove(items, activeEventIndex, overIndex));
    }

    setActive(null);
  };

  const handleDragCancel = () => {
    setActive(null);
  };

  return (
    <DndContext
      onDragCancel={handleDragCancel}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      sensors={sensors}
    >
      <SortableContext items={items}>
        <ul
          className={cn(
            "flex list-inside list-none list-image-none flex-col p-0",
            className
          )}
          role="application"
        >
          {items.map((item, index) => (
            <React.Fragment key={item.id}>
              {renderItem(item, index)}
            </React.Fragment>
          ))}
        </ul>
      </SortableContext>
      {mounted &&
        createPortal(
          <Overlay>
            {activeItem && activeIndex !== null
              ? renderItem(activeItem, activeIndex, true)
              : null}
          </Overlay>,
          document.body
        )}
    </DndContext>
  );
};

const dropAnimationConfig: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: "0.4",
      },
    },
  }),
};

const Overlay = ({ children }: React.PropsWithChildren) => (
  <DragOverlay
    className="z-100 overflow-hidden rounded-md shadow-elevation-card-hover [&>li]:border-b-0"
    dropAnimation={dropAnimationConfig}
    style={{
      cursor: "grabbing",
    }}
  >
    {children}
  </DragOverlay>
);

type SortableItemProps<TItem extends SortableBaseItem> =
  React.PropsWithChildren<{
    id: TItem["id"];
    className?: string;
  }>;

type SortableItemContextValue = {
  attributes: DraggableAttributes;
  listeners: DraggableSyntheticListeners;
  ref: (node: HTMLElement | null) => void;
  isDragging: boolean;
};

const SortableItemContext =
  React.createContext<SortableItemContextValue | null>(null);

const useSortableItemContext = () => {
  const context = React.useContext(SortableItemContext);

  if (!context) {
    throw new Error(
      "useSortableItemContext must be used within a SortableItemContext"
    );
  }

  return context;
};

const SortableItem = <TItem extends SortableBaseItem>({
  id,
  className,
  children,
}: SortableItemProps<TItem>) => {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const context = React.useMemo(
    () => ({
      attributes,
      listeners,
      ref: setActivatorNodeRef,
      isDragging,
    }),
    [attributes, listeners, setActivatorNodeRef, isDragging]
  );

  const style: React.CSSProperties = {
    opacity: isDragging ? DRAG_OPACITY : undefined,
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <SortableItemContext.Provider value={context}>
      <li
        className={cn("flex flex-1 list-none transition-colors", className)}
        ref={setNodeRef}
        style={style}
      >
        {children}
      </li>
    </SortableItemContext.Provider>
  );
};

const SortableDragHandle = () => {
  const { attributes, listeners, ref } = useSortableItemContext();

  return (
    <Button
      size="icon-sm"
      variant="ghost"
      {...attributes}
      {...listeners}
      className="cursor-grab touch-none active:cursor-grabbing"
      ref={ref}
    >
      <GripVertical className="size-4" />
    </Button>
  );
};
export { SortableList, SortableItem, SortableDragHandle };
