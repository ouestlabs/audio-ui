import type * as React from "react";
import { useCallback } from "react";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerTrigger,
  usePickerSide,
} from "@/components/customizer/pickers/picker";
import { useMounted } from "@/hooks/use-mounted";
import { isSkin, SKINS, useSkin } from "@/hooks/use-skin";
import { useSkinAxes } from "@/hooks/use-skin-axes";
import { AXES, type Axis } from "@/lib/design-system/look";

interface PickerPlace {
  anchorRef: React.RefObject<HTMLDivElement | null>;
  isMobile: boolean;
}

/** A picker of the Look: its name, the value chosen, and the list to choose from. */
function LookPicker({
  anchorRef,
  children,
  isMobile,
  label,
  onValueChange,
  shown,
  swatch,
  value,
}: PickerPlace & {
  children: React.ReactNode;
  label: string;
  onValueChange: (value: string) => void;
  shown: string;
  swatch?: string;
  value: string;
}) {
  const mounted = useMounted();
  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <div className="flex flex-col justify-start text-left">
            <div className="text-site-muted-foreground text-xs">{label}</div>
            <div className="font-medium text-site-foreground text-sm">
              {mounted ? shown : "..."}
            </div>
          </div>
          {swatch ? (
            <span
              aria-hidden="true"
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 size-4 rounded-full border"
              style={{ background: swatch }}
            />
          ) : null}
        </PickerTrigger>
        <PickerContent
          align={isMobile ? "center" : "start"}
          anchor={isMobile ? anchorRef : undefined}
          side={usePickerSide(isMobile)}
        >
          <PickerRadioGroup onValueChange={onValueChange} value={value}>
            {children}
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
    </div>
  );
}

/** The skin the components are drawn in: the one the previews of the docs wear. */
export function SkinPicker(place: PickerPlace) {
  const [skin, choose] = useSkin();
  const pick = useCallback(
    (value: string) => {
      if (isSkin(value)) {
        choose(value);
      }
    },
    [choose]
  );
  return (
    <LookPicker
      {...place}
      label="Skin"
      onValueChange={pick}
      shown={SKINS.find((each) => each.id === skin)?.label ?? ""}
      value={skin}
    >
      <PickerGroup>
        {SKINS.map((each) => (
          <PickerRadioItem key={each.id} value={each.id}>
            {each.label}
          </PickerRadioItem>
        ))}
      </PickerGroup>
    </LookPicker>
  );
}

const OWN = "own";

/** An axis of the skins: the skin's own value, or one the reader sets over it. */
export function AxisPicker({ axis, ...place }: PickerPlace & { axis: Axis }) {
  const { choose, values } = useSkinAxes();
  const { label, options } = AXES[axis];
  const chosen = options.find((option) => option.id === values[axis]);
  const colored = axis === "--audio-shade" || axis === "--audio-accent";
  const set = choose[axis];
  const pick = useCallback(
    (value: string) => set(value === OWN ? null : value),
    [set]
  );
  return (
    <LookPicker
      {...place}
      label={label}
      onValueChange={pick}
      shown={chosen?.label ?? "Skin's own"}
      swatch={colored ? chosen?.css : undefined}
      value={chosen?.id ?? OWN}
    >
      <PickerGroup>
        <PickerRadioItem value={OWN}>Skin's own</PickerRadioItem>
      </PickerGroup>
      <PickerSeparator />
      <PickerGroup>
        {options.map((option) => (
          <PickerRadioItem key={option.id} value={option.id}>
            <span className="flex items-center gap-2">
              {colored ? (
                <span
                  aria-hidden="true"
                  className="size-3 rounded-full border"
                  style={{ background: option.css }}
                />
              ) : null}
              {option.label}
            </span>
          </PickerRadioItem>
        ))}
      </PickerGroup>
    </LookPicker>
  );
}
