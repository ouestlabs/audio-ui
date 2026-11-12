"use client";

import { type RefObject, useCallback } from "react";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerRadioGroup,
  PickerRadioItem,
  PickerTrigger,
  usePickerSide,
} from "@/components/customizer/pickers/picker";
import { useDensity, useSize } from "@/hooks/use-look";
import { useMounted } from "@/hooks/use-mounted";
import {
  DENSITIES,
  type DensityId,
  SIZES,
  type SizeId,
} from "@/lib/docs/content/stylings";

interface Option {
  description: string;
  id: string;
  label: string;
}

function OptionPicker({
  anchorRef,
  isMobile,
  label,
  onChange,
  options,
  value,
}: {
  anchorRef: RefObject<HTMLDivElement | null>;
  isMobile: boolean;
  label: string;
  onChange: (id: string) => void;
  options: readonly Option[];
  value: string;
}) {
  const mounted = useMounted();
  const side = usePickerSide(isMobile);
  const current = options.find((each) => each.id === value);
  return (
    <Picker>
      <PickerTrigger>
        <div className="flex flex-col justify-start text-left">
          <div className="text-site-muted-foreground text-xs">{label}</div>
          <div className="font-medium text-site-foreground text-sm">
            {mounted ? current?.label : "..."}
          </div>
        </div>
      </PickerTrigger>
      <PickerContent
        align={isMobile ? "center" : "start"}
        anchor={isMobile ? anchorRef : undefined}
        side={side}
      >
        <PickerRadioGroup onValueChange={onChange} value={value}>
          <PickerGroup>
            {options.map((each) => (
              <PickerRadioItem key={each.id} value={each.id}>
                <div className="flex flex-col justify-start pointer-coarse:gap-1">
                  <div>{each.label}</div>
                  <div className="pointer-coarse:text-sm text-site-muted-foreground text-xs">
                    {each.description}
                  </div>
                </div>
              </PickerRadioItem>
            ))}
          </PickerGroup>
        </PickerRadioGroup>
      </PickerContent>
    </Picker>
  );
}

interface Props {
  anchorRef: RefObject<HTMLDivElement | null>;
  isMobile: boolean;
}

/** How large the elements' examples are drawn. */
export function SizePicker(props: Props) {
  const [size, choose] = useSize();
  const change = useCallback((id: string) => choose(id as SizeId), [choose]);
  return (
    <OptionPicker
      {...props}
      label="Size"
      onChange={change}
      options={SIZES}
      value={size}
    />
  );
}

/** How far apart the examples' parts sit. */
export function DensityPicker(props: Props) {
  const [density, choose] = useDensity();
  const change = useCallback((id: string) => choose(id as DensityId), [choose]);
  return (
    <OptionPicker
      {...props}
      label="Density"
      onChange={change}
      options={DENSITIES}
      value={density}
    />
  );
}
