"use client";

import * as React from "react";
import { LockButton } from "@/app/(create)/customizer/lock-button";
import {
  Picker,
  PickerContent,
  PickerGroup,
  PickerRadioGroup,
  PickerRadioItem,
  PickerSeparator,
  PickerTrigger,
} from "@/app/(create)/customizer/picker";
import { useDesignSystemSearchParams } from "@/app/(create)/lib/search-params";
import { useConfig } from "@/hooks/use-config";
import { RADII, type RadiusValue } from "@/registry/config";

export function RadiusPicker({
  isMobile,
  anchorRef,
}: {
  isMobile: boolean;
  anchorRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [mounted, setMounted] = React.useState(false);
  const [params, setParams] = useDesignSystemSearchParams();
  const [config, setConfig] = useConfig();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const radiusValue = params.radius ?? config.radius;
  const currentRadius = RADII.find((radius) => radius.name === radiusValue);
  const defaultRadius = RADII.find((radius) => radius.name === "default");
  const otherRadii = RADII.filter((radius) => radius.name !== "default");

  const handleValueChange = React.useCallback(
    (value: string) => {
      const newRadius = value as RadiusValue;
      setParams({ radius: newRadius });
      setConfig((prev) => ({ ...prev, radius: newRadius }));
    },
    [setParams, setConfig]
  );

  return (
    <div className="group/picker relative">
      <Picker>
        <PickerTrigger>
          <div className="flex flex-col justify-start text-left">
            <div className="text-site-muted-foreground text-xs">Radius</div>
            <div className="font-medium text-site-foreground text-sm">
              {mounted ? currentRadius?.label : "..."}
            </div>
          </div>
          <div className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-4 flex size-4 rotate-90 select-none items-center justify-center text-base text-site-foreground">
            <svg
              className="text-site-foreground"
              height="24"
              viewBox="0 0 24 24"
              width="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 20v-5C4 8.925 8.925 4 15 4h5"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              />
            </svg>
          </div>
        </PickerTrigger>
        <PickerContent
          align={isMobile ? "center" : "start"}
          anchor={isMobile ? anchorRef : undefined}
          side={isMobile ? "top" : "right"}
        >
          <PickerRadioGroup
            onValueChange={handleValueChange}
            value={currentRadius?.name}
          >
            <PickerGroup>
              {defaultRadius && (
                <PickerRadioItem
                  key={defaultRadius.name}
                  value={defaultRadius.name}
                >
                  <div className="flex flex-col justify-start pointer-coarse:gap-1">
                    <div>{defaultRadius.label}</div>
                    <div className="pointer-coarse:text-sm text-site-muted-foreground text-xs">
                      Use radius from style
                    </div>
                  </div>
                </PickerRadioItem>
              )}
            </PickerGroup>
            <PickerSeparator />
            <PickerGroup>
              {otherRadii.map((radius) => (
                <PickerRadioItem key={radius.name} value={radius.name}>
                  {radius.label}
                </PickerRadioItem>
              ))}
            </PickerGroup>
          </PickerRadioGroup>
        </PickerContent>
      </Picker>
      <LockButton
        className="-translate-y-1/2 absolute top-1/2 right-10"
        param="radius"
      />
    </div>
  );
}
