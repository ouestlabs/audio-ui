import { MagnifyingGlassIcon } from "@phosphor-icons/react/ssr";
import { type ChangeEvent, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  CATEGORIES,
  COLLECTIONS,
  type DeviceFilter,
  paramOf,
} from "@/lib/devices";

/** One chip of a row: pressed when it is the row's choice; "All" is pressed when the row has none. */
function Chip({
  label,
  onSelect,
  pressed,
  value,
}: {
  label: string;
  onSelect: (value: string | undefined) => void;
  pressed: boolean;
  value: string | undefined;
}) {
  const select = useCallback(() => onSelect(value), [onSelect, value]);
  return (
    <Button
      aria-pressed={pressed}
      onClick={select}
      size="sm"
      variant={pressed ? "secondary" : "ghost"}
    >
      {label}
    </Button>
  );
}

/** A row of chips that picks one name, or none: its label, "All", then each name. */
function ChipRow({
  label,
  names,
  onSelect,
  value,
}: {
  label: string;
  names: readonly string[];
  onSelect: (value: string | undefined) => void;
  value: string | undefined;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="w-20 text-muted-foreground text-xs">{label}</span>
      <div aria-label={label} className="flex flex-wrap gap-1" role="group">
        <Chip
          label="All"
          onSelect={onSelect}
          pressed={value === undefined}
          value={undefined}
        />
        {names.map((name) => (
          <Chip
            key={name}
            label={name}
            onSelect={onSelect}
            pressed={value === paramOf(name)}
            value={paramOf(name)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * What narrows the gallery: words to search, a collection and a category. It
 * holds nothing itself: the filter comes in, and every change goes out whole.
 */
export function GalleryFilters({
  filter,
  onChange,
}: {
  filter: DeviceFilter;
  onChange: (next: DeviceFilter) => void;
}) {
  const search = useCallback(
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange({ ...filter, q: event.target.value }),
    [filter, onChange]
  );
  const pickCollection = useCallback(
    (collection: string | undefined) => onChange({ ...filter, collection }),
    [filter, onChange]
  );
  const pickCategory = useCallback(
    (category: string | undefined) => onChange({ ...filter, category }),
    [filter, onChange]
  );
  return (
    <div className="flex flex-col gap-3">
      <InputGroup className="max-w-md">
        <InputGroupAddon>
          <MagnifyingGlassIcon aria-hidden />
        </InputGroupAddon>
        <InputGroupInput
          aria-label="Search devices"
          onChange={search}
          placeholder="Search devices, components…"
          type="search"
          value={filter.q ?? ""}
        />
      </InputGroup>
      <ChipRow
        label="Collection"
        names={COLLECTIONS}
        onSelect={pickCollection}
        value={filter.collection}
      />
      <ChipRow
        label="Category"
        names={CATEGORIES}
        onSelect={pickCategory}
        value={filter.category}
      />
    </div>
  );
}
