import { CaretDownIcon } from "@phosphor-icons/react";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  use,
  useCallback,
  useMemo,
} from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NoteEdit } from "@/lib/note-edits";
import { cn } from "@/lib/utils";

interface NoteEditMenuContextValue {
  isDisabled: (edit: NoteEdit) => boolean;
  onEdit: (edit: NoteEdit) => void;
}

const NoteEditMenuContext = createContext<NoteEditMenuContextValue | null>(
  null
);

function useNoteEditMenu() {
  const context = use(NoteEditMenuContext);
  if (!context) {
    throw new Error("NoteEditMenu parts must be placed inside a NoteEditMenu.");
  }
  return context;
}

const NEVER_DISABLED = () => false;

interface NoteEditMenuProps {
  children: ReactNode;
  /** Whether an edit can't run now, such as `!canApplyNoteEdit(edit, state)`. */
  disabled?: (edit: NoteEdit) => boolean;
  /** An edit was picked: run it with `applyNoteEdit`. */
  onEdit: (edit: NoteEdit) => void;
}

/**
 * What the items read, without a menu of its own: wrap the content of a menu
 * that opens otherwise, such as a right-click's, so `NoteEditMenuItems` and
 * `NoteEditMenuSub` work in it.
 */
function NoteEditMenuProvider({
  children,
  disabled = NEVER_DISABLED,
  onEdit,
}: NoteEditMenuProps) {
  const value = useMemo(
    () => ({ isDisabled: disabled, onEdit }),
    [disabled, onEdit]
  );
  return <NoteEditMenuContext value={value}>{children}</NoteEditMenuContext>;
}

/** A menu of commands over notes: put `NoteEditMenuItems` and `NoteEditMenuSub` in its content, beside items of your own. */
function NoteEditMenu({ children, ...props }: NoteEditMenuProps) {
  return (
    <NoteEditMenuProvider {...props}>
      <DropdownMenu>{children}</DropdownMenu>
    </NoteEditMenuProvider>
  );
}

/** The button that opens the menu, "Notes" with a caret unless given children. */
function NoteEditMenuTrigger({
  children = "Notes",
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <DropdownMenuTrigger
      render={
        <Button
          data-slot="note-edit-menu-trigger"
          variant="outline"
          {...props}
        />
      }
    >
      {children}
      <CaretDownIcon />
    </DropdownMenuTrigger>
  );
}

function NoteEditMenuContent({
  align = "end",
  className,
  ...props
}: ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent
      align={align}
      className={cn("w-auto min-w-52", className)}
      data-slot="note-edit-menu-content"
      {...props}
    />
  );
}

/** A menu item per edit, with its key beside it. */
function NoteEditMenuItems({ edits }: { edits: readonly NoteEdit[] }) {
  const { isDisabled, onEdit } = useNoteEditMenu();
  const handleClick = useCallback(
    (event: { currentTarget: HTMLElement }) => {
      const item = edits.find(
        (edit) => edit.id === event.currentTarget.dataset.edit
      );
      if (item) {
        onEdit(item);
      }
    },
    [edits, onEdit]
  );
  return edits.map((item) => (
    <DropdownMenuItem
      data-edit={item.id}
      disabled={isDisabled(item)}
      key={item.id}
      onClick={handleClick}
    >
      {item.label}
      {item.shortcut ? (
        <DropdownMenuShortcut>{item.shortcut}</DropdownMenuShortcut>
      ) : null}
    </DropdownMenuItem>
  ));
}

/** A submenu named `label`, holding a menu item per edit. */
function NoteEditMenuSub({
  edits,
  label,
}: {
  edits: readonly NoteEdit[];
  label: ReactNode;
}) {
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>{label}</DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-auto min-w-48">
        <NoteEditMenuItems edits={edits} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}

export {
  NoteEditMenu,
  NoteEditMenuContent,
  NoteEditMenuItems,
  NoteEditMenuProvider,
  NoteEditMenuSub,
  NoteEditMenuTrigger,
};
