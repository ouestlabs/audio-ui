"use client";

import type { NoteQuery } from "@audio-ui/core/piano-roll";
import { pitchClassName, type Scale } from "@audio-ui/core/pitch";
import {
  type ChangeEvent,
  type ComponentProps,
  useCallback,
  useId,
  useState,
} from "react";
import { IconPlaceholder } from "@/components/icon-placeholder";
import { cn } from "@/registry/bases/base/lib/utils";
import { Button } from "@/registry/bases/base/ui/button";
import { Input } from "@/registry/bases/base/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/registry/bases/base/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/registry/bases/base/ui/select";

/** The form's fields, as typed: empty means no limit. */
const NO_FIND = {
  chanceFrom: "",
  chanceTo: "",
  every: "1",
  lengthFrom: "",
  lengthTo: "",
  pitch: "any",
  rest: false,
  scale: "any",
  state: "any",
  velocityFrom: "",
  velocityTo: "",
};
type FindFields = typeof NO_FIND;

/** A from…to pair read off two fields, divided by `unit` into the note's terms, or nothing when both are empty. */
function rangeOf(
  from: string,
  to: string,
  unit: number
): [number, number] | undefined {
  if (from === "" && to === "") {
    return;
  }
  return [
    from === "" ? 0 : Number(from) / unit,
    to === "" ? Number.POSITIVE_INFINITY : Number(to) / unit,
  ];
}

/** The query the fields ask for. */
function findQuery(fields: FindFields, scale: Scale | null): NoteQuery {
  return {
    chance: rangeOf(fields.chanceFrom, fields.chanceTo, 100),
    every: { count: Number(fields.every), offset: 0 },
    invert: fields.rest,
    length: rangeOf(fields.lengthFrom, fields.lengthTo, 1),
    muted: fields.state === "any" ? undefined : fields.state === "muted",
    pitchClasses: fields.pitch === "any" ? undefined : [Number(fields.pitch)],
    scale:
      scale && fields.scale !== "any"
        ? { scale, within: fields.scale === "in" }
        : undefined,
    velocity: rangeOf(fields.velocityFrom, fields.velocityTo, 127),
  };
}

const FIND_ROW = "grid grid-cols-[4.5rem_1fr_1fr] items-center gap-1.5";

/** A from…to pair of number fields, `name`From and `name`To, empty for no limit. */
function RangeField({
  fields,
  label,
  max,
  min,
  name,
  onChange,
}: {
  fields: FindFields;
  label: string;
  max: number;
  min: number;
  name: "chance" | "length" | "velocity";
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <fieldset className={FIND_ROW}>
      <legend className="contents text-muted-foreground text-xs">
        {label}
      </legend>
      {(["From", "To"] as const).map((end) => (
        <Input
          aria-label={`${label} ${end === "From" ? "from" : "to"}`}
          className="h-7 tabular-nums"
          inputMode="numeric"
          key={end}
          max={max}
          min={min}
          name={`${name}${end}`}
          onChange={onChange}
          placeholder={String(end === "From" ? min : max)}
          type="number"
          value={fields[`${name}${end}`]}
        />
      ))}
    </fieldset>
  );
}

interface FindItem {
  label: string;
  value: string;
}
const PITCH_ITEMS: FindItem[] = [
  { label: "Any", value: "any" },
  ...Array.from({ length: 12 }, (_, root) => ({
    label: pitchClassName(root),
    value: String(root),
  })),
];
const SCALE_ITEMS: FindItem[] = [
  { label: "Any", value: "any" },
  { label: "In the scale", value: "in" },
  { label: "Out of it", value: "out" },
];
const STATE_ITEMS: FindItem[] = [
  { label: "Any", value: "any" },
  { label: "Active", value: "active" },
  { label: "Deactivated", value: "muted" },
];
const EVERY_ITEMS: FindItem[] = [
  { label: "Note", value: "1" },
  { label: "Second note", value: "2" },
  { label: "Third note", value: "3" },
  { label: "Fourth note", value: "4" },
];

/** One labelled choice of the form. */
function FindSelect({
  disabled = false,
  items,
  label,
  name,
  onField,
  value,
}: {
  disabled?: boolean;
  items: FindItem[];
  label: string;
  name: keyof FindFields;
  onField: (name: string, value: string) => void;
  value: string;
}) {
  const id = useId();
  const handleChange = useCallback(
    (next: string | null) => onField(name, next ?? items[0]?.value ?? ""),
    [items, name, onField]
  );
  return (
    <div className="grid grid-cols-[4.5rem_1fr] items-center gap-1.5">
      <span className="text-muted-foreground text-xs" id={id}>
        {label}
      </span>
      <Select
        disabled={disabled}
        items={items}
        onValueChange={handleChange}
        value={value}
      >
        <SelectTrigger aria-labelledby={id} className="w-full" size="sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

interface NoteFindFormProps
  extends Omit<ComponentProps<"div">, "children" | "onChange"> {
  /** Fired with the query when Select is pressed: pass it to `findNotes` from `@audio-ui/core/piano-roll`. */
  onFind: (query: NoteQuery) => void;
  /** The scale marked, which the "Scale" choice reads; unset, the choice is off. */
  scale: Scale | null;
}

/** The fields that find notes by what they are: a pitch, ranges of velocity, length and chance, in or out of the scale, active or not, every few, or the rest. */
function NoteFindForm({
  className,
  onFind,
  scale,
  ...props
}: NoteFindFormProps) {
  const id = useId();
  const [fields, setFields] = useState<FindFields>(NO_FIND);
  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const { checked, name, type, value } = event.currentTarget;
    setFields((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);
  const find = useCallback(
    () => onFind(findQuery(fields, scale)),
    [fields, onFind, scale]
  );
  const onField = useCallback(
    (name: string, value: string) =>
      setFields((current) => ({ ...current, [name]: value })),
    []
  );
  return (
    <div
      className={cn("flex flex-col gap-2", className)}
      data-slot="note-find-form"
      {...props}
    >
      <FindSelect
        items={PITCH_ITEMS}
        label="Pitch"
        name="pitch"
        onField={onField}
        value={fields.pitch}
      />
      <FindSelect
        disabled={!scale}
        items={SCALE_ITEMS}
        label="Scale"
        name="scale"
        onField={onField}
        value={fields.scale}
      />
      <FindSelect
        items={STATE_ITEMS}
        label="State"
        name="state"
        onField={onField}
        value={fields.state}
      />
      <FindSelect
        items={EVERY_ITEMS}
        label="Every"
        name="every"
        onField={onField}
        value={fields.every}
      />
      <RangeField
        fields={fields}
        label="Velocity"
        max={127}
        min={1}
        name="velocity"
        onChange={handleChange}
      />
      <RangeField
        fields={fields}
        label="Length"
        max={64}
        min={1}
        name="length"
        onChange={handleChange}
      />
      <RangeField
        fields={fields}
        label="Chance %"
        max={100}
        min={0}
        name="chance"
        onChange={handleChange}
      />
      <div className="flex items-center gap-2 text-xs">
        <input
          checked={fields.rest}
          className="accent-primary"
          id={`${id}-rest`}
          name="rest"
          onChange={handleChange}
          type="checkbox"
        />
        <label htmlFor={`${id}-rest`}>The notes that do not match</label>
      </div>
      <Button onClick={find} size="sm" type="button">
        Select
      </Button>
    </div>
  );
}

/** The form in a popover, opened from a search button. */
function NoteFind({
  onFind,
  scale,
}: Pick<NoteFindFormProps, "onFind" | "scale">) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button aria-label="Find notes" size="icon" variant="outline" />
        }
      >
        <IconPlaceholder
          hugeicons="Search01Icon"
          lucide="SearchIcon"
          phosphor="MagnifyingGlassIcon"
          remixicon="RiSearchLine"
          tabler="IconSearch"
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <NoteFindForm onFind={onFind} scale={scale} />
      </PopoverContent>
    </Popover>
  );
}

export { NoteFind, NoteFindForm };
