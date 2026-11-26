import { type RefObject, useCallback } from "react";
import { ChoicePicker } from "@/components/customizer/look/look-pickers";
import {
  PickerGroup,
  PickerRadioItem,
} from "@/components/customizer/pickers/picker";
import {
  type Control,
  PLAYGROUNDS,
  type PlaygroundName,
} from "@/lib/docs/playground/playgrounds";
import {
  useActivePlayground,
  usePlayground,
} from "@/lib/docs/playground/store";

interface PickerPlace {
  anchorRef: RefObject<HTMLDivElement | null>;
  isMobile: boolean;
}

const SIZES: Record<string, string> = {
  default: "Default",
  lg: "Large",
  sm: "Small",
  xl: "Extra large",
  xs: "Extra small",
};

const DIGITS = /^\d+$/;

const named = (option: string) =>
  SIZES[option] ??
  (DIGITS.test(option)
    ? option
    : `${option.charAt(0).toUpperCase()}${option.slice(1)}`);

function ControlPicker({
  control,
  name,
  ...place
}: PickerPlace & { control: Control; name: PlaygroundName }) {
  const [values, set] = usePlayground(name);
  const value = values[control.name] ?? control.options[0] ?? "";
  const pick = useCallback(
    (next: string) => set(control.name, next),
    [control.name, set]
  );
  return (
    <ChoicePicker
      {...place}
      label={control.label}
      onValueChange={pick}
      shown={named(value)}
      value={value}
    >
      <PickerGroup>
        {control.options.map((option) => (
          <PickerRadioItem key={option} value={option}>
            {named(option)}
          </PickerRadioItem>
        ))}
      </PickerGroup>
    </ChoicePicker>
  );
}

/** The props of the component the page shows: its preview and its code follow them. */
export function ComponentPickers(place: PickerPlace) {
  const name = useActivePlayground();
  if (!name) {
    return (
      <p className="p-3 text-site-muted-foreground text-sm">
        The props of a component, on its page.
      </p>
    );
  }
  return (
    <>
      <p className="px-2.5 pt-2 pb-1 font-medium text-site-foreground text-sm">
        {named(name)}
      </p>
      {PLAYGROUNDS[name].controls.map((control) => (
        <ControlPicker
          {...place}
          control={control}
          key={control.name}
          name={name}
        />
      ))}
    </>
  );
}
